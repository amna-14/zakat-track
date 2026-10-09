const $ = s => document.querySelector(s);

// 1. Show/hide password
const pw = $('#password'), tg = $('#toggle');
if (tg) tg.onclick = () => {
  const hidden = pw.type === 'password';
  pw.type = hidden ? 'text' : 'password';
  tg.textContent = hidden ? 'Hide' : 'Show';
};

// 2. Login with demo users (demo only, real authentication comes with the backend)
const demoUsers = [
  { email: 'amna@zakattrack.pk', password: 'Donor@1234', name: 'Amna', role: 'donor' },
  { email: 'bilal@zakattrack.pk', password: 'Ngo@12345', name: 'Bilal', role: 'ngo' }
];
const lf = $('#loginForm');
if (lf) lf.onsubmit = e => {
  e.preventDefault();
  const msg = $('#loginMsg');
  const email = $('#email').value.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return msg.textContent = 'Please enter a valid email address.';
  if (pw.value.length < 8) return msg.textContent = 'Password must be at least 8 characters.';
  const u = demoUsers.find(x => x.email === email && x.password === pw.value);
  if (!u) return msg.textContent = 'Incorrect email or password.';
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
  df.onsubmit = e => {
    e.preventDefault();
    const amt = +$('#amount').value, msg = $('#donMsg');
    msg.style.color = '#b91c1c';
    if (!chosen) return msg.textContent = 'Please select an organization first.';
    if (!(amt >= 100)) return msg.textContent = 'Minimum donation is Rs. 100.';
    msg.textContent = '';
    $('#summary').textContent = `Rs. ${amt} (${$('#type').value}) to ${chosen}` + ($('#anon').checked ? ', anonymous' : '');
    $('#modal').hidden = false;
  };
  $('#cancel').onclick = () => $('#modal').hidden = true;
  $('#confirm').onclick = () => {
    $('#modal').hidden = true;
    df.reset();
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
