// MODULE 1: Beneficiary registration (NGO representatives only)
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const multer = require('multer');
const { db, transaction } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validateBeneficiary, hasErrors, clean, RULES } = require('../validation');

const router = express.Router();
router.use(requireAuth, requireRole('ngo'));   // valid JWT AND the NGO role are needed for everything here

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// File rules (same as the page): PDF/JPG/JPEG/PNG, max 2 MB, one file
const MAX_SIZE = 2 * 1024 * 1024;
const EXT = ['pdf', 'jpg', 'jpeg', 'png'];
const upload = multer({
  storage: multer.memoryStorage(),          // kept in memory until all checks pass
  limits: { fileSize: MAX_SIZE, files: 1, fields: 10, fieldSize: 2000 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).slice(1).toLowerCase();
    if (!EXT.includes(ext)) return cb(new UploadError('Unsupported file type. Please choose a PDF, JPG, JPEG or PNG file.'));
    cb(null, true);
  }
});
class UploadError extends Error { constructor(m) { super(m); this.status = 400; this.expose = true; } }

// Check the first bytes of the file really match its type (a renamed .exe is rejected)
function realType(buf) {
  if (buf.length >= 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  return null;
}

const mask = c => c.slice(0, 6) + '*******-' + c.slice(-1);

// GET /api/beneficiaries - beneficiaries of the representative's own organization (CNIC masked)
router.get('/', (req, res) => {
  const rows = db.prepare(`SELECT ref, name, cnic, city, need, status, doc_stored_name IS NOT NULL AS has_document
                           FROM beneficiaries WHERE org_id = ? ORDER BY id`).all(req.user.org_id);
  res.json({ beneficiaries: rows.map(b => ({ ...b, cnic: mask(b.cnic), has_document: !!b.has_document })) });
});

// GET /api/beneficiaries/:ref/cnic - full CNIC only when the representative asks for it
router.get('/:ref/cnic', (req, res) => {
  const ref = clean(req.params.ref);
  if (!RULES.BENEFICIARY_REF.test(ref)) return res.status(400).json({ error: 'Invalid beneficiary reference.' });
  const b = db.prepare('SELECT cnic FROM beneficiaries WHERE ref = ? AND org_id = ?').get(ref, req.user.org_id);
  if (!b) return res.status(404).json({ error: 'Beneficiary not found.' });
  res.set('Cache-Control', 'no-store').json({ cnic: b.cnic });
});

// GET /api/beneficiaries/:ref/document - download the supporting document
router.get('/:ref/document', (req, res) => {
  const ref = clean(req.params.ref);
  if (!RULES.BENEFICIARY_REF.test(ref)) return res.status(400).json({ error: 'Invalid beneficiary reference.' });
  const b = db.prepare('SELECT doc_stored_name, doc_original_name FROM beneficiaries WHERE ref = ? AND org_id = ?').get(ref, req.user.org_id);
  if (!b || !b.doc_stored_name) return res.status(404).json({ error: 'Document not found.' });
  res.set('Cache-Control', 'no-store');
  res.download(path.join(UPLOAD_DIR, path.basename(b.doc_stored_name)), ref + path.extname(b.doc_stored_name));
});

// POST /api/beneficiaries - register a new beneficiary (multipart form, optional "doc" file)
router.post('/', upload.single('doc'), (req, res) => {
  const { errors, value } = validateBeneficiary(req.body || {});

  let ext = null;
  if (req.file) {
    const nameExt = path.extname(req.file.originalname).slice(1).toLowerCase();
    ext = realType(req.file.buffer);
    if (req.file.size === 0) errors.doc = 'This file is empty. Please choose another file.';
    else if (!ext || (ext === 'jpg' ? !['jpg', 'jpeg'].includes(nameExt) : ext !== nameExt)) {
      errors.doc = 'The file content does not match a real PDF, JPG or PNG file.';
    }
  }
  if (hasErrors(errors)) return res.status(400).json({ error: 'Please fix the highlighted fields.', fields: errors });

  if (db.prepare('SELECT 1 FROM beneficiaries WHERE cnic = ?').get(value.cnic)) {
    return res.status(409).json({ error: 'Please fix the highlighted fields.', fields: { cnic: 'A beneficiary with this CNIC is already registered.' } });
  }

  // Save the file under a random name so the user's file name is never used as a path
  let stored = null;
  if (req.file) {
    stored = crypto.randomBytes(16).toString('hex') + '.' + ext;
    fs.writeFileSync(path.join(UPLOAD_DIR, stored), req.file.buffer, { flag: 'wx' });
  }
  const originalName = req.file ? clean(path.basename(req.file.originalname)).slice(0, 100) : null;

  try {
    const ref = transaction(() => {
      const ref = 'B-' + String(db.prepare('SELECT COALESCE(MAX(id), 0) + 1 AS n FROM beneficiaries').get().n).padStart(3, '0');
      db.prepare(`INSERT INTO beneficiaries (ref, org_id, name, cnic, city, need, reason, doc_original_name, doc_stored_name, created_by)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(ref, req.user.org_id, value.name, value.cnic, value.city, value.need, value.reason, originalName, stored, req.user.id);
      return ref;
    });
    res.status(201).json({ message: `Beneficiary ${ref} registered. Status: pending verification by the administrator.`, ref });
  } catch (e) {
    if (stored) fs.rmSync(path.join(UPLOAD_DIR, stored), { force: true });   // do not leave an orphan file
    throw e;
  }
});

module.exports = router;
module.exports.UploadError = UploadError;
