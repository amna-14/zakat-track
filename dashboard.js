// Dashboard. Activity 6: every view loads real data from the backend using the JWT.
// The menu shown depends on the role, but the SERVER decides what each role may do.
const $ = s => document.querySelector(s);
const { el } = ZT;
const user = ZT.requireLogin();

function table(headers, rows) {
  const t = el('table');
  t.append(el('tr', null, ...headers.map(h => el('th', null, h))));
  rows.forEach(r => t.append(el('tr', null, ...r.map(c => el('td', null, c)))));
  return t;
}
const message = (text, ok) => el('p', { class: ok ? 'msg ok' : 'msg', role: 'alert' }, text);

const views = {
  // ---------- Donor views (Module 2) ----------
  donations: { roles: ['donor'], title: 'My Donations', load: async () => {
    const r = await ZT.request('/api/donations/mine');
    if (!r.ok) return message(r.data.error);
    if (!r.data.donations.length) return el('p', { class: 'note' }, 'You have not made any donations yet. ', el('a', { href: 'donate.html' }, 'Donate now'));
    return table(['Ref', 'Organization', 'Type', 'Amount', 'Status', 'Date'],
      r.data.donations.map(d => [d.ref, d.organization, d.type, ZT.money(d.amount), d.status, d.date]));
  } },

  track: { roles: ['donor'], title: 'Track Donation', load: async () => {
    const r = await ZT.request('/api/donations/mine');
    if (!r.ok) return message(r.data.error);
    if (!r.data.donations.length) return el('p', { class: 'note' }, 'You have no donations to track yet.');
    const sel = el('select', { id: 'did' }, ...r.data.donations.map(d => el('option', { value: d.ref }, d.ref + ' - ' + d.organization)));
    const out = el('p');
    const update = () => {
      const d = r.data.donations.find(x => x.ref === sel.value);
      out.textContent = `${d.ref}: payment made, ${d.status.toLowerCase()}` + (d.beneficiary ? `, aid given to ${d.beneficiary}` : ', waiting for distribution');
    };
    sel.onchange = update; update();
    return el('div', null, el('label', { for: 'did' }, 'Choose a donation'), sel, el('div', { class: 'card', style: 'margin-top:14px' }, out));
  } },

  // ---------- NGO views ----------
  received: { roles: ['ngo'], title: 'Donations Received', load: async () => {
    const r = await ZT.request('/api/donations/received');
    if (!r.ok) return message(r.data.error);
    const box = el('div');
    const status = el('p', { class: 'msg', role: 'alert' });
    const rows = r.data.donations.map(d => {
      let action = '';
      if (d.status === 'Payment confirmed') {
        action = el('button', { class: 'btn alt small', type: 'button' }, 'Mark received');
        action.onclick = async () => {
          action.disabled = true;
          const res = await ZT.request('/api/donations/' + encodeURIComponent(d.ref) + '/status', { method: 'PATCH', body: { status: 'Received by NGO' } });
          if (!res.ok) { status.className = 'msg'; status.textContent = res.data.error; action.disabled = false; return; }
          show();   // reload the list from the server
        };
      }
      return [d.ref, d.donor, d.type, ZT.money(d.amount), d.status, d.beneficiary_name || '-', action];
    });
    box.append(rows.length ? table(['Ref', 'Donor', 'Type', 'Amount', 'Status', 'Beneficiary', ''], rows)
                           : el('p', { class: 'note' }, 'No donations received yet.'), status);
    return box;
  } },

  beneficiaries: { roles: ['ngo'], title: 'Beneficiaries', load: async () => {
    const r = await ZT.request('/api/beneficiaries');
    if (!r.ok) return message(r.data.error);
    const rows = r.data.beneficiaries.map(b => {
      const span = el('span', null, b.cnic);
      const btn = el('button', { class: 'btn alt small', type: 'button', style: 'margin-left:8px' }, 'Show');
      btn.onclick = async () => {
        if (btn.textContent === 'Hide') { span.textContent = b.cnic; btn.textContent = 'Show'; return; }
        const res = await ZT.request('/api/beneficiaries/' + encodeURIComponent(b.ref) + '/cnic');   // full CNIC only on request
        if (res.ok) { span.textContent = res.data.cnic; btn.textContent = 'Hide'; }
      };
      return [b.ref, b.name, el('span', null, span, btn), b.city, b.need, b.status];
    });
    return el('div', null,
      rows.length ? table(['Ref', 'Name', 'CNIC', 'City', 'Need', 'Status'], rows) : el('p', { class: 'note' }, 'No beneficiaries yet.'),
      el('p', { class: 'note' }, 'CNIC is masked by default and visible to your organization\'s representatives only. Donors never see it.'));
  } },

  distribute: { roles: ['ngo'], title: 'Record Aid Distribution', load: async () => {
    const [dr, br] = await Promise.all([ZT.request('/api/donations/received'), ZT.request('/api/beneficiaries')]);
    if (!dr.ok) return message(dr.data.error);
    if (!br.ok) return message(br.data.error);
    const ready = dr.data.donations.filter(d => d.status === 'Received by NGO');
    const verified = br.data.beneficiaries.filter(b => b.status === 'Verified');
    if (!ready.length) return el('p', { class: 'note' }, 'No donations are waiting for distribution. Mark donations as received first.');
    if (!verified.length) return el('p', { class: 'note' }, 'No verified beneficiaries yet.');

    const dsel = el('select', { id: 'dd' }, ...ready.map(d => el('option', { value: d.ref }, `${d.ref} - ${ZT.money(d.amount)} (${d.type})`)));
    const bsel = el('select', { id: 'pp' }, ...verified.map(b => el('option', { value: b.ref }, `${b.ref} - ${b.name}`)));
    const out = el('p', { class: 'msg', role: 'alert' });
    const form = el('form', { class: 'card', novalidate: '' },
      el('label', { for: 'dd' }, 'Donation'), dsel,
      el('label', { for: 'pp' }, 'Beneficiary'), bsel,
      out, el('button', { class: 'btn', type: 'submit' }, 'Record distribution'));
    form.onsubmit = async e => {
      e.preventDefault();
      const res = await ZT.request('/api/donations/' + encodeURIComponent(dsel.value) + '/status',
        { method: 'PATCH', body: { status: 'Distributed', beneficiaryRef: bsel.value } });
      if (!res.ok) { out.className = 'msg'; out.textContent = res.data.error; return; }
      await show();
      $('#content').prepend(message(res.data.message, true));
    };
    return form;
  } }
};

function deny() {
  const box = $('#content');
  box.textContent = '';
  box.append(el('div', { class: 'card denied' }, el('h3', null, 'Access Denied'), el('p', null, 'Your role does not have permission to use this function.')));
}

const menu = {
  donor: [['donations', 'My Donations'], ['track', 'Track Donation']],
  ngo: [['received', 'Donations Received'], ['beneficiaries', 'Beneficiaries'], ['distribute', 'Record Aid Distribution']]
};

let loading = 0;   // ignores slow answers when the user has already moved to another view
async function show() {
  const v = location.hash.slice(1), box = $('#content');
  box.textContent = '';
  if (!v) { box.append(el('p', { class: 'note' }, 'Choose an option above to get started.')); return; }
  // hasOwnProperty stops odd page names such as #constructor from reaching built-in object properties
  if (!Object.prototype.hasOwnProperty.call(views, v)) { box.append(el('p', { class: 'note' }, 'Page not found.')); return; }
  const view = views[v];
  if (!view.roles.includes(user.role)) return deny();
  const id = ++loading;
  box.append(el('p', { class: 'note' }, 'Loading...'));
  const content = await view.load();
  if (id !== loading) return;
  box.textContent = '';
  box.append(el('h2', null, view.title), content);
}

if (user && menu[user.role]) {
  $('#who').textContent = `Welcome, ${user.name} (${user.role === 'ngo' ? 'NGO Representative' + (user.organization ? ', ' + user.organization : '') : 'Donor'})`;
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

// Logout clears the screen, revokes the token on the server and empties browser storage
$('#logout').onclick = () => {
  $('#content').textContent = '';
  $('#menu').textContent = '';
  $('#who').textContent = '';
  ZT.logout();
};
