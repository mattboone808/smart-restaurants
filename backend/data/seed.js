/*
  Project: Smart Restaurants
  File: seed.js
  Description:
    Rebuilds the SQLite database using schema.sql and loads restaurant data
    from multiple JSON files into the restaurants table.
*/

const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

/* Database paths */
const dbPath = path.resolve(__dirname, "./restaurants.db");
const schemaPath = path.resolve(__dirname, "./schema.sql");

/* JSON data files */
const cityFiles = [
  "Baltimore.json",
  "Annapolis.json",
  "Frederick.json",
  "OC.json"
];

/* Load schema */
const schema = fs.readFileSync(schemaPath, "utf-8");

/* Load all restaurant entries into one array */
let data = [];

for (const file of cityFiles) {
  const filePath = path.resolve(__dirname, file);

  if (!fs.existsSync(filePath)) {
    console.warn(`⚠ Missing file: ${file}, skipping`);
    continue;
  }

  try {
    const entries = JSON.parse(fs.readFileSync(filePath, "utf8"));
    data.push(...entries);
  } catch (err) {
    console.error(`❌ Failed to parse ${file}:`, err);
  }
}

/* Create database and apply schema */
const db = new Database(dbPath);
db.exec(schema);

/* Insert restaurants (SQLite auto-generates IDs) */
const insert = db.prepare(`
  INSERT INTO restaurants (name, city, cuisine, price, address, tables, hours)
  VALUES (@name, @city, @cuisine, @price, @address, @tables, @hours)
`);

const tx = db.transaction(rows => {
  for (const r of rows) {
    insert.run({
      name: r.name,
      city: r.city,
      cuisine: r.cuisine,
      price: r.price,
      address: r.address,
      tables: r.tables,
      hours: JSON.stringify(r.hours)
    });
  }
});

tx(data);

/* Summary output */
const restaurantCount = db.prepare("SELECT COUNT(*) AS n FROM restaurants").get().n;
const userCount       = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
const favoritesCount  = db.prepare("SELECT COUNT(*) AS n FROM favorites").get().n;
const reviewsCount    = db.prepare("SELECT COUNT(*) AS n FROM reviews").get().n;

console.log("\n================ DATABASE SEEDED ================");
console.log(`🍽️ Restaurants inserted:   ${restaurantCount}`);
console.log(`👤 Users in database:       ${userCount}`);
console.log(`⭐ Favorites count:          ${favoritesCount}`);
console.log(`📝 Reviews count:            ${reviewsCount}`);
console.log(`📁 Database file:            ${dbPath}`);
console.log("=================================================\n");
