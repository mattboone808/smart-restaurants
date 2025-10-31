// backend/server.js
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5050;

app.use(cors());
app.use(express.json());

// ---------------------------
// Load dataset
// ---------------------------
const DATA_PATH = path.join(__dirname, 'restaurants.json');
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

function isOpenNow(hoursObj, nowInput) {
  if (!hoursObj) return false;
  const days = ['sun','mon','tue','wed','thu','fri','sat'];
  const now = nowInput ? new Date(nowInput) : new Date();
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

app.get('/api/restaurants', (req, res) => {
  const { city = '', cuisine = '', price = '', open_now = '', now = '' } = req.query;

  const wantOpen = open_now === 'true';
  const cCity = city.trim().toLowerCase();
  const cCuis = cuisine.trim().toLowerCase();
  const cPrice = price.trim();

  const anyFilter = Boolean(cCity) || Boolean(cCuis) || Boolean(cPrice) || wantOpen;
  if (!anyFilter) {
    return res.status(400).json({
      error: 'Please provide at least one filter: city, cuisine, price, or open_now=true'
    });
  }

  let results = RESTAURANTS.filter(r => {
    const matchCity = cCity ? (r.city || '').toLowerCase().includes(cCity) : true;
    const matchCuisine = cCuis ? (r.cuisine || '').toLowerCase().includes(cCuis) : true;
    const matchPrice = cPrice ? (r.price || '') === cPrice : true;
    return matchCity && matchCuisine && matchPrice;
  });

  results = results.map(r => ({ ...r, open_now: isOpenNow(r.hours, now) }));
  if (wantOpen) results = results.filter(r => r.open_now);

  res.json(results.slice(0, 50));
});

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
