const $ = s => document.querySelector(s);
const user = JSON.parse(sessionStorage.getItem('user') || 'null');
if (!user) location.replace('login.html');

// Task 2 (XSS): this file used to build pages with innerHTML and template strings.
// Now every element is created with createElement, and text is added as plain text (never read as HTML).
function el(tag, attrs, ...kids) {
  const n = document.createElement(tag);
  if (attrs) Object.keys(attrs).forEach(k => n.setAttribute(k, attrs[k]));
  kids.forEach(k => n.append(k));   // a string becomes a text node, so it can never run as code
  return n;
}
function table(headers, rows) {
  const t = el('table');
  const hr = el('tr');
  headers.forEach(h => hr.append(el('th', null, h)));
  t.append(hr);
  rows.forEach(r => { const tr = el('tr'); r.forEach(c => tr.append(el('td', null, c))); t.append(tr); });
  return t;
}

const donations = [
  { id: 'D-1001', org: 'Noor Zakat Committee', type: 'Zakat', amt: 5000, status: 'Distributed', to: 'Z. I.' },
  { id: 'D-1002', org: 'Noor Zakat Committee', type: 'Sadaqah', amt: 1500, status: 'Received by NGO', to: '' }
];
const people = [
  { name: 'Zainab Iqbal', cnic: '33100-1234567-2' },
  { name: 'Imran Shah', cnic: '33100-7654321-5' }
];
const mask = c => c.slice(0, 6) + '*******-' + c.slice(-1);

const views = {
  // Donor views
  donations: { roles: ['donor'], build: () => {
    const f = document.createDocumentFragment();
    f.append(el('h2', null, 'My Donations'),
      table(['ID', 'Organization', 'Type', 'Amount', 'Status'], donations.map(d => [d.id, d.org, d.type, 'Rs. ' + d.amt, d.status])));
    return f;
  } },
  track: { roles: ['donor'],
    build: () => {
      const f = document.createDocumentFragment();
      const sel = el('select', { id: 'did' });
      donations.forEach(d => sel.append(el('option', null, d.id)));
      f.append(el('h2', null, 'Track Donation'), el('label', { for: 'did' }, 'Choose a donation'), sel,
        el('div', { class: 'card', style: 'margin-top:14px' }, el('p', { id: 'trk' })));
      return f;
    },
    init: () => {
      const f = () => {
        const d = donations.find(x => x.id === $('#did').value);
        $('#trk').textContent = `${d.id}: payment made, ${d.status.toLowerCase()}` + (d.to ? `, aid given to ${d.to}` : ', waiting for distribution');
      };
      $('#did').onchange = f; f();
    } },
  // NGO views
  received: { roles: ['ngo'], build: () => {
    const f = document.createDocumentFragment();
    f.append(el('h2', null, 'Donations Received'),
      table(['ID', 'Type', 'Amount', 'Status'], donations.map(d => [d.id, d.type, 'Rs. ' + d.amt, d.status])));
    return f;
  } },
  beneficiaries: { roles: ['ngo'],
    build: () => {
      const f = document.createDocumentFragment();
      const rows = people.map(p => {
        const span = el('span', null, mask(p.cnic));
        const btn = el('button', { class: 'btn alt small', type: 'button' }, 'Show');
        btn.onclick = () => {
          const hidden = span.textContent === mask(p.cnic);
          span.textContent = hidden ? p.cnic : mask(p.cnic);
          btn.textContent = hidden ? 'Hide' : 'Show';
        };
        return [p.name, span, btn];
      });
      f.append(el('h2', null, 'Beneficiaries'), table(['Name', 'CNIC', ''], rows),
        el('p', { class: 'note' }, 'CNIC is masked by default and visible to NGO representatives only. Donors never see it.'));
      return f;
    } },
  distribute: { roles: ['ngo'],
    build: () => {
      const f = document.createDocumentFragment();
      const sel = el('select', { id: 'pp' });
      people.forEach(p => sel.append(el('option', null, p.name)));
      const form = el('form', { id: 'df', class: 'card' },
        el('label', { for: 'pp' }, 'Beneficiary'), sel,
        el('label', { for: 'am' }, 'Amount (Rs.)'), el('input', { id: 'am', type: 'number', min: '1', max: '1000000' }),
        el('p', { class: 'msg', id: 'dm' }), el('button', { class: 'btn', type: 'submit' }, 'Record'));
      f.append(el('h2', null, 'Record Aid Distribution'), form);
      return f;
    },
    init: () => $('#df').onsubmit = e => {
      e.preventDefault();
      const ok = recordDistribution($('#pp').value, +$('#am').value);
      if (ok) { $('#dm').className = 'msg ok'; $('#dm').textContent = 'Distribution recorded (demo).'; }
    } }
};

// Restricted function: only an NGO representative can record aid distribution
function recordDistribution(name, amt) {
  if (!user || user.role !== 'ngo') { deny(); return false; }
  if (!(amt > 0) || amt > 1000000) { $('#dm').className = 'msg'; $('#dm').textContent = 'Enter an amount between 1 and 1,000,000.'; return false; }
  return true;
}
function deny() {
  const box = $('#content');
  box.textContent = '';
  box.append(el('div', { class: 'card denied' }, el('h3', null, 'Access Denied'), el('p', null, 'Your role does not have permission to use this function.')));
}

const menu = {
  donor: [['donations', 'My Donations'], ['track', 'Track Donation']],
  ngo: [['received', 'Donations Received'], ['beneficiaries', 'Beneficiaries'], ['distribute', 'Record Aid Distribution']]
};

function show() {
  const v = location.hash.slice(1), box = $('#content');
  box.textContent = '';
  if (!v) { box.append(el('p', { class: 'note' }, 'Choose an option above to get started.')); return; }
  // hasOwnProperty stops odd page names such as #constructor from reaching built-in object properties
  if (!Object.prototype.hasOwnProperty.call(views, v)) { box.append(el('p', { class: 'note' }, 'Page not found.')); return; }
  const view = views[v];
  if (!view.roles.includes(user.role)) return deny();
  box.append(view.build());
  if (view.init) view.init();
}

if (user) {
  $('#who').textContent = `Welcome, ${user.name} (${user.role === 'ngo' ? 'NGO Representative' : 'Donor'})`;
  const m = $('#menu');
  m.textContent = '';
  menu[user.role].forEach(([k, t]) => m.append(el('a', { class: 'btn alt', href: '#' + k }, t)));
  if (user.role === 'donor') {
    m.append(el('a', { class: 'btn alt', href: 'track-donations.html' }, 'Donation History'), el('a', { class: 'btn', href: 'donate.html' }, 'Donate'));
  } else {
    m.append(el('a', { class: 'btn', href: 'register-beneficiary.html' }, 'Register Beneficiary'));
  }
  window.onhashchange = show;
  show();
}

// Task 4: logout clears the screen state (page content, menu, name) and everything kept in the browser tab
$('#logout').onclick = () => {
  $('#content').textContent = '';
  $('#menu').textContent = '';
  $('#who').textContent = '';
  sessionStorage.clear();
  location.replace('login.html');
};
window.onpageshow = () => { if (!sessionStorage.getItem('user')) location.replace('login.html'); };
