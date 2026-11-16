// Shared frontend helper (Activity 6): talks to the backend and manages the login session.
(function () {
  'use strict';
  const onPages = location.hostname.endsWith('github.io');
  const BASE = onPages ? String((window.ZT_CONFIG || {}).BACKEND_FOR_GITHUB_PAGES || '').replace(/\/+$/, '') : '';

  // Send a request to the backend. Always resolves to { ok, status, data } and never throws.
  async function request(path, { method = 'GET', body, form, auth = true, raw = false } = {}) {
    if (location.protocol === 'file:') {
      return { ok: false, status: 0, data: { error: 'Please open the site through the server: run "npm start" in the server folder, then go to http://localhost:3000' } };
    }
    if (onPages && !BASE) {
      return { ok: false, status: 0, data: { error: 'The backend address is not set yet. Add it in config.js.' } };
    }
    const headers = {};
    const token = sessionStorage.getItem('token');
    if (auth && token) headers.Authorization = 'Bearer ' + token;   // the JWT proves who is logged in
    let payload;
    if (form) payload = form;   // multipart (file upload); the browser sets the Content-Type
    else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }

    let res;
    try {
      res = await fetch(BASE + path, { method, headers, body: payload, credentials: 'omit' });
    } catch {
      return { ok: false, status: 0, data: { error: 'Cannot reach the server. Please check that it is running and try again.' } };
    }

    // Token missing/expired/revoked: end the session and go back to the login page
    if (res.status === 401 && auth && token) {
      sessionStorage.clear();
      location.replace('login.html?expired=1');
      return { ok: false, status: 401, data: { error: 'Your session has ended. Please log in again.' } };
    }
    if (raw && res.ok) return { ok: true, status: res.status, blob: await res.blob() };

    let data = {};
    try { data = await res.json(); } catch { /* not JSON */ }
    if (!data || typeof data !== 'object') data = {};
    if (!res.ok && typeof data.error !== 'string') data.error = 'Something went wrong. Please try again.';
    return { ok: res.ok, status: res.status, data };
  }

  // Only the JWT and the display name/role/organization are kept in this tab. Never the password.
  function user() {
    try { return JSON.parse(sessionStorage.getItem('user') || 'null'); } catch { return null; }
  }
  function saveSession(token, u) {
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('user', JSON.stringify({ name: u.name, role: u.role, organization: u.organization }));
  }
  function loggedIn() { return !!(sessionStorage.getItem('token') && user()); }

  // For pages that need a login: send visitors without a session to the login page
  function requireLogin() {
    if (!loggedIn()) { location.replace('login.html'); return null; }
    // Back button after logout shows a cached page; check again whenever the page is shown
    window.addEventListener('pageshow', () => { if (!loggedIn()) location.replace('login.html'); });
    return user();
  }

  // Logout: the server revokes the token, then everything in this tab is cleared
  async function logout() {
    if (sessionStorage.getItem('token')) await request('/api/auth/logout', { method: 'POST' });
    sessionStorage.clear();
    location.replace('login.html');
  }

  // Build elements safely: strings always become plain text, never HTML (XSS protection from Activity 5)
  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(k => n.setAttribute(k, attrs[k]));
    kids.forEach(k => { if (k !== null && k !== undefined) n.append(k); });
    return n;
  }

  const money = n => 'Rs. ' + Number(n).toLocaleString('en-US');

  window.ZT = { request, user, saveSession, loggedIn, requireLogin, logout, el, money };
})();
