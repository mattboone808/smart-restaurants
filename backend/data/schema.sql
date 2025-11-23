-- Project: Smart Restaurants
-- File: schema.sql
-- Description:
--   Defines all database tables for the Smart Restaurants application,
--   including restaurants, users, reservations, favorites, and reviews.


-- Restaurants
DROP TABLE IF EXISTS restaurants;
CREATE TABLE restaurants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  city TEXT,
  cuisine TEXT,
  price TEXT,
  address TEXT,
  tables INTEGER,
  hours TEXT
);


-- Reservations
DROP TABLE IF EXISTS reservations;
CREATE TABLE reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurant_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  party_size INTEGER NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_resv_user
  ON reservations(user_id);


-- Users
DROP TABLE IF EXISTS users;
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  email TEXT,
  preferred_cuisine TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Insert demo user only if table is empty
INSERT INTO users (name, email, preferred_cuisine)
SELECT 'Demo User', 'demo@example.com', 'Italian'
WHERE NOT EXISTS (SELECT 1 FROM users);


-- Favorites
DROP TABLE IF EXISTS favorites;
CREATE TABLE favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  restaurant_id INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
);

CREATE INDEX IF NOT EXISTS idx_fav_user_rest
  ON favorites(user_id, restaurant_id);


-- Reviews
DROP TABLE IF EXISTS reviews;
CREATE TABLE reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  restaurant_id INTEGER NOT NULL,
  rating INTEGER NOT NULL,
  review_text TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_rest
  ON reviews(restaurant_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_review_unique
  ON reviews(user_id, restaurant_id);
