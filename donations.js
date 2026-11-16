// MODULE 2: Donations (donor makes a donation and views history; NGO receives and distributes)
const express = require('express');
const { db, transaction } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validateDonation, hasErrors, clean, RULES } = require('../validation');

const router = express.Router();
router.use(requireAuth);   // every donation route needs a valid JWT

const initials = name => (name ? name.split(' ').filter(Boolean).map(w => w[0].toUpperCase() + '.').join(' ') : '');

// POST /api/donations  (donor only) - make a donation
router.post('/', requireRole('donor'), (req, res) => {
  const { errors, value } = validateDonation(req.body || {});
  if (hasErrors(errors)) return res.status(400).json({ error: Object.values(errors)[0], fields: errors });

  const org = db.prepare('SELECT id, name FROM organizations WHERE id = ? AND verified = 1').get(value.orgId);
  if (!org) return res.status(400).json({ error: 'Please select a verified organization.', fields: { orgId: 'Unknown organization.' } });

  const ref = transaction(() => {
    const next = db.prepare('SELECT COALESCE(MAX(id), 0) + 1001 AS n FROM donations').get().n;
    const ref = 'D-' + next;
    // Parameterised query: user input is passed separately, never joined into the SQL text
    db.prepare(`INSERT INTO donations (ref, donor_id, org_id, type, amount, note, anonymous)
                VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(ref, req.user.id, org.id, value.type, value.amount, value.note, value.anonymous ? 1 : 0);
    return ref;
  });

  res.status(201).json({
    message: `Donation ${ref} recorded. Status: payment confirmed.`,
    donation: { ref, organization: org.name, type: value.type, amount: value.amount, note: value.note, anonymous: value.anonymous, status: 'Payment confirmed' }
  });
});

// GET /api/donations/mine  (donor only) - a donor sees ONLY their own donations
router.get('/mine', requireRole('donor'), (req, res) => {
  const rows = db.prepare(`
    SELECT d.ref, o.name AS organization, d.type, d.amount, d.note, d.anonymous, d.status,
           substr(d.created_at, 1, 10) AS date, b.name AS beneficiary_name
    FROM donations d
    JOIN organizations o ON o.id = d.org_id
    LEFT JOIN beneficiaries b ON b.id = d.beneficiary_id
    WHERE d.donor_id = ?
    ORDER BY d.id DESC`).all(req.user.id);

  // Donors see the beneficiary by initials only (privacy of the person who received aid)
  res.json({ donations: rows.map(({ beneficiary_name, anonymous, ...d }) => ({ ...d, anonymous: !!anonymous, beneficiary: initials(beneficiary_name) })) });
});

// GET /api/donations/received  (NGO only) - donations made to the representative's own organization
router.get('/received', requireRole('ngo'), (req, res) => {
  const rows = db.prepare(`
    SELECT d.ref, d.type, d.amount, d.note, d.status, substr(d.created_at, 1, 10) AS date,
           CASE WHEN d.anonymous = 1 THEN 'Anonymous' ELSE u.name END AS donor,
           b.ref AS beneficiary_ref, b.name AS beneficiary_name
    FROM donations d
    JOIN users u ON u.id = d.donor_id
    LEFT JOIN beneficiaries b ON b.id = d.beneficiary_id
    WHERE d.org_id = ?
    ORDER BY d.id DESC`).all(req.user.org_id);
  res.json({ donations: rows });
});

// PATCH /api/donations/:ref/status  (NGO only, own organization only)
// Body: { "status": "Received by NGO" }  or  { "status": "Distributed", "beneficiaryRef": "B-001" }
router.patch('/:ref/status', requireRole('ngo'), (req, res) => {
  const ref = clean(req.params.ref);
  const status = clean((req.body || {}).status);
  if (!RULES.DONATION_REF.test(ref)) return res.status(400).json({ error: 'Invalid donation reference.' });
  if (!['Received by NGO', 'Distributed'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });

  // The org_id condition stops an NGO from changing another organization's donations
  const d = db.prepare('SELECT id, status FROM donations WHERE ref = ? AND org_id = ?').get(ref, req.user.org_id);
  if (!d) return res.status(404).json({ error: 'Donation not found.' });

  if (status === 'Received by NGO') {
    if (d.status !== 'Payment confirmed') return res.status(409).json({ error: 'Only donations with confirmed payment can be marked as received.' });
    db.prepare("UPDATE donations SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, d.id);
    return res.json({ message: `Donation ${ref} marked as received.` });
  }

  // Distributed
  if (d.status !== 'Received by NGO') return res.status(409).json({ error: 'Only donations received by the NGO can be distributed.' });
  const bref = clean((req.body || {}).beneficiaryRef);
  if (!RULES.BENEFICIARY_REF.test(bref)) return res.status(400).json({ error: 'Please choose a beneficiary.' });
  const b = db.prepare("SELECT id, name FROM beneficiaries WHERE ref = ? AND org_id = ? AND status = 'Verified'").get(bref, req.user.org_id);
  if (!b) return res.status(400).json({ error: 'Beneficiary not found or not verified yet.' });

  db.prepare("UPDATE donations SET status = 'Distributed', beneficiary_id = ?, updated_at = datetime('now') WHERE id = ?").run(b.id, d.id);
  res.json({ message: `Donation ${ref} distributed to ${b.name}.` });
});

module.exports = router;
