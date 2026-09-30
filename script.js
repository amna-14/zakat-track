const $ = s => document.querySelector(s);

// 1. Show/hide password
const pw = $('#password'), tg = $('#toggle');
if (tg) tg.onclick = () => {
  const hidden = pw.type === 'password';
  pw.type = hidden ? 'text' : 'password';
  tg.textContent = hidden ? 'Hide' : 'Show';
};

// 2. Login form validation
const lf = $('#loginForm');
if (lf) lf.onsubmit = e => {
  e.preventDefault();
  const msg = $('#loginMsg');
  if (!/^\S+@\S+\.\S+$/.test($('#email').value.trim())) return msg.textContent = 'Please enter a valid email address.';
  if (pw.value.length < 8) return msg.textContent = 'Password must be at least 8 characters.';
  location.href = 'donate.html';
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
