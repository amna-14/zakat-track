// Authentication routes: register, login, current user, logout
const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { signToken, requireAuth, revokeToken } = require('../middleware/auth');
const { validateRegistration, validateLogin, hasErrors } = require('../validation');

const router = express.Router();
const BCRYPT_COST = 12;
// Used when the email does not exist, so a wrong email takes as long as a wrong password
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_COST);

// Simple login limiter: 5 failed attempts per email + IP address in 15 minutes
const WINDOW_MS = 15 * 60 * 1000, MAX_FAILS = 5;
const fails = new Map();
const failKey = (req, email) => req.ip + '|' + email;
function tooManyFails(key) {
  const f = fails.get(key);
  if (!f) return false;
  if (Date.now() - f.first > WINDOW_MS) { fails.delete(key); return false; }
  return f.count >= MAX_FAILS;
}
function addFail(key) {
  const f = fails.get(key);
  if (!f || Date.now() - f.first > WINDOW_MS) fails.set(key, { count: 1, first: Date.now() });
  else f.count++;
}

const publicUser = u => {
  const org = u.org_id ? db.prepare('SELECT name FROM organizations WHERE id = ?').get(u.org_id) : null;
  return { name: u.name, email: u.email, role: u.role, organization: org ? org.name : null };
};

// POST /api/auth/register  (public) - creates a DONOR account. Role cannot be chosen by the user.
router.post('/register', async (req, res) => {
  const { errors, value } = validateRegistration(req.body || {});
  if (hasErrors(errors)) return res.status(400).json({ error: Object.values(errors)[0], fields: errors });

  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(value.email)) {
    return res.status(409).json({ error: 'An account with this email already exists.', fields: { email: 'Email already registered.' } });
  }
  const hash = await bcrypt.hash(value.password, BCRYPT_COST);   // only the hash is stored
  db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'donor')").run(value.name, value.email, hash);
  res.status(201).json({ message: 'Account created. You can now log in.' });
});

// POST /api/auth/login  (public) - checks the password on the server and returns a signed JWT
router.post('/login', async (req, res) => {
  const { errors, value } = validateLogin(req.body || {});
  if (hasErrors(errors)) return res.status(400).json({ error: Object.values(errors)[0], fields: errors });

  const key = failKey(req, value.email);
  if (tooManyFails(key)) return res.status(429).json({ error: 'Too many failed attempts. Please wait 15 minutes and try again.' });

  const user = db.prepare('SELECT id, name, email, role, org_id, password_hash FROM users WHERE email = ?').get(value.email);
  const ok = await bcrypt.compare(value.password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !ok) {
    addFail(key);
    return res.status(401).json({ error: 'Incorrect email or password.' });   // same message for both cases
  }
  fails.delete(key);
  res.json({ token: signToken(user), user: publicUser(user) });
});

// GET /api/auth/me  (protected) - shows who the token belongs to
router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

// POST /api/auth/logout  (protected) - the token stops working straight away
router.post('/logout', requireAuth, (req, res) => {
  revokeToken(req.token.jti, req.token.exp);
  res.json({ message: 'Logged out.' });
});

module.exports = router;
