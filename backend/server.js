// backend/server.js
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5050;
const db = require('./data/db');

app.use(cors());
app.use(express.json());

// ---------------------------
// Load dataset (still used for in-memory reservations)
// ---------------------------
const DATA_PATH = path.join(__dirname, 'data', 'restaurants.json');

let RESTAURANTS = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));

// In-memory reservations
const reservations = [];

// ---------------------------
// Helpers
// ---------------------------
function timeToMin(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function isOpenNow(hoursObj) {
  if (!hoursObj) return false;
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const now = new Date(); // always use current server time
  if (isNaN(now.getTime())) return false;

  const dayKey = days[now.getDay()];
  const today = hoursObj[dayKey] || [];
  const curMin = now.getHours() * 60 + now.getMinutes();

  return today.some(([start, end]) => {
    const s = timeToMin(start);
    const e = timeToMin(end);
    if (e === s) return false;
    if (e > s) return curMin >= s && curMin < e;
    return curMin >= s || curMin < e;
  });
}

function normalizeTimeToSlot(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const slotMin = m < 30 ? 0 : 30;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(h)}:${slotMin === 0 ? '00' : '30'}`;
}

function countReservationsForSlot(restaurantId, date, time) {
  const t = normalizeTimeToSlot(time);
  return reservations.filter(
    r =>
      String(r.restaurantId) === String(restaurantId) &&
      r.date === date &&
      normalizeTimeToSlot(r.time) === t
  ).length;
}

// ---------------------------
// Routes
// ---------------------------
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// --------------------------------
// Get restaurants (with filters and open_now)
// --------------------------------
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

    // ✅ Parse hours JSON and compute open_now
    const restaurants = rows.map(r => {
      let parsedHours;
      try {
        parsedHours = JSON.parse(r.hours);
      } catch {
        parsedHours = null;
      }
    
      const open_now = isOpenNow(parsedHours);  // ← no more req.query.now
      return { ...r, hours: parsedHours, open_now };
    });
    

    // Apply open_now filter if requested
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

// --------------------------------
// Get a single restaurant by ID
// --------------------------------
app.get('/api/restaurants/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid restaurant ID' });
    }

    const row = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(id);
    if (!row) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    // Parse hours JSON
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


// --------------------------------
// Reservations (persisted in SQLite)
// --------------------------------

// Make reservation inside a transaction to avoid double-booking
const makeReservation = db.transaction(({ restaurantId, name, partySize, date, time }) => {
  // 1) Confirm restaurant exists + get capacity
  const rest = db.prepare('SELECT id, tables FROM restaurants WHERE id = ?').get(Number(restaurantId));
  if (!rest) return { error: 'Restaurant not found', status: 404 };

  const capacity = typeof rest.tables === 'number' ? rest.tables : 5;

  // 2) Snap time to 30-min slot (HH:mm)
  const slot = normalizeTimeToSlot(time);

  // 3) Count existing reservations for that slot
  const count = db.prepare(
    'SELECT COUNT(*) AS n FROM reservations WHERE restaurant_id = ? AND date = ? AND time = ?'
  ).get(rest.id, date, slot).n;

  if (count >= capacity) {
    return { error: 'No tables available at this time', status: 409 };
  }

  // 4) Insert reservation
  const info = db.prepare(
    'INSERT INTO reservations (restaurant_id, name, party_size, date, time) VALUES (?, ?, ?, ?, ?)'
  ).run(rest.id, name.trim(), Number(partySize), date, slot);

  const tablesRemaining = Math.max(0, capacity - (count + 1));
  const row = db.prepare('SELECT * FROM reservations WHERE id = ?').get(info.lastInsertRowid);

  return { record: { ...row, capacity, tablesRemaining }, status: 201 };
});

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
    return res.status(500).json({ error: 'Failed to create reservation' });
  }
});

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


// ---------------------------
// Start server
// ---------------------------
console.log('Starting Express server...');
const server = app.listen(PORT, () => {
  console.log(`✅ API running on http://localhost:${PORT}`);
});
server.on('error', (e) => console.error('❌ server error:', e));
