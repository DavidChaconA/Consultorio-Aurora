const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
require('dotenv').config();

const dbFile = process.env.DB_FILE || './data/consultorio.db';
const absolute = path.resolve(process.cwd(), dbFile);
fs.mkdirSync(path.dirname(absolute), { recursive: true });

const db = new Database(absolute);
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

module.exports = db;
