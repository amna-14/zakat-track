-- ZakatTrack database setup script (SQLite)
-- Run automatically by the server on first start. Can also be run by hand:
--   sqlite3 server/data/zakattrack.db < server/database/schema.sql

PRAGMA foreign_keys = ON;

-- Verified organizations that can receive donations
CREATE TABLE IF NOT EXISTS organizations (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT    NOT NULL UNIQUE,
  city      TEXT    NOT NULL,
  focus     TEXT    NOT NULL,
  verified  INTEGER NOT NULL DEFAULT 1 CHECK (verified IN (0, 1))
);

-- Users: donors and NGO representatives. Passwords are stored ONLY as bcrypt hashes.
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL CHECK (role IN ('donor', 'ngo')),
  org_id        INTEGER REFERENCES organizations(id),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  CHECK (role = 'donor' OR org_id IS NOT NULL)          -- every NGO representative belongs to an organization
);

-- Module 1: beneficiaries registered by NGO representatives
CREATE TABLE IF NOT EXISTS beneficiaries (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  ref               TEXT    NOT NULL UNIQUE,
  org_id            INTEGER NOT NULL REFERENCES organizations(id),
  name              TEXT    NOT NULL,
  cnic              TEXT    NOT NULL UNIQUE,              -- one registration per person
  city              TEXT    NOT NULL CHECK (city IN ('Faisalabad', 'Lahore', 'Karachi', 'Multan')),
  need              TEXT    NOT NULL CHECK (need IN ('Food', 'Medical', 'Education', 'Shelter')),
  reason            TEXT    NOT NULL,
  doc_original_name TEXT,
  doc_stored_name   TEXT,                                 -- random name on disk, never the user's file name
  status            TEXT    NOT NULL DEFAULT 'Pending verification'
                    CHECK (status IN ('Pending verification', 'Verified')),
  created_by        INTEGER NOT NULL REFERENCES users(id),
  created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Module 2: donations made by donors
CREATE TABLE IF NOT EXISTS donations (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ref            TEXT    NOT NULL UNIQUE,
  donor_id       INTEGER NOT NULL REFERENCES users(id),
  org_id         INTEGER NOT NULL REFERENCES organizations(id),
  type           TEXT    NOT NULL CHECK (type IN ('Zakat', 'Sadaqah', 'General charity')),
  amount         INTEGER NOT NULL CHECK (amount BETWEEN 100 AND 1000000),
  note           TEXT    NOT NULL DEFAULT '',
  anonymous      INTEGER NOT NULL DEFAULT 0 CHECK (anonymous IN (0, 1)),
  status         TEXT    NOT NULL DEFAULT 'Payment confirmed'
                 CHECK (status IN ('Payment confirmed', 'Received by NGO', 'Distributed')),
  beneficiary_id INTEGER REFERENCES beneficiaries(id),
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Tokens that were logged out before they expired (so a copied token stops working after logout)
CREATE TABLE IF NOT EXISTS revoked_tokens (
  jti        TEXT    PRIMARY KEY,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_donations_donor ON donations(donor_id);
CREATE INDEX IF NOT EXISTS idx_donations_org   ON donations(org_id);
CREATE INDEX IF NOT EXISTS idx_benef_org       ON beneficiaries(org_id);
