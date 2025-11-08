// backend/data/db.js
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../restaurants.db');
const db = new Database(DB_PATH);

console.log(`Connected to ${DB_PATH} (restaurants table found)`);

module.exports = db;
