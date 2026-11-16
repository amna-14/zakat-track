// Organizations shown on the Donate page (public, read-only)
const express = require('express');
const { db } = require('../db');

const router = express.Router();

// GET /api/organizations
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT id, name, city, focus FROM organizations WHERE verified = 1 ORDER BY name').all();
  res.json({ organizations: rows });
});

module.exports = router;
