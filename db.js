// Database connection (SQLite, built into Node.js 22.13+ as node:sqlite)
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');

const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'data', 'zakattrack.db');
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA foreign_keys = ON;');
db.exec(fs.readFileSync(path.join(__dirname, 'database', 'schema.sql'), 'utf8'));

// Run several statements as one unit: all succeed or none are saved
function transaction(fn) {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; }
  catch (e) { db.exec('ROLLBACK'); throw e; }
}

// First start only: add sample organizations, users and records so the app can be demonstrated
function seedIfEmpty() {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get();
  if (n > 0) return;
  const hash = p => bcrypt.hashSync(p, 12);   // passwords are hashed before they reach the database

  transaction(() => {
    const org = db.prepare('INSERT INTO organizations (name, city, focus) VALUES (?, ?, ?)');
    const alk = org.run('Al-Khidmat Welfare', 'Lahore', 'Food and education aid').lastInsertRowid;
    const noor = org.run('Noor Zakat Committee', 'Faisalabad', 'Widow and orphan support').lastInsertRowid;
    const sehat = org.run('Sehat Care Trust', 'Karachi', 'Medical treatment help').lastInsertRowid;

    const user = db.prepare('INSERT INTO users (name, email, password_hash, role, org_id) VALUES (?, ?, ?, ?, ?)');
    const amna = user.run('Amna', 'amna@zakattrack.pk', hash('Donor@1234'), 'donor', null).lastInsertRowid;
    const usman = user.run('Usman', 'usman@zakattrack.pk', hash('Donor@5678'), 'donor', null).lastInsertRowid;
    const bilal = user.run('Bilal', 'bilal@zakattrack.pk', hash('Ngo@12345'), 'ngo', noor).lastInsertRowid;
    user.run('Hamza', 'hamza@zakattrack.pk', hash('Ngo@12345'), 'ngo', alk);
    user.run('Sara', 'sara@zakattrack.pk', hash('Ngo@12345'), 'ngo', sehat);

    const ben = db.prepare(`INSERT INTO beneficiaries (ref, org_id, name, cnic, city, need, reason, status, created_by)
                            VALUES (?, ?, ?, ?, ?, ?, ?, 'Verified', ?)`);
    const zainab = ben.run('B-001', noor, 'Zainab Iqbal', '33100-1234567-2', 'Faisalabad', 'Food', 'Widow with three children, no income', bilal).lastInsertRowid;
    ben.run('B-002', noor, 'Imran Shah', '33100-7654321-5', 'Faisalabad', 'Medical', 'Needs kidney treatment costs', bilal);

    const don = db.prepare(`INSERT INTO donations (ref, donor_id, org_id, type, amount, status, beneficiary_id, created_at, updated_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    don.run('D-1001', amna, noor, 'Zakat', 5000, 'Distributed', zainab, '2026-09-12 10:00:00', '2026-09-15 10:00:00');
    don.run('D-1002', amna, noor, 'Sadaqah', 1500, 'Received by NGO', null, '2026-09-20 10:00:00', '2026-09-21 10:00:00');
    don.run('D-1003', amna, alk, 'General charity', 2500, 'Payment confirmed', null, '2026-09-25 10:00:00', '2026-09-25 10:00:00');
    don.run('D-1004', amna, sehat, 'Zakat', 10000, 'Payment confirmed', null, '2026-10-01 10:00:00', '2026-10-01 10:00:00');
    don.run('D-1005', usman, noor, 'Zakat', 20000, 'Received by NGO', null, '2026-09-30 10:00:00', '2026-10-02 10:00:00');
  });
  console.log('Database created and sample data added.');
}
seedIfEmpty();

module.exports = { db, transaction, DB_FILE };
