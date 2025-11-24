// Project: Smart Restaurants
// File: db.js
// Description:
//   Opens the SQLite database (restaurants.db) and makes the connection
//   for use throughout the backend.

const Database = require("better-sqlite3");
const path = require("path");

// Path to restaurants.db
const dbPath = path.join(__dirname, "restaurants.db");

// Open database
const db = new Database(dbPath, { fileMustExist: true });

// Log connection on startup
console.log(`Connected to database at ${dbPath}`);

// Export connection
module.exports = db;
