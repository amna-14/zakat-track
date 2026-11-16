// Activity 5, Task 5: password strength feedback + validation. Activity 6: account is saved by the backend.
const $ = s => document.querySelector(s);
const COLORS = { Weak: '#b42318', Moderate: '#b7791f', Strong: '#15803d' };
const pass = $('#rpass');

// Call the instructor's function (checkPasswordStrength) and show the result under the password box
function showStrength() {
  const box = $('#strength');
  if (!pass.value) { box.hidden = true; return null; }
  if (typeof window.checkPasswordStrength !== 'function') {
    box.hidden = false;
    $('#sLevel').textContent = 'Password checker file is missing.';
    $('#sMsg').textContent = '';
    return null;
  }
  const r = window.checkPasswordStrength(pass.value);   // the provided function, used without changes
  box.hidden = false;
  $('#sBar').style.width = Math.round((r.score / r.maximumScore) * 100) + '%';
  $('#sBar').style.background = COLORS[r.level];
  $('#sLevel').textContent = 'Password strength: ' + r.level + ' (' + r.score + ' of ' + r.maximumScore + ')';
  $('#sLevel').style.color = COLORS[r.level];
  $('#sMsg').textContent = r.message;
  return r;
}
pass.addEventListener('input', showStrength);

const clean = s => String(s).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();

$('#regForm').onsubmit = async e => {
  e.preventDefault();
  const msg = $('#rmsg');
  const fail = t => { msg.className = 'msg'; msg.textContent = t; };
  const name = clean($('#rname').value);
  const email = $('#remail').value.trim().toLowerCase();
  const p1 = pass.value, p2 = $('#rpass2').value;

  if (!name) return fail('Full name is required.');
  if (name.length < 3 || name.length > 60) return fail('Full name must be 3 to 60 characters.');
  if (!/^[A-Za-z][A-Za-z .'-]*$/.test(name)) return fail('Name can contain only letters, spaces, . - and apostrophe.');
  if (!email) return fail('Email is required.');
  if (email.length > 100 || !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(email)) return fail('Please enter a valid email address.');
  if (!p1) return fail('Password is required.');
  if (p1.length < 8) return fail('Password must be at least 8 characters.');
  if (p1.length > 64) return fail('Password must be at most 64 characters.');
  const r = showStrength();
  if (r && r.level === 'Weak') return fail('Your password is too weak. Please choose a stronger one.');
  if (p1 !== p2) return fail('The two passwords do not match.');

  // Activity 6: the account is created by the backend (it validates again and stores only a bcrypt hash)
  const btn = $('#regForm button[type=submit]');
  btn.disabled = true;
  const res = await ZT.request('/api/auth/register', { method: 'POST', body: { name, email, password: p1 }, auth: false });
  btn.disabled = false;
  pass.value = ''; $('#rpass2').value = ''; $('#strength').hidden = true;   // never keep the password on the page
  if (!res.ok) return fail(res.data.error);
  $('#regForm').reset();
  msg.className = 'msg ok';
  msg.textContent = res.data.message;
};
