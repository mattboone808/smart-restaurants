/*
  Project: Smart Restaurants
  File: server.js
  Description:
    Express backend for the Smart Restaurants app, providing
    restaurant search, profiles, favorites, reviews,
    reservations, and recommendation endpoints.
*/

const express = require("express");
const cors = require("cors");
const db = require("./data/db");

const app = express();
const PORT = process.env.PORT || 5050;

app.use(cors());
app.use(express.json());

// Active user (temporary)
let currentUserId = 1;

function parseHours(str) {
  try { return JSON.parse(str); }
  catch { return null; }
}


// Health check
app.get("/api/health", (_req, res) => res.json({ ok: true }));


// Get restaurants
app.get("/api/restaurants", (req, res) => {
  try {
    const { city = "", cuisine = "", price = "" } = req.query;
    let query = "SELECT * FROM restaurants WHERE 1=1";
    const params = [];

    if (city) {
      query += " AND LOWER(city) LIKE ?";
      params.push(`%${city.toLowerCase()}%`);
    }
    if (cuisine) {
      query += " AND LOWER(cuisine) LIKE ?";
      params.push(`%${cuisine.toLowerCase()}%`);
    }
    if (price) {
      query += " AND price = ?";
      params.push(price);
    }

    const rows = db.prepare(query).all(...params);

    res.json(
      rows.map(r => ({
        ...r,
        hours: parseHours(r.hours),
        open_now: false
      }))
    );
  } catch {
    res.status(500).json({ error: "Database query failed" });
  }
});


// Get single restaurant
app.get("/api/restaurants/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid restaurant ID" });

    const r = db.prepare("SELECT * FROM restaurants WHERE id = ?").get(id);
    if (!r) return res.status(404).json({ error: "Restaurant not found" });

    res.json({
      ...r,
      hours: parseHours(r.hours),
      open_now: false
    });
  } catch {
    res.status(500).json({ error: "Database query failed" });
  }
});


// Create reservation
const makeReservation = db.transaction(
  ({ restaurantId, name, partySize, date, time }) => {
    const rest = db
      .prepare("SELECT id, tables FROM restaurants WHERE id = ?")
      .get(Number(restaurantId));

    if (!rest) return { error: "Restaurant not found", status: 404 };

    const capacity = typeof rest.tables === "number" ? rest.tables : 5;

    const count = db
      .prepare(`
        SELECT COUNT(*) AS n
        FROM reservations
        WHERE restaurant_id = ?
          AND date = ?
          AND time = ?
      `)
      .get(rest.id, date, time).n;

    if (count >= capacity) {
      return { error: "No tables available at this time", status: 409 };
    }

    const info = db.prepare(`
      INSERT INTO reservations (restaurant_id, user_id, name, party_size, date, time)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(rest.id, currentUserId, name.trim(), Number(partySize), date, time);

    const row = db.prepare("SELECT * FROM reservations WHERE id = ?")
      .get(info.lastInsertRowid);

    return {
      record: {
        ...row,
        capacity,
        tablesRemaining: Math.max(0, capacity - (count + 1))
      },
      status: 201
    };
  }
);

app.post("/api/reservations", (req, res) => {
  const { restaurantId, name, partySize, date, time } = req.body || {};
  if (!restaurantId || !name || !partySize || !date || !time) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    const result = makeReservation({ restaurantId, name, partySize, date, time });
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.status(201).json(result.record);
  } catch {
    res.status(500).json({ error: "Failed to create reservation" });
  }
});


// Reservations for active user
app.get("/api/user/reservations", (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT 
        rv.*,
        rest.name AS restaurant_name,
        rest.city AS restaurant_city,
        rest.cuisine AS restaurant_cuisine,
        rest.address AS restaurant_address
      FROM reservations rv
      JOIN restaurants rest ON rest.id = rv.restaurant_id
      WHERE rv.user_id = ?
      ORDER BY rv.date ASC, rv.time ASC
    `).all(currentUserId);

    res.json(rows);
  } catch (err) {
    console.error("Reservations fetch error:", err);
    res.status(500).json({ error: "Failed to load reservations" });
  }
});


// Profiles
app.get("/api/users", (req, res) => {
  try {
    const users = db.prepare("SELECT * FROM users ORDER BY id").all();
    res.json(users);
  } catch {
    res.status(500).json({ error: "Failed to load users" });
  }
});

app.post("/api/users", (req, res) => {
  const { name, email, preferred_cuisine } = req.body;
  if (!name) return res.status(400).json({ error: "Name is required" });

  try {
    const row = db.prepare(`
      INSERT INTO users (name, email, preferred_cuisine)
      VALUES (?, ?, ?)
    `).run(name, email || "", preferred_cuisine || "");

    res.status(201).json({ id: row.lastInsertRowid });
  } catch {
    res.status(500).json({ error: "Failed to create profile" });
  }
});

app.post("/api/users/select", (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: "User ID required" });
  currentUserId = Number(user_id);
  res.json({ ok: true });
});

app.get("/api/users/active", (req, res) => {
  try {
    const row = db.prepare("SELECT * FROM users WHERE id = ?").get(currentUserId);
    if (!row) return res.status(404).json({ error: "Active user not found" });
    res.json(row);
  } catch {
    res.status(500).json({ error: "Failed to load active user" });
  }
});


// Favorites
app.get("/api/user/favorites", (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT r.*
      FROM favorites f
      JOIN restaurants r ON r.id = f.restaurant_id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `).all(currentUserId);

    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to load favorites" });
  }
});

app.post("/api/user/favorites", (req, res) => {
  const { restaurant_id } = req.body;
  if (!restaurant_id) return res.status(400).json({ error: "Missing restaurant_id" });

  try {
    db.prepare(`
      INSERT INTO favorites (user_id, restaurant_id)
      VALUES (?, ?)
    `).run(currentUserId, restaurant_id);

    res.json({ ok: true });
  } catch (err) {
    if (err.message.includes("UNIQUE")) {
      return res.status(409).json({ error: "Already in favorites" });
    }
    res.status(500).json({ error: "Failed to add favorite" });
  }
});

app.delete("/api/user/favorites", (req, res) => {
  const { restaurant_id } = req.body;
  if (!restaurant_id) return res.status(400).json({ error: "Missing restaurant_id" });

  try {
    db.prepare(`
      DELETE FROM favorites
      WHERE user_id = ? AND restaurant_id = ?
    `).run(currentUserId, restaurant_id);

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to remove favorite" });
  }
});


// Reviews
app.post("/api/reviews", (req, res) => {
  const userId = currentUserId;
  const { restaurant_id, rating, review_text } = req.body;

  if (!restaurant_id || !rating)
    return res.status(400).json({ error: "Missing fields" });

  try {
    db.prepare(`
      INSERT INTO reviews (user_id, restaurant_id, rating, review_text)
      VALUES (?, ?, ?, ?)
    `).run(userId, restaurant_id, rating, review_text || "");

    res.status(201).json({ ok: true });
  } catch (err) {
    if (err.message.includes("UNIQUE")) {
      return res.status(409).json({ error: "You already reviewed this restaurant." });
    }
    res.status(500).json({ error: "Failed to submit review" });
  }
});

app.get("/api/user/reviews", (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT r.*, rest.name AS restaurant_name
      FROM reviews r
      JOIN restaurants rest ON rest.id = r.restaurant_id
      WHERE r.user_id = ?
      ORDER BY datetime(r.created_at) DESC
    `).all(currentUserId);

    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to load reviews" });
  }
});

app.put("/api/reviews/:id", (req, res) => {
  const userId = currentUserId;
  const reviewId = Number(req.params.id);
  const { rating, review_text } = req.body || {};

  if (!reviewId || !rating) {
    return res.status(400).json({ error: "Missing review id or rating" });
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "Rating must be 1–5" });
  }

  try {
    const existing = db
      .prepare("SELECT * FROM reviews WHERE id = ? AND user_id = ?")
      .get(reviewId, userId);

    if (!existing) {
      return res.status(404).json({ error: "Review not found" });
    }

    db.prepare(`
      UPDATE reviews
      SET rating = ?, review_text = ?
      WHERE id = ? AND user_id = ?
    `).run(rating, review_text || "", reviewId, userId);

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to update review" });
  }
});

app.delete("/api/reviews/:id", (req, res) => {
  const userId = currentUserId;
  const reviewId = Number(req.params.id);

  if (!reviewId) return res.status(400).json({ error: "Missing review id" });

  try {
    const info = db
      .prepare("DELETE FROM reviews WHERE id = ? AND user_id = ?")
      .run(reviewId, userId);

    if (info.changes === 0) {
      return res.status(404).json({ error: "Review not found" });
    }

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete review" });
  }
});


// Recommendations
app.get("/api/user/recommendations", (req, res) => {
  const userId = currentUserId;

  try {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);

    const favorites = db.prepare(`
      SELECT r.*
      FROM favorites f
      JOIN restaurants r ON r.id = f.restaurant_id
      WHERE f.user_id = ?
    `).all(userId);

    const reviews = db.prepare(`
      SELECT r.*, rest.cuisine
      FROM reviews r
      JOIN restaurants rest ON rest.id = r.restaurant_id
      WHERE r.user_id = ?
    `).all(userId);

    const all = db.prepare("SELECT * FROM restaurants").all();

    const favCuisines = new Set(favorites.map(f => f.cuisine));
    const highRatedCuisines = new Set(
      reviews.filter(r => r.rating >= 4).map(r => r.cuisine)
    );

    const reviewedIds  = new Set(reviews.map(r => r.restaurant_id));
    const favoriteIds  = new Set(favorites.map(r => r.id));

    const scored = all
      .filter(r => !favoriteIds.has(r.id) && !reviewedIds.has(r.id))
      .map(r => {
        let score = 0;
        if (user.preferred_cuisine && r.cuisine === user.preferred_cuisine) score += 3;
        if (favCuisines.has(r.cuisine)) score += 2;
        if (highRatedCuisines.has(r.cuisine)) score += 2;
        return { ...r, score };
      })
      .filter(r => r.score > 0);

    const cuisineGroups = {};
    for (const r of scored) {
      if (!cuisineGroups[r.cuisine]) cuisineGroups[r.cuisine] = [];
      cuisineGroups[r.cuisine].push(r);
    }

    function shuffle(arr) {
      return arr.sort(() => Math.random() - 0.5);
    }

    for (const c in cuisineGroups) {
      cuisineGroups[c] = shuffle(cuisineGroups[c]);
    }

    const cuisinesSorted = Object.keys(cuisineGroups).sort((a, b) => {
      return cuisineGroups[b][0].score - cuisineGroups[a][0].score;
    });

    const final = cuisinesSorted.slice(0, 3).map(c => cuisineGroups[c][0]);

    res.json(final);

  } catch (err) {
    console.error("Recommendation error:", err);
    res.status(500).json({ error: "Failed to load recommendations" });
  }
});


// Cancel reservation
app.delete("/api/user/reservations/:id", (req, res) => {
  const userId = currentUserId;
  const reservationId = Number(req.params.id);

  if (!reservationId) return res.status(400).json({ error: "Invalid reservation ID" });

  try {
    const existing = db.prepare(`
      SELECT * FROM reservations
      WHERE id = ? AND name = (
        SELECT name FROM users WHERE id = ?
      )
    `).get(reservationId, userId);

    if (!existing) return res.status(404).json({ error: "Reservation not found" });

    db.prepare("DELETE FROM reservations WHERE id = ?").run(reservationId);

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to cancel reservation" });
  }
});


// Start server
console.log("Starting Express server…");
const server = app.listen(PORT, () => {
  console.log(`API running at http://localhost:${PORT}`);
});
server.on("error", e => console.error("Server error:", e));
