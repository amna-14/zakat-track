// Module 1: Register Beneficiary (NGO Representative only)
const $ = s => document.querySelector(s);
const user = JSON.parse(sessionStorage.getItem('user') || 'null');
if (!user) location.replace('login.html');
$('#logout').onclick = () => { sessionStorage.removeItem('user'); location.replace('login.html'); };
window.addEventListener('pageshow', () => { if (!sessionStorage.getItem('user')) location.replace('login.html'); });

// Role check: only an NGO representative can use this module
if (user && user.role === 'ngo') {
  $('#app').hidden = false;
  start();
} else if (user) {
  $('#denied').hidden = false;
}

function start() {
  // Sample records (no database needed for this activity)
  const list = [
    { ref: 'B-001', name: 'Zainab Iqbal', cnic: '33100-1234567-2', city: 'Faisalabad', need: 'Food', status: 'Verified' },
    { ref: 'B-002', name: 'Imran Shah', cnic: '33100-7654321-5', city: 'Faisalabad', need: 'Medical', status: 'Verified' }
  ];
  const shown = new Set();
  const mask = c => c.slice(0, 6) + '*******-' + c.slice(-1);

  function cell(tr, text) { const td = document.createElement('td'); td.textContent = text; tr.appendChild(td); return td; }

  function render() {
    const body = $('#rows');
    body.textContent = '';
    list.forEach(p => {
      const tr = document.createElement('tr');
      cell(tr, p.ref); cell(tr, p.name);
      const td = cell(tr, shown.has(p.ref) ? p.cnic : mask(p.cnic));
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn alt small'; b.style.marginLeft = '8px';
      b.textContent = shown.has(p.ref) ? 'Hide' : 'Show';
      b.onclick = () => { shown.has(p.ref) ? shown.delete(p.ref) : shown.add(p.ref); render(); };
      td.appendChild(b);
      cell(tr, p.city); cell(tr, p.need); cell(tr, p.status);
      body.appendChild(tr);
    });
    $('#total').textContent = list.length;
  }

  // Interaction 1: CNIC is formatted automatically as the user types
  $('#cnic').addEventListener('input', e => {
    const d = e.target.value.replace(/\D/g, '').slice(0, 13);
    e.target.value = d.slice(0, 5) + (d.length > 5 ? '-' + d.slice(5, 12) : '') + (d.length > 12 ? '-' + d.slice(12) : '');
  });
  // Interaction 2: live character counter for the reason box
  $('#reason').addEventListener('input', e => { $('#count').textContent = e.target.value.length; });

  const fields = ['name', 'cnic', 'city', 'need', 'reason'];
  function setErr(id, text) { $('#e-' + id).textContent = text; }
  fields.forEach(f => $('#' + f).addEventListener('input', () => setErr(f, '')));
  fields.forEach(f => $('#' + f).addEventListener('change', () => setErr(f, '')));

  // Interaction 3: form validation, then add the new record to the list
  $('#bf').onsubmit = e => {
    e.preventDefault();
    const name = $('#name').value.trim().replace(/\s+/g, ' ');
    const cnic = $('#cnic').value.trim();
    const city = $('#city').value, need = $('#need').value;
    const reason = $('#reason').value.trim();
    const msg = $('#bmsg');
    fields.forEach(f => setErr(f, ''));
    msg.textContent = ''; msg.className = 'msg';
    let ok = true;
    const bad = (id, t) => { setErr(id, t); ok = false; };

    if (!name) bad('name', 'Full name is required.');
    else if (name.length < 3 || name.length > 60 || !/^[A-Za-z][A-Za-z .'-]*$/.test(name)) bad('name', 'Use 3 to 60 letters (spaces, . - and apostrophe allowed).');
    if (!cnic) bad('cnic', 'CNIC is required.');
    else if (!/^\d{5}-\d{7}-\d$/.test(cnic)) bad('cnic', 'Enter a valid CNIC like 12345-1234567-1.');
    else if (list.some(p => p.cnic === cnic)) bad('cnic', 'A beneficiary with this CNIC is already registered.');
    if (!city) bad('city', 'Please select a city.');
    if (!need) bad('need', 'Please select a type of need.');
    if (!reason) bad('reason', 'Please give a short reason.');
    else if (reason.length < 10) bad('reason', 'Reason must be at least 10 characters.');

    if (!ok) { msg.textContent = 'Please fix the highlighted fields.'; return; }

    const ref = 'B-' + String(list.length + 1).padStart(3, '0');
    list.push({ ref, name, cnic, city, need, reason, status: 'Pending verification' });
    render();
    $('#bf').reset();
    $('#count').textContent = '0';
    msg.className = 'msg ok';
    msg.textContent = `Beneficiary ${ref} registered. Status: pending verification by the administrator.`;
  };

  render();
}
