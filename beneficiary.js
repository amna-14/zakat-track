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

  // Security rules (Activity 5, Task 1)
  const ALLOWED_CITIES = ['Faisalabad', 'Lahore', 'Karachi', 'Multan'];
  const ALLOWED_NEEDS = ['Food', 'Medical', 'Education', 'Shelter'];
  const NAME_MIN = 3, NAME_MAX = 60;
  const REASON_MIN = 10, REASON_MAX = 200;
  const NAME_OK = /^[A-Za-z][A-Za-z .'-]*$/;
  const REASON_OK = /^[A-Za-z0-9 .,'()\-:;!?\/]+$/;   // no < > { } " ` & etc.

  // File rules (Activity 5, Task 3)
  const DOC_EXT = ['pdf', 'jpg', 'jpeg', 'png'];
  const DOC_MAX = 2 * 1024 * 1024;   // 2 MB
  const DOC_NOTE = 'Allowed: PDF, JPG, JPEG, PNG. Maximum size: 2 MB.';

  // Remove hidden control characters, turn any run of spaces/tabs/new lines into one space, trim both ends
  const clean = s => String(s).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();

  // Returns an error message, or an empty string if the file is acceptable
  function checkDoc(file) {
    if (!file) return '';
    const dot = file.name.lastIndexOf('.');
    const ext = dot > 0 ? file.name.slice(dot + 1).toLowerCase() : '';
    if (!DOC_EXT.includes(ext)) return 'Unsupported file type. Please choose a PDF, JPG, JPEG or PNG file.';
    if (file.size === 0) return 'This file is empty. Please choose another file.';
    if (file.size > DOC_MAX) return 'File is too large (' + (file.size / 1048576).toFixed(1) + ' MB). The maximum size is 2 MB.';
    return '';
  }

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
  // Show or clear an error under a field and mark the field with a red border
  function setErr(id, text) {
    $('#e-' + id).textContent = text;
    $('#' + id).style.borderColor = text ? '#b42318' : '';
    $('#' + id).setAttribute('aria-invalid', text ? 'true' : 'false');
  }
  fields.forEach(f => $('#' + f).addEventListener('input', () => setErr(f, '')));
  fields.forEach(f => $('#' + f).addEventListener('change', () => setErr(f, '')));

  // Remove extra spaces as soon as the user leaves a text box
  ['name', 'reason'].forEach(f => $('#' + f).addEventListener('blur', e => {
    e.target.value = clean(e.target.value);
    if (f === 'reason') $('#count').textContent = e.target.value.length;
  }));

  // File selection: check the file as soon as it is chosen; reject it and clear the box if it is not allowed
  $('#doc').addEventListener('change', e => {
    const file = e.target.files[0];
    const err = checkDoc(file);
    setErr('doc', err);
    if (err) { e.target.value = ''; $('#docinfo').textContent = DOC_NOTE; return; }
    $('#docinfo').textContent = file ? 'Selected: ' + file.name + ' (' + Math.max(1, Math.round(file.size / 1024)) + ' KB)' : DOC_NOTE;
  });

  // Interaction 3: form validation, then add the new record to the list
  $('#bf').onsubmit = e => {
    e.preventDefault();
    const name = clean($('#name').value);
    const cnic = $('#cnic').value.trim();
    const city = $('#city').value, need = $('#need').value;
    const reason = clean($('#reason').value);
    const msg = $('#bmsg');
    fields.forEach(f => setErr(f, ''));
    setErr('doc', '');
    msg.textContent = ''; msg.className = 'msg';
    let ok = true;
    const bad = (id, t) => { setErr(id, t); ok = false; };

    // Full name: required, 3 to 60 characters, letters and a few safe symbols
    if (!name) bad('name', 'Full name is required.');
    else if (name.length < NAME_MIN) bad('name', 'Full name must be at least ' + NAME_MIN + ' characters.');
    else if (name.length > NAME_MAX) bad('name', 'Full name must be at most ' + NAME_MAX + ' characters.');
    else if (!NAME_OK.test(name)) bad('name', 'Use letters only (spaces, . - and apostrophe allowed).');

    // CNIC: required, exact format, no duplicates
    if (!cnic) bad('cnic', 'CNIC is required.');
    else if (!/^\d{5}-\d{7}-\d$/.test(cnic)) bad('cnic', 'Enter a valid CNIC like 12345-1234567-1.');
    else if (list.some(p => p.cnic === cnic)) bad('cnic', 'A beneficiary with this CNIC is already registered.');

    // City and need: required, and must be one of the real options (blocks values changed in browser tools)
    if (!city) bad('city', 'Please select a city.');
    else if (!ALLOWED_CITIES.includes(city)) bad('city', 'Please choose a city from the list.');
    if (!need) bad('need', 'Please select a type of need.');
    else if (!ALLOWED_NEEDS.includes(need)) bad('need', 'Please choose a need from the list.');

    // Reason: required, 10 to 200 characters, safe characters only
    if (!reason) bad('reason', 'Please give a short reason.');
    else if (reason.length < REASON_MIN) bad('reason', 'Reason must be at least ' + REASON_MIN + ' characters.');
    else if (reason.length > REASON_MAX) bad('reason', 'Reason must be at most ' + REASON_MAX + ' characters.');
    else if (!REASON_OK.test(reason)) bad('reason', 'Reason can contain only letters, numbers, spaces and . , - \' ( ) : ; ! ? /');

    // Supporting document (optional): checked again on submit
    const file = $('#doc').files[0];
    const docErr = checkDoc(file);
    if (docErr) bad('doc', docErr);

    if (!ok) { msg.textContent = 'Please fix the highlighted fields.'; return; }

    const ref = 'B-' + String(list.length + 1).padStart(3, '0');
    list.push({ ref, name, cnic, city, need, reason, doc: file ? file.name : '', status: 'Pending verification' });
    render();
    $('#bf').reset();
    $('#count').textContent = '0';
    $('#docinfo').textContent = DOC_NOTE;
    msg.className = 'msg ok';
    msg.textContent = `Beneficiary ${ref} registered. Status: pending verification by the administrator.`;
  };

  render();
}
