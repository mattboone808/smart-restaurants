const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(__dirname, '../restaurants.db'); // output DB here
const schemaPath = path.resolve(__dirname, '../sql/schema.sql');
const dataPath = path.resolve(__dirname, '../data/restaurants.json');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
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
      hours: JSON.stringify(r.hours) // store as JSON text
    });
  }
});

tx(data);

const count = db.prepare('SELECT COUNT(*) AS n FROM restaurants').get().n;
console.log(`✅ Seeded ${count} restaurants into ${dbPath}`);
