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
