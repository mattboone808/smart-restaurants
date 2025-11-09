/*
  Project: Smart Restaurants
  File: server.js
  Description:
    This is the backend for the Smart Restaurants web app.
    It uses Express to handle API requests, connects to the SQLite database,
    and manages restaurant searches and reservations.
*/

const express = require('express');
const cors = require('cors');
const db = require('./data/db'); // connects to the SQLite database

const app = express();
const PORT = process.env.PORT || 5050;

app.use(cors());
app.use(express.json());

// Load all restaurant data from the database
const RESTAURANTS = db.prepare('SELECT * FROM restaurants').all().map(r => ({
  ...r,
  hours: JSON.parse(r.hours)
}));

// Keeps track of reservations (temporary in memory)
const reservations = [];


// Helper functions

// Turns a time string like "14:30" into total minutes
function timeToMin(hhmm) {
  if (!hhmm || typeof hhmm !== 'string' || !hhmm.includes(':')) return null;
  const [h, m] = hhmm.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

// Checks if a restaurant is currently open
function isOpenNow(hoursObj) {
  if (!hoursObj || typeof hoursObj !== 'object') return false;

  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const now = new Date();
  const dayKey = days[now.getDay()];
  const today = Array.isArray(hoursObj[dayKey]) ? hoursObj[dayKey] : [];
  const curMin = now.getHours() * 60 + now.getMinutes();

  return today.some(range => {
    if (!Array.isArray(range) || range.length < 2) return false;
    const [start, end] = range;
    const s = timeToMin(start);
    const e = timeToMin(end);
    if (s === null || e === null || s === e) return false;

    // Handles overnight hours
    if (e > s) return curMin >= s && curMin < e;
    return curMin >= s || curMin < e;
  });
}

// Rounds a given time to the nearest 30-minute interval
function normalizeTimeToSlot(hhmm) {
  if (!hhmm || typeof hhmm !== 'string' || !hhmm.includes(':')) return '00:00';
  const [h, m] = hhmm.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return '00:00';
  const slotMin = m < 30 ? 0 : 30;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(h)}:${slotMin === 0 ? '00' : '30'}`;
}

// Counts how many reservations exist for a restaurant time slot
function countReservationsForSlot(restaurantId, date, time) {
  const t = normalizeTimeToSlot(time);
  return reservations.filter(
    r =>
      String(r.restaurantId) === String(restaurantId) &&
      r.date === date &&
      normalizeTimeToSlot(r.time) === t
  ).length;
}


// Routes

// Test route to confirm server is working
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Get all restaurants
app.get('/api/restaurants', (req, res) => {
  try {
    const { city = '', cuisine = '', price = '' } = req.query;
    let query = 'SELECT * FROM restaurants WHERE 1=1';
    const params = [];

    if (city) {
      query += ' AND LOWER(city) LIKE ?';
      params.push(`%${city.toLowerCase()}%`);
    }
    if (cuisine) {
      query += ' AND LOWER(cuisine) LIKE ?';
      params.push(`%${cuisine.toLowerCase()}%`);
    }
    if (price) {
      query += ' AND price = ?';
      params.push(price);
    }

    const rows = db.prepare(query).all(...params);

    // Parse hours and check open status
    const restaurants = rows.map(r => {
      let parsedHours;
      try {
        parsedHours = JSON.parse(r.hours);
      } catch {
        parsedHours = null;
      }
      const open_now = isOpenNow(parsedHours);
      return { ...r, hours: parsedHours, open_now };
    });

    // If user asked for only open restaurants
    let filtered = restaurants;
    if (req.query.open_now === 'true') {
      filtered = restaurants.filter(r => r.open_now);
    }

    res.json(filtered);
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// Get one restaurant by its ID
app.get('/api/restaurants/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid restaurant ID' });

    const row = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'Restaurant not found' });

    let parsedHours;
    try {
      parsedHours = JSON.parse(row.hours);
    } catch {
      parsedHours = null;
    }

    const open_now = isOpenNow(parsedHours);
    res.json({ ...row, hours: parsedHours, open_now });
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// Make a reservation (saves to SQLite)
const makeReservation = db.transaction(({ restaurantId, name, partySize, date, time }) => {
  const rest = db.prepare('SELECT id, tables FROM restaurants WHERE id = ?').get(Number(restaurantId));
  if (!rest) return { error: 'Restaurant not found', status: 404 };

  const capacity = typeof rest.tables === 'number' ? rest.tables : 5;
  const slot = normalizeTimeToSlot(time);

  const count = db.prepare(
    'SELECT COUNT(*) AS n FROM reservations WHERE restaurant_id = ? AND date = ? AND time = ?'
  ).get(rest.id, date, slot).n;

  if (count >= capacity) {
    return { error: 'No tables available at this time', status: 409 };
  }

  const info = db.prepare(
    'INSERT INTO reservations (restaurant_id, name, party_size, date, time) VALUES (?, ?, ?, ?, ?)'
  ).run(rest.id, name.trim(), Number(partySize), date, slot);

  const tablesRemaining = Math.max(0, capacity - (count + 1));
  const row = db.prepare('SELECT * FROM reservations WHERE id = ?').get(info.lastInsertRowid);
  return { record: { ...row, capacity, tablesRemaining }, status: 201 };
});

// Add a new reservation
app.post('/api/reservations', (req, res) => {
  const { restaurantId, name, partySize, date, time } = req.body || {};
  if (!restaurantId || !name || !partySize || !date || !time) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  try {
    const result = makeReservation({ restaurantId, name, partySize, date, time });
    if (result.error) return res.status(result.status).json({ error: result.error });
    return res.status(201).json(result.record);
  } catch (err) {
    console.error('Reservation error:', err);
    res.status(500).json({ error: 'Failed to create reservation' });
  }
});

// Get the latest 100 reservations
app.get('/api/reservations', (_req, res) => {
  try {
    const rows = db.prepare(
      'SELECT * FROM reservations ORDER BY datetime(created_at) DESC LIMIT 100'
    ).all();
    res.json(rows);
  } catch (err) {
    console.error('Read reservations error:', err);
    res.status(500).json({ error: 'Failed to read reservations' });
  }
});

// Start the server
console.log('Starting Express server...');
const server = app.listen(PORT, () => {
  console.log(`✅ API running on http://localhost:${PORT}`);
});
server.on('error', (e) => console.error('❌ server error:', e));
