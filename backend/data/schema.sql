-- Rebuild base data table
DROP TABLE IF EXISTS restaurants;
CREATE TABLE restaurants (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT,
  cuisine TEXT,
  price TEXT,
  address TEXT,
  tables INTEGER,
  hours TEXT -- JSON string
);

-- New: persistent reservations
DROP TABLE IF EXISTS reservations;
CREATE TABLE reservations (
  id INTEGER PRIMARY KEY,
  restaurant_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  party_size INTEGER NOT NULL,
  date TEXT NOT NULL,   -- YYYY-MM-DD
  time TEXT NOT NULL,   -- HH:mm (00 or 30)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
);

-- Helpful index for availability checks
CREATE INDEX IF NOT EXISTS idx_resv_rest_date_time
  ON reservations(restaurant_id, date, time);
