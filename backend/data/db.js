/*
  Project: Smart Restaurants
  File: db.js
  Description:
    Opens the SQLite database (restaurants.db) and makes the connection
    available to the rest of the backend.
*/

const Database = require('better-sqlite3');
const path = require('path');

// Find the restaurants.db file inside the backend folder
const dbPath = path.join(__dirname, './restaurants.db');

// Open the database
const db = new Database(dbPath, { fileMustExist: true });

// Startup message
console.log(`✅ Connected to ${dbPath}`);

// Let other files use this database connection
module.exports = db;
