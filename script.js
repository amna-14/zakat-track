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

// 2. Login with demo users (demo only, real authentication comes with the backend)
// Task 4: no plain-text passwords in this file. Only a SHA-256 hash of "zakattrack:email:password" is kept.
const demoUsers = [
  { email: 'amna@zakattrack.pk', hash: 'fa0216bbdf4de6e5c7d807690f99203738786f7d24eaeb5f53eb18596cdbf04f', name: 'Amna', role: 'donor' },
  { email: 'bilal@zakattrack.pk', hash: '99948daec74c5cf0cc7a99adb3ba18e3aff4126c1fede68f1d0de189cfca642e', name: 'Bilal', role: 'ngo' }
];
async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
const EMAIL_OK = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const lf = $('#loginForm');
if (lf) lf.onsubmit = async e => {
  e.preventDefault();
  const msg = $('#loginMsg');
  const fail = t => { msg.textContent = t; };
  msg.textContent = '';
  const email = clean($('#email').value).toLowerCase();   // spaces removed from both ends
  const password = pw.value;                                // passwords are never trimmed or stored

  // Task 1: validation for the login form
  if (!email) return fail('Email is required.');
  if (email.length > 100) return fail('Email must be at most 100 characters.');
  if (!EMAIL_OK.test(email)) return fail('Please enter a valid email address.');
  if (!password) return fail('Password is required.');
  if (password.length < 8) return fail('Password must be at least 8 characters.');
  if (password.length > 64) return fail('Password must be at most 64 characters.');
  if (!(window.crypto && crypto.subtle)) return fail('This browser cannot run the demo login on this page. Please open the live HTTPS site.');

  const h = await sha256('zakattrack:' + email + ':' + password);
  pw.value = '';   // clear the password box as soon as it has been checked
  const u = demoUsers.find(x => x.email === email && x.hash === h);
  if (!u) return fail('Incorrect email or password.');
  // Task 4: only the name and role are kept in the browser (never the password)
  sessionStorage.setItem('user', JSON.stringify({ name: u.name, role: u.role }));
  location.href = 'dashboard.html';
};

// 3. Search and filter organizations
const cards = [...document.querySelectorAll('.ngo')];
let chosen = '';
function filter() {
  const q = $('#search').value.toLowerCase(), c = $('#city').value;
  cards.forEach(x => x.hidden = !(x.dataset.name.toLowerCase().includes(q) && (!c || x.dataset.city === c)));
  $('#none').hidden = cards.some(x => !x.hidden);
}
if ($('#search')) { $('#search').oninput = filter; $('#city').onchange = filter; }
cards.forEach(x => x.querySelector('button').onclick = () => {
  cards.forEach(y => y.classList.remove('sel'));
  x.classList.add('sel');
  chosen = x.dataset.name;
  $('#chosen').textContent = chosen;
});

// 4. Donation validation + confirmation modal
const df = $('#donateForm');
if (df) {
  const TYPES = ['Zakat', 'Sadaqah', 'General charity'];
  const AMT_MIN = 100, AMT_MAX = 1000000, NOTE_MAX = 100;
  let pending = null;   // the reviewed donation, kept in memory only until it is confirmed or cancelled

  $('#note').addEventListener('input', e => { $('#ncount').textContent = e.target.value.length; });

  df.onsubmit = e => {
    e.preventDefault();
    const msg = $('#donMsg');
    const fail = t => { msg.style.color = '#b91c1c'; msg.textContent = t; };
    const amtText = $('#amount').value.trim();
    const type = $('#type').value;
    const note = clean($('#note').value);

    // Task 1: validation for the donate form
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
    pending = { org: chosen, amt, type, anon: $('#anon').checked, note };
    // Task 2: textContent shows the text as plain text, it is never read as HTML
    $('#summary').textContent = `Rs. ${amt} (${type}) to ${chosen}` + (pending.anon ? ', anonymous' : '') + (note ? '. Message: ' + note : '');
    $('#modal').hidden = false;
  };
  $('#cancel').onclick = () => { $('#modal').hidden = true; pending = null; };
  $('#confirm').onclick = () => {
    $('#modal').hidden = true;
    if (pending && pending.note) {
      // Task 2: safe rendering. The user's message is added with createElement + textContent, not innerHTML.
      const li = document.createElement('li');
      li.textContent = 'Rs. ' + pending.amt + ' to ' + pending.org + ': ' + pending.note;
      $('#notes').appendChild(li);
      $('#notesBox').hidden = false;
    }
    pending = null;
    df.reset();
    $('#ncount').textContent = '0';
    cards.forEach(y => y.classList.remove('sel'));
    chosen = ''; $('#chosen').textContent = 'None';
    const msg = $('#donMsg');
    msg.style.color = '#15803d';
    msg.textContent = 'Thank you! Your donation was recorded (demo only, no real payment).';
  };
}

// Clear the login form when the page is shown again (for example with the Back button after logout)
window.addEventListener('pageshow', () => { if (lf) { lf.reset(); $('#loginMsg').textContent = ''; pw.type = 'password'; tg.textContent = 'Show'; } });

// If someone is logged in, the Login link in the menu becomes a Dashboard link
try {
  if (sessionStorage.getItem('user')) document.querySelectorAll('nav a[href="login.html"]').forEach(a => { a.textContent = 'Dashboard'; a.href = 'dashboard.html'; });
} catch (e) {}
