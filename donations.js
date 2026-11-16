// Module 2: Donation History, search and details (Donor only)
// Activity 6: the list now comes from the backend (GET /api/donations/mine). The server returns
// only the logged-in donor's own donations, so other donors' records never reach this page.
const $ = s => document.querySelector(s);
const user = ZT.requireLogin();
$('#logout').onclick = () => { $('#ff').reset(); $('#rows').textContent = ''; $('#detail').textContent = ''; $('#detail').hidden = true; $('#app').hidden = true; ZT.logout(); };

// Role check for the screen (the server also refuses non-donors with 403)
if (user && user.role === 'donor') {
  $('#app').hidden = false;
  start();
} else if (user) {
  $('#denied').hidden = false;
}

async function start() {
  const STAGES = ['Payment confirmed', 'Received by NGO', 'Distributed'];
  $('#count').textContent = 'Loading your donations...';
  const r = await ZT.request('/api/donations/mine');
  if (!r.ok) { $('#count').textContent = ''; $('#qerr').textContent = r.data.error; return; }
  // Map the server fields to the names this page already uses
  const mine = r.data.donations.map(d => ({ ref: d.ref, org: d.organization, type: d.type, amt: d.amount, date: d.date, status: d.status, to: d.beneficiary, note: d.note }));

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
    if (d.note) line(box, 'Your message', d.note);   // shown with createTextNode, so it is never run as HTML
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
