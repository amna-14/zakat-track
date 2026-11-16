// Automated security and functionality tests for Activity 6 (Task 6).
// Run with:  npm test   (from the server folder)
// It starts its own copy of the server on port 3999 with a temporary database,
// so your real data is not touched.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const PORT = 3999;
const BASE = `http://localhost:${PORT}`;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zakattrack-test-'));
const DB_FILE = path.join(TMP, 'test.db');

let passed = 0, failed = 0;
function check(name, cond, detail = '') {
  if (cond) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  ->  ' + detail : '')); }
}

async function call(method, url, { token, body, form, headers = {} } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = 'Bearer ' + token;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { h['Content-Type'] = 'application/json'; payload = typeof body === 'string' ? body : JSON.stringify(body); }
  const res = await fetch(BASE + url, { method, headers: h, body: payload });
  const text = await res.text();
  let data = null; try { data = JSON.parse(text); } catch {}
  return { status: res.status, data, text };
}
const login = async (email, password) => (await call('POST', '/api/auth/login', { body: { email, password } }));
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');

async function main() {
  const server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), DB_FILE, UPLOAD_DIR: path.join(TMP, 'uploads'), JWT_SECRET: 'test-secret-'.padEnd(64, 'x') },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let serverLog = '';
  server.stdout.on('data', d => serverLog += d); server.stderr.on('data', d => serverLog += d);
  for (let i = 0; i < 50; i++) {   // wait for the server to start
    try { if ((await fetch(BASE + '/api/health')).ok) break; } catch {}
    await new Promise(r => setTimeout(r, 200));
  }

  try {
    console.log('\n1. Login and JWT generation');
    const a = await login('amna@zakattrack.pk', 'Donor@1234');
    const donor = a.data && a.data.token;
    check('Donor login succeeds (200) and returns a JWT', a.status === 200 && /^[\w-]+\.[\w-]+\.[\w-]+$/.test(donor || ''), a.status);
    check('Login response does not contain the password or its hash', !/Donor@1234|password_hash|\$2[aby]\$/.test(a.text));
    const ngo = (await login('bilal@zakattrack.pk', 'Ngo@12345')).data.token;
    const ngo2 = (await login('hamza@zakattrack.pk', 'Ngo@12345')).data.token;
    const usman = (await login('usman@zakattrack.pk', 'Donor@5678')).data.token;
    const wrong = await login('amna@zakattrack.pk', 'Wrong@1234');
    check('Wrong password is rejected (401)', wrong.status === 401, wrong.status);
    const ghost = await login('nobody@zakattrack.pk', 'Wrong@1234');
    check('Unknown email gets the same message as a wrong password', ghost.status === 401 && ghost.data.error === wrong.data.error);

    console.log('\n2. Protected endpoint with a valid token');
    const me = await call('GET', '/api/auth/me', { token: donor });
    check('GET /api/auth/me with valid token (200)', me.status === 200 && me.data.user.email === 'amna@zakattrack.pk', me.status);

    console.log('\n3. Missing, invalid or modified tokens are rejected');
    check('No token (401)', (await call('GET', '/api/auth/me')).status === 401);
    check('Random text as token (401)', (await call('GET', '/api/auth/me', { token: 'abc.def.ghi' })).status === 401);
    const [h, , sig] = donor.split('.');
    const payload = JSON.parse(Buffer.from(donor.split('.')[1], 'base64url').toString());
    const tampered = [h, b64({ ...payload, role: 'ngo' }), sig].join('.');
    check('Modified token (role changed to ngo, old signature) (401)', (await call('GET', '/api/beneficiaries', { token: tampered })).status === 401);
    const none = [b64({ alg: 'none', typ: 'JWT' }), b64({ ...payload, role: 'ngo' }), ''].join('.');
    check('Unsigned token with "alg: none" (401)', (await call('GET', '/api/beneficiaries', { token: none + 'x' })).status === 401);
    const expired = require('jsonwebtoken').sign({ role: 'donor' }, 'test-secret-'.padEnd(64, 'x'),
      { algorithm: 'HS256', subject: '1', issuer: 'zakattrack', audience: 'zakattrack-web', jwtid: 'e1', expiresIn: -10 });
    check('Expired token (401)', (await call('GET', '/api/auth/me', { token: expired })).status === 401);
    const otherKey = require('jsonwebtoken').sign({ role: 'ngo' }, 'some-other-secret-key-of-the-attacker-0000000',
      { algorithm: 'HS256', subject: '3', issuer: 'zakattrack', audience: 'zakattrack-web', jwtid: 'e2', expiresIn: 600 });
    check('Token signed with a different secret (401)', (await call('GET', '/api/beneficiaries', { token: otherKey })).status === 401);

    console.log('\n4. Role-based access restrictions');
    check('Donor cannot list beneficiaries (403)', (await call('GET', '/api/beneficiaries', { token: donor })).status === 403);
    const fdDenied = new FormData(); fdDenied.append('name', 'Test Person');
    check('Donor cannot register a beneficiary (403)', (await call('POST', '/api/beneficiaries', { token: donor, form: fdDenied })).status === 403);
    check('NGO cannot view donor history (403)', (await call('GET', '/api/donations/mine', { token: ngo })).status === 403);
    check('NGO cannot make a donation (403)', (await call('POST', '/api/donations', { token: ngo, body: { orgId: 1, type: 'Zakat', amount: 500 } })).status === 403);
    check('Donor cannot change a donation status (403)', (await call('PATCH', '/api/donations/D-1002/status', { token: donor, body: { status: 'Distributed' } })).status === 403);
    check("NGO cannot change another organization's donation (404)", (await call('PATCH', '/api/donations/D-1002/status', { token: ngo2, body: { status: 'Distributed', beneficiaryRef: 'B-001' } })).status === 404);
    const ngo2List = await call('GET', '/api/beneficiaries', { token: ngo2 });
    check("NGO cannot see another organization's beneficiaries", ngo2List.status === 200 && ngo2List.data.beneficiaries.length === 0);

    console.log('\n5a. Module 2 (Donations): submit and retrieve');
    const orgs = (await call('GET', '/api/organizations')).data.organizations;
    const noor = orgs.find(o => o.name === 'Noor Zakat Committee');
    const xss = '<img src=x onerror=alert(1)>';
    const d = await call('POST', '/api/donations', { token: donor, body: { orgId: noor.id, type: 'Zakat', amount: 2500, note: xss, anonymous: true } });
    check('Donor makes a donation (201)', d.status === 201 && /^D-\d+$/.test(d.data.donation.ref), d.status + ' ' + d.text);
    const mine = await call('GET', '/api/donations/mine', { token: donor });
    const saved = mine.data.donations.find(x => x.ref === d.data.donation.ref);
    check('New donation is retrieved from the database', !!saved && saved.amount === 2500);
    check('Script text is stored as plain data (shown with textContent on the page)', saved && saved.note === xss);
    check("Donor sees only their own donations (Usman's D-1005 is hidden)", !mine.data.donations.some(x => x.ref === 'D-1005'));
    check('Usman sees his own donation', (await call('GET', '/api/donations/mine', { token: usman })).data.donations.some(x => x.ref === 'D-1005'));
    check('Amount below 100 rejected (400)', (await call('POST', '/api/donations', { token: donor, body: { orgId: noor.id, type: 'Zakat', amount: 50 } })).status === 400);
    check('Amount as decimal rejected (400)', (await call('POST', '/api/donations', { token: donor, body: { orgId: noor.id, type: 'Zakat', amount: 150.5 } })).status === 400);
    check('Unknown donation type rejected (400)', (await call('POST', '/api/donations', { token: donor, body: { orgId: noor.id, type: 'Bitcoin', amount: 500 } })).status === 400);
    check('Unknown organization rejected (400)', (await call('POST', '/api/donations', { token: donor, body: { orgId: 999, type: 'Zakat', amount: 500 } })).status === 400);
    check('Message over 100 characters rejected (400)', (await call('POST', '/api/donations', { token: donor, body: { orgId: noor.id, type: 'Zakat', amount: 500, note: 'a'.repeat(101) } })).status === 400);
    const recv = await call('GET', '/api/donations/received', { token: ngo });
    const rd = recv.data.donations.find(x => x.ref === d.data.donation.ref);
    check('NGO receives the donation; anonymous donor name hidden', rd && rd.donor === 'Anonymous');
    check('NGO marks donation as received (200)', (await call('PATCH', `/api/donations/${rd.ref}/status`, { token: ngo, body: { status: 'Received by NGO' } })).status === 200);
    check('NGO distributes it to a verified beneficiary (200)', (await call('PATCH', `/api/donations/${rd.ref}/status`, { token: ngo, body: { status: 'Distributed', beneficiaryRef: 'B-002' } })).status === 200);
    const after = (await call('GET', '/api/donations/mine', { token: donor })).data.donations.find(x => x.ref === rd.ref);
    check('Donor sees "Distributed" with beneficiary initials only (I. S.)', after.status === 'Distributed' && after.beneficiary === 'I. S.');
    check('Cannot distribute the same donation twice (409)', (await call('PATCH', `/api/donations/${rd.ref}/status`, { token: ngo, body: { status: 'Distributed', beneficiaryRef: 'B-001' } })).status === 409);

    console.log('\n5b. Module 1 (Beneficiaries): submit and retrieve');
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6300010000050001', 'hex');
    const fd = new FormData();
    fd.append('name', 'Ayesha Noor'); fd.append('cnic', '35202-1111111-3'); fd.append('city', 'Lahore');
    fd.append('need', 'Education'); fd.append('reason', 'School fees for two children');
    fd.append('doc', new Blob([png], { type: 'image/png' }), 'fees.png');
    const nb = await call('POST', '/api/beneficiaries', { token: ngo, form: fd });
    check('NGO registers a beneficiary with a PNG document (201)', nb.status === 201 && /^B-\d+$/.test(nb.data.ref), nb.status + ' ' + nb.text);
    const list = await call('GET', '/api/beneficiaries', { token: ngo });
    const row = list.data.beneficiaries.find(x => x.ref === nb.data.ref);
    check('New beneficiary is retrieved from the database', !!row && row.status === 'Pending verification');
    check('CNIC is masked in the list', row && row.cnic === '35202-*******-3');
    const full = await call('GET', `/api/beneficiaries/${nb.data.ref}/cnic`, { token: ngo });
    check('Full CNIC available on request to the same organization', full.data && full.data.cnic === '35202-1111111-3');
    check('Uploaded document can be downloaded by the NGO', (await call('GET', `/api/beneficiaries/${nb.data.ref}/document`, { token: ngo })).status === 200);

    const dup = new FormData();
    for (const [k, v] of [['name', 'Other Person'], ['cnic', '35202-1111111-3'], ['city', 'Lahore'], ['need', 'Food'], ['reason', 'Another reason here']]) dup.append(k, v);
    check('Duplicate CNIC rejected (409)', (await call('POST', '/api/beneficiaries', { token: ngo, form: dup })).status === 409);
    const badf = new FormData();
    for (const [k, v] of [['name', '<script>'], ['cnic', '123'], ['city', 'Paris'], ['need', 'Cars'], ['reason', 'short']]) badf.append(k, v);
    const badr = await call('POST', '/api/beneficiaries', { token: ngo, form: badf });
    check('Invalid name, CNIC, city, need and reason all rejected (400)', badr.status === 400 && ['name', 'cnic', 'city', 'need', 'reason'].every(k => badr.data.fields[k]));
    const fake = new FormData();
    for (const [k, v] of [['name', 'Fake File'], ['cnic', '35202-2222222-4'], ['city', 'Lahore'], ['need', 'Food'], ['reason', 'Testing a fake file']]) fake.append(k, v);
    fake.append('doc', new Blob([Buffer.from('MZ this is really a program')]), 'report.pdf');
    check('Program renamed to .pdf is rejected (400)', (await call('POST', '/api/beneficiaries', { token: ngo, form: fake })).status === 400);
    const exe = new FormData();
    for (const [k, v] of [['name', 'Exe File'], ['cnic', '35202-3333333-5'], ['city', 'Lahore'], ['need', 'Food'], ['reason', 'Testing an exe file']]) exe.append(k, v);
    exe.append('doc', new Blob([Buffer.from('MZ')]), 'virus.exe');
    check('.exe file is rejected (400)', (await call('POST', '/api/beneficiaries', { token: ngo, form: exe })).status === 400);
    const big = new FormData();
    for (const [k, v] of [['name', 'Big File'], ['cnic', '35202-4444444-6'], ['city', 'Lahore'], ['need', 'Food'], ['reason', 'Testing a big file']]) big.append(k, v);
    big.append('doc', new Blob([Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(2 * 1024 * 1024 + 10)])]), 'big.pdf');
    check('File over 2 MB is rejected (400)', (await call('POST', '/api/beneficiaries', { token: ngo, form: big })).status === 400);

    console.log('\n6. Registration, password hashing and SQL injection');
    const reg = await call('POST', '/api/auth/register', { body: { name: 'Test Donor', email: 'test.donor@example.com', password: 'Strong@Pass2026' } });
    check('New donor registers (201)', reg.status === 201, reg.status + ' ' + reg.text);
    check('Duplicate email rejected (409)', (await call('POST', '/api/auth/register', { body: { name: 'Test Donor', email: 'test.donor@example.com', password: 'Strong@Pass2026' } })).status === 409);
    check('Weak password rejected by the server (400)', (await call('POST', '/api/auth/register', { body: { name: 'Weak Pass', email: 'weak@example.com', password: 'password' } })).status === 400);
    check('Role cannot be chosen at registration (extra "role":"ngo" ignored)',
      (await call('POST', '/api/auth/register', { body: { name: 'Sneaky User', email: 'sneaky@example.com', password: 'Strong@Pass2026', role: 'ngo' } })).status === 201 &&
      (await login('sneaky@example.com', 'Strong@Pass2026')).data.user.role === 'donor');
    check('New donor can log in', (await login('test.donor@example.com', 'Strong@Pass2026')).status === 200);
    const db = new DatabaseSync(DB_FILE, { readOnly: true });
    const stored = db.prepare('SELECT password_hash FROM users WHERE email = ?').get('test.donor@example.com').password_hash;
    check('Password stored as a bcrypt hash, not plain text', /^\$2[aby]\$12\$/.test(stored) && !stored.includes('Strong@Pass2026'));
    const inj = await login("' OR '1'='1' --@x.com", "' OR '1'='1");
    check("SQL injection in login (' OR '1'='1) does not log in", inj.status !== 200);
    const injDon = await call('POST', '/api/donations', { token: donor, body: { orgId: noor.id, type: 'Zakat', amount: 500, note: "x'); DROP TABLE donations; --" } });
    check('SQL text in a message is saved as plain text; table still exists', injDon.status === 201 && db.prepare('SELECT COUNT(*) AS n FROM donations').get().n > 0);
    db.close();

    console.log('\n7. Safe error messages and logout');
    const badJson = await call('POST', '/api/auth/login', { body: '{"email": broken' });
    check('Broken JSON gives a short message without technical details (400)', badJson.status === 400 && !/at |stack|node_modules|SyntaxError/i.test(badJson.text));
    check('Unknown API route gives JSON 404', (await call('GET', '/api/does-not-exist')).status === 404);
    check('Server files cannot be downloaded (.env.example)', (await call('GET', '/server/.env.example')).status === 404);
    check('Database cannot be downloaded', (await call('GET', '/server/data/zakattrack.db')).status === 404);
    check('Logout succeeds (200)', (await call('POST', '/api/auth/logout', { token: usman })).status === 200);
    check('Token no longer works after logout (401)', (await call('GET', '/api/auth/me', { token: usman })).status === 401);
  } finally {
    server.kill();
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
  if (failed) { console.log('Server output:\n' + serverLog); process.exitCode = 1; }
}

main().catch(e => { console.error(e); process.exitCode = 1; });
