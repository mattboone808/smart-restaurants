/*
  Project: Smart Restaurants
  File: seed.js
  Description:
    This script builds and fills the SQLite database for the Smart Restaurants app.
    It runs the SQL commands from schema.sql to set up the tables,
    then loads data from restaurants.json and saves it to the database.
*/

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Set the database file path 
const dbPath = path.resolve(__dirname, './restaurants.db');

// Point to the schema and data files in this same folder
const schemaPath = path.resolve(__dirname, './schema.sql');
const dataPaths = [
  path.resolve(__dirname, './restaurants.json'),
  path.resolve(__dirname, './restaurantsFrederick.json')
];

// Read in the schema and data files
const schema = fs.readFileSync(schemaPath, 'utf-8');
const data = dataPaths.map(p => JSON.parse(fs.readFileSync(p, 'utf8'))).flat();

// Create or open the database
const db = new Database(dbPath);

// Build the tables using the schema
db.exec(schema);

// Prepare an insert statement for adding restaurant records
const insert = db.prepare(`
  INSERT INTO restaurants (id, name, city, cuisine, price, address, tables, hours)
  VALUES (@id, @name, @city, @cuisine, @price, @address, @tables, @hours)
`);

// Insert all the restaurant data in one transaction
const tx = db.transaction(rows => {
  for (const r of rows) {
    insert.run({
      ...r,
      hours: JSON.stringify(r.hours) // store hours as JSON text
    });
  }
});

// Run the transaction with the imported data
tx(data);

// Confirm how many restaurants were added
const count = db.prepare('SELECT COUNT(*) AS n FROM restaurants').get().n;
console.log(`✅ Seeded ${count} restaurants into ${dbPath}`);
