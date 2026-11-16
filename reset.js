// Deletes the database and uploaded files so the next "npm start" begins with fresh sample data.
const fs = require('node:fs');
const path = require('node:path');
const data = path.join(__dirname, '..', 'data');
const uploads = path.join(__dirname, '..', 'uploads');
fs.rmSync(data, { recursive: true, force: true });
fs.rmSync(uploads, { recursive: true, force: true });
console.log('Database and uploads removed. Run "npm start" to create a fresh database.');
