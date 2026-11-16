// Shared page script: home, login and donate pages
const $ = s => document.querySelector(s);

// Remove hidden control characters, turn runs of spaces/new lines into one space, trim both ends
const clean = s => String(s).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();

// 1. Show/hide password
const pw = $('#password'), tg = $('#toggle');
if (tg) tg.onclick = () => {
  const hidden = pw.type === 'password';
  pw.type = hidden ? 'text' : 'password';
  tg.textContent = hidden ? 'Hide' : 'Show';
};

// 2. Login (Activity 6, Task 4): the password is checked by the BACKEND, which returns a signed JWT
const EMAIL_OK = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const lf = $('#loginForm');
if (lf) {
  if (new URLSearchParams(location.search).get('expired') === '1') $('#expired').hidden = false;
  lf.onsubmit = async e => {
    e.preventDefault();
    const msg = $('#loginMsg');
    const fail = t => { msg.className = 'msg'; msg.textContent = t; };
    msg.textContent = '';
    const email = clean($('#email').value).toLowerCase();   // spaces removed from both ends
    const password = pw.value;                                // passwords are never trimmed or stored

    // Activity 5 Task 1: validation in the browser (the server checks again)
    if (!email) return fail('Email is required.');
    if (email.length > 100) return fail('Email must be at most 100 characters.');
    if (!EMAIL_OK.test(email)) return fail('Please enter a valid email address.');
    if (!password) return fail('Password is required.');
    if (password.length < 8) return fail('Password must be at least 8 characters.');
    if (password.length > 64) return fail('Password must be at most 64 characters.');

    const btn = lf.querySelector('button[type=submit]');
    btn.disabled = true; msg.className = 'msg ok'; msg.textContent = 'Checking...';
    const r = await ZT.request('/api/auth/login', { method: 'POST', body: { email, password }, auth: false });
    pw.value = '';   // clear the password box as soon as it has been sent
    btn.disabled = false;
    if (!r.ok) return fail(r.data.error);
    ZT.saveSession(r.data.token, r.data.user);   // JWT + name/role only, never the password
    location.href = 'dashboard.html';
  };
}

// 3. Donate page: organizations come from the backend
const df = $('#donateForm');
let cards = [];
let chosen = null;   // { id, name }

function filter() {
  const q = $('#search').value.toLowerCase(), c = $('#city').value;
  cards.forEach(x => x.hidden = !(x.dataset.name.toLowerCase().includes(q) && (!c || x.dataset.city === c)));
  $('#none').hidden = cards.length === 0 || cards.some(x => !x.hidden);
}

async function loadOrganizations() {
  const box = $('#orgs');
  const r = await ZT.request('/api/organizations', { auth: false });
  box.textContent = '';
  if (!r.ok) { box.append(ZT.el('p', { class: 'msg' }, r.data.error)); return; }
  cards = r.data.organizations.map(o => {
    const btn = ZT.el('button', { class: 'btn alt', type: 'button' }, 'Select');
    const card = ZT.el('div', { class: 'card ngo' },
      ZT.el('div', null, ZT.el('h3', null, o.name), ZT.el('p', null, ZT.el('span', { class: 'tag' }, 'Verified'), o.city + ' | ' + o.focus)),
      btn);
    card.dataset.name = o.name; card.dataset.city = o.city;
    btn.onclick = () => {
      cards.forEach(y => y.classList.remove('sel'));
      card.classList.add('sel');
      chosen = { id: o.id, name: o.name };
      $('#chosen').textContent = o.name;
    };
    box.append(card);
    return card;
  });
  if (!cards.length) box.append(ZT.el('p', { class: 'note' }, 'No organizations available yet.'));
}

if (df) {
  $('#search').oninput = filter; $('#city').onchange = filter;
  loadOrganizations();

  const u = ZT.user();
  if (!ZT.loggedIn() || !u || u.role !== 'donor') $('#loginHint').hidden = false;

  const TYPES = ['Zakat', 'Sadaqah', 'General charity'];
  const AMT_MIN = 100, AMT_MAX = 1000000, NOTE_MAX = 100;
  let pending = null;   // the reviewed donation, kept in memory only until it is confirmed or cancelled
  const msg = $('#donMsg');
  const fail = t => { msg.style.color = '#b91c1c'; msg.textContent = t; };

  $('#note').addEventListener('input', e => { $('#ncount').textContent = e.target.value.length; });

  df.onsubmit = e => {
    e.preventDefault();
    const amtText = $('#amount').value.trim();
    const type = $('#type').value;
    const note = clean($('#note').value);

    if (!ZT.loggedIn()) return fail('Please log in as a donor to make a donation.');
    if (ZT.user().role !== 'donor') return fail('Only donor accounts can make donations.');
    // Activity 5 Task 1: validation for the donate form (the server checks again)
    if (!chosen) return fail('Please select an organization first.');
    if (!TYPES.includes(type)) return fail('Please choose a donation type from the list.');
    if ($('#amount').validity.badInput) return fail('Amount must contain numbers only.');
    if (!amtText) return fail('Amount is required.');
    if (!/^\d+$/.test(amtText)) return fail('Amount must be a whole number with digits only.');
    const amt = Number(amtText);
    if (amt < AMT_MIN) return fail('Minimum donation is Rs. ' + AMT_MIN + '.');
    if (amt > AMT_MAX) return fail('Maximum donation is Rs. ' + AMT_MAX.toLocaleString('en-US') + '.');
    if (note.length > NOTE_MAX) return fail('Message must be at most ' + NOTE_MAX + ' characters.');

    msg.textContent = '';
    pending = { orgId: chosen.id, org: chosen.name, amount: amt, type, anonymous: $('#anon').checked, note };
    // textContent shows the text as plain text, it is never read as HTML
    $('#summary').textContent = `Rs. ${amt} (${type}) to ${chosen.name}` + (pending.anonymous ? ', anonymous' : '') + (note ? '. Message: ' + note : '');
    $('#modal').hidden = false;
  };
  $('#cancel').onclick = () => { $('#modal').hidden = true; pending = null; };
  $('#confirm').onclick = async () => {
    if (!pending) return;
    const p = pending; pending = null;
    $('#confirm').disabled = true;
    // Activity 6: the donation is sent to the backend and saved in the database
    const r = await ZT.request('/api/donations', { method: 'POST', body: { orgId: p.orgId, type: p.type, amount: p.amount, note: p.note, anonymous: p.anonymous } });
    $('#confirm').disabled = false;
    $('#modal').hidden = true;
    if (!r.ok) return fail(r.data.error);

    const d = r.data.donation;
    // Safe rendering: createElement + textContent, never innerHTML
    $('#notes').append(ZT.el('li', null, `${d.ref}: Rs. ${d.amount} to ${d.organization}` + (d.note ? ' - ' + d.note : '')));
    $('#notesBox').hidden = false;
    df.reset();
    $('#ncount').textContent = '0';
    cards.forEach(y => y.classList.remove('sel'));
    chosen = null; $('#chosen').textContent = 'None';
    msg.style.color = '#15803d';
    msg.textContent = r.data.message + ' You can follow it in Donation History.';
  };
}

// Clear the login form when the page is shown again (for example with the Back button after logout)
window.addEventListener('pageshow', () => { if (lf) { lf.reset(); $('#loginMsg').textContent = ''; pw.type = 'password'; tg.textContent = 'Show'; } });

// If someone is logged in, the Login link in the menu becomes a Dashboard link
if (ZT.loggedIn()) document.querySelectorAll('nav a[href="login.html"]').forEach(a => { a.textContent = 'Dashboard'; a.href = 'dashboard.html'; });
