// backend/server.js
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5050;
const db = require('./db');

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

    // Debug print to see what's coming in
    console.log('open_now query param:', req.query.open_now, 'now:', req.query.now);

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
// Reservations (still in-memory for now)
// --------------------------------
app.post('/api/reservations', (req, res) => {
  const { restaurantId, name, partySize, date, time } = req.body || {};
  if (!restaurantId || !name || !partySize || !date || !time) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  const rest = RESTAURANTS.find(r => String(r.id) === String(restaurantId));
  if (!rest) return res.status(404).json({ error: 'Restaurant not found' });

  const capacity = typeof rest.tables === 'number' ? rest.tables : 5;
  const existing = countReservationsForSlot(restaurantId, date, time);

  if (existing >= capacity) {
    return res.status(409).json({ error: 'No tables available at this time' });
  }

  const id = reservations.length + 1;
  const record = {
    id,
    restaurantId,
    name,
    partySize: Number(partySize),
    date,
    time: normalizeTimeToSlot(time),
    createdAt: new Date().toISOString()
  };
  reservations.push(record);

  const tablesRemaining = Math.max(0, capacity - (existing + 1));
  res.status(201).json({ ...record, tablesRemaining, capacity });
});

app.get('/api/reservations', (_req, res) => res.json(reservations));

// ---------------------------
// Start server
// ---------------------------
console.log('Starting Express server...');
const server = app.listen(PORT, () => {
  console.log(`✅ API running on http://localhost:${PORT}`);
});
server.on('error', (e) => console.error('❌ server error:', e));
