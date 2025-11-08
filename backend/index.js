const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'data', '../restaurants.db');
const db = new Database(dbPath);

const exists = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='restaurants'"
).get();
console.log(`Connected to ${dbPath}${exists ? ' (restaurants table found)' : ''}`);

module.exports = db;
