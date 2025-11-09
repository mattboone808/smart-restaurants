/*
  Project: Smart Restaurants
  File: index.js
  Description:
    Opens the main SQLite database (restaurants.db) and checks if
    the restaurants table already exists. Exports the database so
    other backend files can use it.
*/

const Database = require('better-sqlite3');
const path = require('path');

// Find the database file inside the backend folder
const dbPath = path.resolve(__dirname, 'data', '../restaurants.db');

// Open the database connection
const db = new Database(dbPath);

// Check if the restaurants table exists
const exists = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='restaurants'"
).get();

// Startup message
console.log(`✅ Connected to ${dbPath}${exists ? ' (restaurants table found)' : ''}`);

// Export the database connection
module.exports = db;
