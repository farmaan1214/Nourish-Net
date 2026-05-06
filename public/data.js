// ===== DATA.JS — API-backed shared data store =====
// All data is persisted in the SQLite backend via REST API calls.
// localStorage is used ONLY for the current session user.

const API = '/api';

const KEYS = {
  CURRENT_USER: 'nn_current_user',
};

// ─── Session helpers ─────────────────────────────────────────────────────────
function getCurrentUser() {
  return JSON.parse(localStorage.getItem(KEYS.CURRENT_USER) || 'null');
}
function setCurrentUser(u) {
  localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(u));
}
function logout() {
  localStorage.removeItem(KEYS.CURRENT_USER);
  window.location.href = 'index.html';
}
function requireAuth(role) {
  const u = getCurrentUser();
  if (!u) { window.location.href = 'index.html'; return null; }
  if (role && u.role !== role) { window.location.href = u.role + '.html'; return null; }
  return u;
}

// ─── Generic API helpers ─────────────────────────────────────────────────────
async function apiGet(endpoint) {
  const res = await fetch(API + endpoint);
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || res.statusText); }
  return res.json();
}
async function apiPost(endpoint, body) {
  const res = await fetch(API + endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || res.statusText); }
  return res.json();
}
async function apiPatch(endpoint, body) {
  const res = await fetch(API + endpoint, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || res.statusText); }
  return res.json();
}

// ─── Auth API ─────────────────────────────────────────────────────────────────
async function loginUser(email, password) {
  return apiPost('/login', { email, password });
}
async function registerUser(userData) {
  return apiPost('/register', userData);
}

// ─── Users API ────────────────────────────────────────────────────────────────
async function getUsers() {
  return apiGet('/users');
}
async function updateUserStatus(id, status) {
  return apiPatch(`/users/${id}/status`, { status });
}

// ─── Donations API ───────────────────────────────────────────────────────────
async function getDonations() {
  return apiGet('/donations');
}
async function createDonation(donation) {
  return apiPost('/donations', donation);
}
async function claimDonation(donationId, receiverId, receiverName) {
  return apiPatch(`/donations/${donationId}/claim`, { receiverId, receiverName });
}
async function completeDonation(donationId) {
  return apiPatch(`/donations/${donationId}/complete`, {});
}

// ─── Requests API ─────────────────────────────────────────────────────────────
async function getRequests() {
  return apiGet('/requests');
}
async function completeRequest(requestId) {
  return apiPatch(`/requests/${requestId}/complete`, {});
}

// ─── UI Utilities ────────────────────────────────────────────────────────────
function uid()  { return 'u' + Date.now() + Math.random().toString(36).substr(2, 4); }
function did()  { return 'd' + Date.now() + Math.random().toString(36).substr(2, 4); }
function rid()  { return 'r' + Date.now() + Math.random().toString(36).substr(2, 4); }

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

function timeUntil(dateStr) {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff < 0) return 'Expired';
  const m = Math.floor(diff / 60000);
  if (m < 60) return m + 'm left';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h left';
  return Math.floor(h / 24) + 'd left';
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ' ' +
    d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function statusBadge(status) {
  const map = {
    available:  ['badge-green', '🟢 Available'],
    claimed:    ['badge-amber', '🟡 Claimed'],
    completed:  ['badge-gray',  '✓ Completed'],
    expired:    ['badge-red',   '✗ Expired'],
    pending:    ['badge-amber', '⏳ Pending'],
    approved:   ['badge-green', '✓ Approved'],
    rejected:   ['badge-red',   '✗ Rejected'],
    confirmed:  ['badge-blue',  '✓ Confirmed'],
    admin:      ['badge-blue',  '👨‍💼 Admin'],
    donor:      ['badge-green', '🤝 Donor'],
    receiver:   ['badge-blue',  '🏠 Receiver'],
  };
  const [cls, label] = map[status] || ['badge-gray', status];
  return `<span class="badge ${cls}">${label}</span>`;
}

function togglePwd(btn) {
  const input = btn.previousElementSibling;
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
  btn.textContent = input.type === 'password' ? '👁' : '🙈';
}

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => { t.className = 'toast'; }, 3500);
}

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  if (window.innerWidth < 768) {
    sb.classList.toggle('mobile-open');
  } else {
    sb.classList.toggle('collapsed');
  }
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// ─── Connectivity banner ─────────────────────────────────────────────────────
// Show a small non-blocking banner if the server is unreachable
(async function checkServerConnectivity() {
  try {
    const data = await fetch('/api/health', { signal: AbortSignal.timeout(4000) });
    if (!data.ok) throw new Error();
    console.log('✅ Backend connected');
  } catch {
    console.warn('⚠️ Backend unreachable — ensure the server is running on http://localhost:3000');
    const banner = document.createElement('div');
    banner.id = 'server-offline-banner';
    banner.innerHTML = `
      <span>⚠️ <strong>Server Offline</strong> — Backend not detected on <code>localhost:3000</code>.
      Run <code>node server.js</code> to start the server.</span>
      <button onclick="this.parentElement.remove()">✕</button>`;
    banner.style.cssText = `position:fixed;top:0;left:0;right:0;z-index:99999;background:#FEF3C7;color:#92400E;
      padding:10px 20px;font-size:0.85rem;display:flex;align-items:center;justify-content:center;gap:12px;
      border-bottom:2px solid #F59E0B;font-family:system-ui,sans-serif;`;
    banner.querySelector('button').style.cssText = `background:none;border:none;cursor:pointer;font-size:1rem;padding:0 4px;color:#92400E;`;
    document.body.prepend(banner);
  }
})();
