// ZakatTrack backend server (Express + SQLite + JWT)
// Start with:  cd server  ->  npm install  ->  npm start   ->  open http://localhost:3000
const path = require('node:path');
const express = require('express');
const multer = require('multer');
require('./db');   // opens the database, creates tables and sample data on first start

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const FRONTEND_DIR = path.join(__dirname, '..');   // the HTML/CSS/JS pages live in the folder above
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

app.disable('x-powered-by');                         // do not advertise the framework
if (process.env.TRUST_PROXY) app.set('trust proxy', 1);   // needed on hosts like Render, for correct client IPs

// Basic security headers on every response
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
  });
  next();
});

// CORS: only needed when the pages are hosted somewhere else (e.g. GitHub Pages). Only listed sites are allowed.
app.use('/api', (req, res, next) => {
  const origin = req.get('Origin');
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.set({
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Max-Age': '600',
      Vary: 'Origin'
    });
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  res.set('Cache-Control', 'no-store');   // API answers contain personal data, so never cache them
  next();
});

app.use('/api', express.json({ limit: '10kb' }));   // reject very large request bodies

// API routes
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/organizations', require('./routes/organizations'));
app.use('/api/donations', require('./routes/donations'));          // Module 2
const beneficiaries = require('./routes/beneficiaries');
const { UploadError } = beneficiaries;
app.use('/api/beneficiaries', beneficiaries);                       // Module 1
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// Frontend pages: serve ONLY the top-level .html/.css/.js/.png files.
// The server folder (code, database, uploads, .env) can never be downloaded.
const staticFiles = express.static(FRONTEND_DIR, { index: 'index.html', dotfiles: 'deny', redirect: false });
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (req.path === '/' || /^\/[A-Za-z0-9_-]+\.(html|css|js|png)$/.test(req.path)) return staticFiles(req, res, next);
  next();
});
app.use((req, res) => res.status(404).type('text').send('Page not found.'));

// Error handler: friendly messages only. Technical details are written to the server console, never sent to the user.
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large. The maximum size is 2 MB.'
              : err.code === 'LIMIT_UNEXPECTED_FILE' ? 'Only one file in the "doc" field is allowed.'
              : 'The upload could not be processed.';
    return res.status(400).json({ error: msg, fields: { doc: msg } });
  }
  if (err instanceof UploadError) {
    return res.status(400).json({ error: err.message, fields: { doc: err.message } });   // our own upload errors
  }
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'The request data is not valid JSON.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'The request is too large.' });
  console.error(new Date().toISOString(), req.method, req.originalUrl, err);
  res.status(500).json({ error: 'Something went wrong on the server. Please try again later.' });
});

app.listen(PORT, () => {
  console.log(`ZakatTrack server running at http://localhost:${PORT}`);
  if (ALLOWED_ORIGINS.length) console.log('Allowed other websites (CORS):', ALLOWED_ORIGINS.join(', '));
});
