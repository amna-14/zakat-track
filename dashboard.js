const $ = s => document.querySelector(s);
const user = JSON.parse(sessionStorage.getItem('user') || 'null');
if (!user) location.replace('login.html');

const donations = [
  { id: 'D-1001', org: 'Noor Zakat Committee', type: 'Zakat', amt: 5000, status: 'Distributed', to: 'Z. I.' },
  { id: 'D-1002', org: 'Noor Zakat Committee', type: 'Sadaqah', amt: 1500, status: 'Received by NGO', to: '' }
];
const people = [
  { name: 'Zainab Iqbal', cnic: '33100-1234567-2' },
  { name: 'Imran Shah', cnic: '33100-7654321-5' }
];
const mask = c => c.slice(0, 6) + '*******-' + c.slice(-1);
const row = (...c) => '<tr>' + c.map(x => `<td>${x}</td>`).join('') + '</tr>';
const table = (h, rows) => `<table><tr>${h.map(x => `<th>${x}</th>`).join('')}</tr>${rows.join('')}</table>`;

const views = {
  // Donor views
  donations: { roles: ['donor'], html: () => '<h2>My Donations</h2>' + table(['ID', 'Organization', 'Type', 'Amount', 'Status'],
    donations.map(d => row(d.id, d.org, d.type, 'Rs. ' + d.amt, d.status))) },
  track: { roles: ['donor'],
    html: () => '<h2>Track Donation</h2><label for="did">Choose a donation</label><select id="did">' + donations.map(d => `<option>${d.id}</option>`).join('') + '</select><div class="card" style="margin-top:14px"><p id="trk"></p></div>',
    init: () => {
      const f = () => {
        const d = donations.find(x => x.id === $('#did').value);
        $('#trk').textContent = `${d.id}: payment made, ${d.status.toLowerCase()}` + (d.to ? `, aid given to ${d.to}` : ', waiting for distribution');
      };
      $('#did').onchange = f; f();
    } },
  // NGO views
  received: { roles: ['ngo'], html: () => '<h2>Donations Received</h2>' + table(['ID', 'Type', 'Amount', 'Status'],
    donations.map(d => row(d.id, d.type, 'Rs. ' + d.amt, d.status))) },
  beneficiaries: { roles: ['ngo'],
    html: () => '<h2>Beneficiaries</h2>' + table(['Name', 'CNIC', ''],
      people.map((p, i) => row(p.name, `<span id="c${i}">${mask(p.cnic)}</span>`, `<button class="btn alt small" data-i="${i}">Show</button>`))) +
      '<p class="note">CNIC is masked by default and visible to NGO representatives only. Donors never see it.</p>',
    init: () => document.querySelectorAll('button[data-i]').forEach(b => b.onclick = () => {
      const i = b.dataset.i, el = $('#c' + i), hidden = el.textContent === mask(people[i].cnic);
      el.textContent = hidden ? people[i].cnic : mask(people[i].cnic);
      b.textContent = hidden ? 'Hide' : 'Show';
    }) },
  distribute: { roles: ['ngo'],
    html: () => '<h2>Record Aid Distribution</h2><form id="df" class="card"><label for="pp">Beneficiary</label><select id="pp">' + people.map(p => `<option>${p.name}</option>`).join('') +
      '</select><label for="am">Amount (Rs.)</label><input id="am" type="number" min="1"><p class="msg" id="dm"></p><button class="btn" type="submit">Record</button></form>',
    init: () => $('#df').onsubmit = e => {
      e.preventDefault();
      const ok = recordDistribution($('#pp').value, +$('#am').value);
      if (ok) { $('#dm').style.color = '#15803d'; $('#dm').textContent = 'Distribution recorded (demo).'; }
    } }
};

// Restricted function: only an NGO representative can record aid distribution
function recordDistribution(name, amt) {
  if (!user || user.role !== 'ngo') { deny(); return false; }
  if (!(amt > 0)) { $('#dm').style.color = '#b42318'; $('#dm').textContent = 'Enter a valid amount.'; return false; }
  return true;
}
function deny() {
  $('#content').innerHTML = '<div class="card denied"><h3>Access Denied</h3><p>Your role does not have permission to use this function.</p></div>';
}

const menu = {
  donor: [['donations', 'My Donations'], ['track', 'Track Donation']],
  ngo: [['received', 'Donations Received'], ['beneficiaries', 'Beneficiaries'], ['distribute', 'Record Aid Distribution']]
};

function show() {
  const v = location.hash.slice(1), view = views[v], box = $('#content');
  if (!v) { box.innerHTML = '<p class="note">Choose an option above to get started.</p>'; return; }
  if (!view) { box.innerHTML = '<p class="note">Page not found.</p>'; return; }
  if (!view.roles.includes(user.role)) return deny();
  box.innerHTML = view.html();
  if (view.init) view.init();
}

if (user) {
  $('#who').textContent = `Welcome, ${user.name} (${user.role === 'ngo' ? 'NGO Representative' : 'Donor'})`;
  $('#menu').innerHTML = menu[user.role].map(([k, t]) => `<a class="btn alt" href="#${k}">${t}</a>`).join('') +
    (user.role === 'donor'
      ? '<a class="btn alt" href="track-donations.html">Donation History</a><a class="btn" href="donate.html">Donate</a>'
      : '<a class="btn" href="register-beneficiary.html">Register Beneficiary</a>');
  window.onhashchange = show;
  show();
}

$('#logout').onclick = () => { sessionStorage.removeItem('user'); location.replace('login.html'); };
window.onpageshow = () => { if (!sessionStorage.getItem('user')) location.replace('login.html'); };
