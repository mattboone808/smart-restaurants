const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// ✅ Database will be created at /backend/restaurants.db
const dbPath = path.resolve(__dirname, '../restaurants.db');

// ✅ These are both in the same folder as this script now
const schemaPath = path.resolve(__dirname, './schema.sql');
const dataPath = path.resolve(__dirname, './restaurants.json');

const schema = fs.readFileSync(schemaPath, 'utf-8');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const db = new Database(dbPath);
db.exec(schema);

const insert = db.prepare(`
  INSERT INTO restaurants (id, name, city, cuisine, price, address, tables, hours)
  VALUES (@id, @name, @city, @cuisine, @price, @address, @tables, @hours)
`);

const tx = db.transaction(rows => {
  for (const r of rows) {
    insert.run({
      ...r,
      hours: JSON.stringify(r.hours) // store hours as JSON text
    });
  }
});

tx(data);

const count = db.prepare('SELECT COUNT(*) AS n FROM restaurants').get().n;
console.log(`✅ Seeded ${count} restaurants into ${dbPath}`);
