const Database = require('better-sqlite3');

// Connect to (or create) the database file 'hornerito.db'
const db = new Database('hornerito.db', { verbose: console.log });

// Drop the existing table and recreate it with the correct schema
db.exec(`
  DROP TABLE IF EXISTS expenses;
  CREATE TABLE expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    amount REAL,
    category TEXT,
    timestamp TEXT DEFAULT (datetime('now'))
  );
`);

console.log('📁 Database ready.');

module.exports = db;
