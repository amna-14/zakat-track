// Module 2: Donation History, search and details (Donor only)
const $ = s => document.querySelector(s);
const user = JSON.parse(sessionStorage.getItem('user') || 'null');
if (!user) location.replace('login.html');
$('#logout').onclick = () => { sessionStorage.removeItem('user'); location.replace('login.html'); };
window.addEventListener('pageshow', () => { if (!sessionStorage.getItem('user')) location.replace('login.html'); });

// Role check: only a donor can use this module
if (user && user.role === 'donor') {
  $('#app').hidden = false;
  start();
} else if (user) {
  $('#denied').hidden = false;
}

function start() {
  const STAGES = ['Payment confirmed', 'Received by NGO', 'Distributed'];
  // Sample data. Records belong to a donor, and each donor sees only their own.
  const all = [
    { ref: 'D-1001', donor: 'Amna', org: 'Noor Zakat Committee', type: 'Zakat', amt: 5000, date: '2026-09-12', status: 'Distributed', to: 'Z. I.' },
    { ref: 'D-1002', donor: 'Amna', org: 'Noor Zakat Committee', type: 'Sadaqah', amt: 1500, date: '2026-09-20', status: 'Received by NGO', to: '' },
    { ref: 'D-1003', donor: 'Amna', org: 'Al-Khidmat Welfare', type: 'General charity', amt: 2500, date: '2026-09-25', status: 'Distributed', to: 'I. S.' },
    { ref: 'D-1004', donor: 'Amna', org: 'Sehat Care Trust', type: 'Zakat', amt: 10000, date: '2026-10-01', status: 'Payment confirmed', to: '' },
    { ref: 'D-1005', donor: 'Amna', org: 'Al-Khidmat Welfare', type: 'Sadaqah', amt: 800, date: '2026-10-03', status: 'Received by NGO', to: '' },
    { ref: 'D-2001', donor: 'Another donor', org: 'Sehat Care Trust', type: 'Zakat', amt: 20000, date: '2026-09-30', status: 'Distributed', to: 'M. K.' }
  ];
  const mine = all.filter(d => d.donor === user.name);

  function cell(tr, text) { const td = document.createElement('td'); td.textContent = text; tr.appendChild(td); return td; }
  function line(parent, label, value) {
    const p = document.createElement('p'); p.style.margin = '4px 0';
    const b = document.createElement('b'); b.textContent = label + ': ';
    p.appendChild(b); p.appendChild(document.createTextNode(value)); parent.appendChild(p);
  }

  function showDetail(d) {
    const box = $('#detail');
    box.textContent = '';
    box.hidden = false;
    const h = document.createElement('h3'); h.textContent = 'Donation ' + d.ref; box.appendChild(h);
    line(box, 'Organization', d.org); line(box, 'Type', d.type);
    line(box, 'Amount', 'Rs. ' + d.amt); line(box, 'Date', d.date);
    const steps = document.createElement('div'); steps.className = 'steps';
    STAGES.forEach((s, i) => {
      const x = document.createElement('span');
      x.className = 'step' + (i <= STAGES.indexOf(d.status) ? ' done' : '');
      x.textContent = (i <= STAGES.indexOf(d.status) ? '✓ ' : '') + s;
      steps.appendChild(x);
    });
    box.appendChild(steps);
    line(box, 'Aid given to', d.to ? d.to : 'Not distributed yet');
  }

  function render(list) {
    const body = $('#rows');
    body.textContent = '';
    list.forEach(d => {
      const tr = document.createElement('tr');
      cell(tr, d.ref); cell(tr, d.org); cell(tr, d.type); cell(tr, 'Rs. ' + d.amt); cell(tr, d.status);
      const td = document.createElement('td');
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn alt small'; b.textContent = 'View';
      b.onclick = () => showDetail(d);
      td.appendChild(b); tr.appendChild(td); body.appendChild(tr);
    });
    $('#none').hidden = list.length > 0;
    $('#count').textContent = `Showing ${list.length} of ${mine.length} donations`;
    $('#sum').textContent = 'Total: Rs. ' + list.reduce((s, d) => s + d.amt, 0);
  }

  // Interaction: search + two filters, with validation of the search text
  function apply() {
    const q = $('#q').value.trim();
    const err = $('#qerr');
    err.textContent = '';
    if (!/^[A-Za-z0-9 \-]*$/.test(q)) {
      err.textContent = 'Search can contain only letters, numbers, spaces and hyphens.';
      return;
    }
    const st = $('#st').value, tp = $('#tp').value, low = q.toLowerCase();
    render(mine.filter(d =>
      (!low || d.ref.toLowerCase().includes(low) || d.org.toLowerCase().includes(low)) &&
      (!st || d.status === st) && (!tp || d.type === tp)));
  }
  $('#q').addEventListener('input', apply);
  $('#st').addEventListener('change', apply);
  $('#tp').addEventListener('change', apply);
  $('#ff').onsubmit = e => { e.preventDefault(); apply(); };
  $('#reset').onclick = () => {
    $('#ff').reset(); $('#qerr').textContent = ''; $('#detail').hidden = true; render(mine);
  };
  render(mine);
}
