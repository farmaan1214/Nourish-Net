// ===== ADMIN.JS =====

let currentApprovalFilter = 'pending';
let currentDonationFilter = 'all';
let selectedReceiverId    = null;

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth('admin');
  document.getElementById('dashDate').textContent = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  await renderOverview();
  await updateApprovalBadge();
});

function showTab(name) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.getAttribute('onclick') && n.getAttribute('onclick').includes(`'${name}'`)) n.classList.add('active');
  });
  document.getElementById('topBarTitle').textContent = {
    overview: 'Overview', approvals: 'Receiver Approvals',
    donors: 'All Donors', receivers: 'All Receivers',
    donations: 'All Donations', reports: 'Reports'
  }[name] || name;

  if (name === 'approvals') renderApprovals();
  if (name === 'donors')    renderDonorsTable();
  if (name === 'receivers') renderReceiversTable();
  if (name === 'donations') renderDonationsTable();
  if (name === 'reports')   renderReports();
}

async function updateApprovalBadge() {
  try {
    const users  = await getUsers();
    const pending = users.filter(u => u.role === 'receiver' && u.status === 'pending').length;
    const badge  = document.getElementById('approvalBadge');
    badge.textContent = pending;
    badge.style.display = pending > 0 ? 'inline' : 'none';
    const notifDot = document.getElementById('notifDot');
    if (notifDot) notifDot.style.display = pending > 0 ? 'block' : 'none';
  } catch { }
}

async function renderOverview() {
  let users = [], donations = [], requests = [];
  try {
    [users, donations, requests] = await Promise.all([getUsers(), getDonations(), getRequests()]);
  } catch {
    showAdminToast('⚠️ Failed to load data. Is the server running?', 'info');
    return;
  }

  const donors    = users.filter(u => u.role === 'donor'    && u.status === 'approved');
  const receivers = users.filter(u => u.role === 'receiver' && u.status === 'approved');
  const pending   = users.filter(u => u.role === 'receiver' && u.status === 'pending');
  const totalServed = donations.reduce((a, d) => a + (d.serves || 0), 0);

  document.getElementById('adminStatsGrid').innerHTML = [
    { icon: '🤝', value: donors.length,             label: 'Active Donors',      change: '+3 this month', dir: 'up' },
    { icon: '🏠', value: receivers.length,           label: 'Approved NGOs',      change: '+2 this month', dir: 'up' },
    { icon: '🍱', value: donations.length,           label: 'Total Donations',    change: '+8 today',      dir: 'up' },
    { icon: '👥', value: totalServed.toLocaleString(), label: 'People Served',    change: 'All time',      dir: 'up' },
    { icon: '⏳', value: pending.length,             label: 'Pending Approvals',  change: 'Needs review',  dir: pending.length > 0 ? 'down' : 'up' },
  ].map(s => `
    <div class="stat-card">
      <div class="stat-card-icon">${s.icon}</div>
      <div class="stat-card-value">${s.value}</div>
      <div class="stat-card-label">${s.label}</div>
      <div class="stat-card-change ${s.dir}">${s.change}</div>
    </div>`).join('');

  // Recent donations
  const recent = [...donations].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);
  document.getElementById('recentDonationsTable').innerHTML = `
    <table class="data-table">
      <thead><tr><th>Food</th><th>Donor</th><th>Qty</th><th>Status</th><th>Listed</th></tr></thead>
      <tbody>${recent.map(d => `
        <tr>
          <td><strong>${d.foodName}</strong><br/><small style="color:var(--text-3)">${d.category}</small></td>
          <td>${d.donorName}</td>
          <td>${d.qty} ${d.unit}</td>
          <td>${statusBadge(d.status)}</td>
          <td>${timeAgo(d.createdAt)}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;

  // Pending approvals
  const pendingHtml = pending.length === 0
    ? '<div class="empty-state"><div class="empty-icon">✅</div><p>No pending approvals</p></div>'
    : pending.map(u => `
      <div class="pending-mini-item">
        <div class="pending-mini-avatar">🏠</div>
        <div>
          <div class="pending-mini-name">${u.name}</div>
          <div class="pending-mini-time">${formatDate(u.joinDate)}</div>
        </div>
        <div class="pending-mini-actions">
          <button class="mini-approve" onclick="quickApprove('${u.id}')">✓</button>
          <button class="mini-reject"  onclick="quickReject('${u.id}')">✗</button>
        </div>
      </div>`).join('');
  document.getElementById('pendingList').innerHTML = pendingHtml;

  renderCategoryChart(donations);
  renderMonthlyChart(donations);
}

function renderCategoryChart(donations) {
  const cats   = {};
  donations.forEach(d => { cats[d.category] = (cats[d.category] || 0) + 1; });
  const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max    = Math.max(...sorted.map(([, v]) => v), 1);
  document.getElementById('categoryChart').innerHTML = `
    <div class="bar-chart">
      ${sorted.map(([label, val]) => `
        <div class="bar-row">
          <div class="bar-label">${label.replace(' Products', '').substring(0, 12)}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${(val / max) * 100}%"></div></div>
          <div class="bar-count">${val}</div>
        </div>`).join('')}
    </div>`;
}

function renderMonthlyChart(donations) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const vals   = [8, 14, 11, 19, 16, donations.length];
  const max    = Math.max(...vals);
  document.getElementById('monthlyChart').innerHTML = `
    <div class="bar-chart">
      ${months.map((m, i) => `
        <div class="bar-row">
          <div class="bar-label">${m}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${(vals[i] / max) * 100}%;background:linear-gradient(90deg,#F59E0B,#FCD34D)"></div></div>
          <div class="bar-count">${vals[i]}</div>
        </div>`).join('')}
    </div>`;
}

// ── APPROVALS ──────────────────────────────────────────────────────────────────
function filterApprovals(filter) {
  currentApprovalFilter = filter;
  document.querySelectorAll('#tab-approvals .filter-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  renderApprovals();
}

async function renderApprovals() {
  const container = document.getElementById('approvalsList');
  container.innerHTML = '<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading…</p></div>';
  try {
    const users = (await getUsers()).filter(u => u.role === 'receiver' && u.status === currentApprovalFilter);
    if (users.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">${currentApprovalFilter === 'pending' ? '📭' : '✅'}</div><p>No ${currentApprovalFilter} applications</p></div>`;
      return;
    }
    container.innerHTML = users.map(u => `
      <div class="approval-item">
        <div class="approval-avatar">🏠</div>
        <div class="approval-info">
          <div class="approval-name">${u.name}</div>
          <div class="approval-meta">
            <span>✉ ${u.email}</span>
            <span>📱 ${u.phone}</span>
            <span>📅 Applied ${formatDate(u.joinDate)}</span>
            ${u.orgType ? `<span>🏷 ${u.orgType}</span>` : ''}
          </div>
        </div>
        <div style="margin-right:8px">${statusBadge(u.status)}</div>
        <div class="approval-actions">
          <button class="btn-sm btn-outline" onclick="openApprovalModal('${u.id}')">View</button>
          ${u.status === 'pending' ? `
            <button class="btn-sm btn-danger"  onclick="quickReject('${u.id}')">Reject</button>
            <button class="btn-sm btn-success" onclick="quickApprove('${u.id}')">Approve</button>` : ''}
        </div>
      </div>`).join('');
  } catch {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>Failed to load approvals.</p></div>';
  }
}

async function openApprovalModal(userId) {
  try {
    const users = await getUsers();
    const u = users.find(u => u.id === userId);
    if (!u) return;
    selectedReceiverId = userId;
    document.getElementById('approvalModalBody').innerHTML = `
      <div class="detail-row"><div class="detail-label">Name</div><div class="detail-value"><strong>${u.name}</strong></div></div>
      <div class="detail-row"><div class="detail-label">Email</div><div class="detail-value">${u.email}</div></div>
      <div class="detail-row"><div class="detail-label">Phone</div><div class="detail-value">${u.phone}</div></div>
      <div class="detail-row"><div class="detail-label">Address</div><div class="detail-value">${u.address}</div></div>
      <div class="detail-row"><div class="detail-label">Org Type</div><div class="detail-value">${u.orgType || 'N/A'}</div></div>
      <div class="detail-row"><div class="detail-label">Applied</div><div class="detail-value">${formatDate(u.joinDate)}</div></div>
      <div class="detail-row"><div class="detail-label">Status</div><div class="detail-value">${statusBadge(u.status)}</div></div>`;
    const footer = document.querySelector('#approvalModal .modal-footer');
    footer.style.display = u.status === 'pending' ? 'flex' : 'none';
    document.getElementById('approvalModal').classList.add('open');
  } catch { showAdminToast('Failed to load user.', 'info'); }
}

async function approveReceiver() {
  try { await updateUserStatus(selectedReceiverId, 'approved'); } catch (e) { showAdminToast('Error: ' + e.message, 'info'); return; }
  closeModal('approvalModal'); renderApprovals(); renderOverview(); updateApprovalBadge();
  showAdminToast('✓ Receiver approved!', 'success');
}

async function rejectReceiver() {
  try { await updateUserStatus(selectedReceiverId, 'rejected'); } catch (e) { showAdminToast('Error: ' + e.message, 'info'); return; }
  closeModal('approvalModal'); renderApprovals(); renderOverview(); updateApprovalBadge();
  showAdminToast('Receiver rejected.', 'info');
}

async function quickApprove(id) {
  try { await updateUserStatus(id, 'approved'); } catch (e) { showAdminToast('Error: ' + e.message, 'info'); return; }
  await renderOverview(); await renderApprovals(); await updateApprovalBadge();
  showAdminToast('✓ Approved!', 'success');
}

async function quickReject(id) {
  try { await updateUserStatus(id, 'rejected'); } catch (e) { showAdminToast('Error: ' + e.message, 'info'); return; }
  await renderOverview(); await renderApprovals(); await updateApprovalBadge();
  showAdminToast('Rejected.', 'info');
}

// ── DONORS TABLE ───────────────────────────────────────────────────────────────
async function renderDonorsTable() {
  const wrap = document.getElementById('donorsTableWrap');
  wrap.innerHTML = '<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading…</p></div>';
  try {
    const q    = (document.getElementById('donorSearch')?.value || '').toLowerCase();
    const [users, donations] = await Promise.all([getUsers(), getDonations()]);
    const donors = users.filter(u => u.role === 'donor' && (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)));
    wrap.innerHTML = donors.length === 0
      ? '<div class="empty-state"><div class="empty-icon">🤝</div><p>No donors found</p></div>'
      : `<table class="data-table">
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Status</th><th>Joined</th><th>Donations</th></tr></thead>
          <tbody>${donors.map(u => `
            <tr>
              <td><strong>${u.name}</strong></td>
              <td>${u.email}</td>
              <td>${u.phone}</td>
              <td>${statusBadge(u.status)}</td>
              <td>${formatDate(u.joinDate)}</td>
              <td>${donations.filter(d => d.donorId === u.id).length}</td>
            </tr>`).join('')}
          </tbody></table>`;
  } catch {
    wrap.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>Failed to load donors.</p></div>';
  }
}

// ── RECEIVERS TABLE ────────────────────────────────────────────────────────────
async function renderReceiversTable() {
  const wrap = document.getElementById('receiversTableWrap');
  wrap.innerHTML = '<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading…</p></div>';
  try {
    const q         = (document.getElementById('receiverSearch')?.value || '').toLowerCase();
    const users     = await getUsers();
    const receivers = users.filter(u => u.role === 'receiver' && (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)));
    wrap.innerHTML = receivers.length === 0
      ? '<div class="empty-state"><div class="empty-icon">🏠</div><p>No receivers found</p></div>'
      : `<table class="data-table">
          <thead><tr><th>Organisation</th><th>Email</th><th>Phone</th><th>Status</th><th>Joined</th></tr></thead>
          <tbody>${receivers.map(u => `
            <tr>
              <td><strong>${u.name}</strong>${u.orgType ? `<br/><small style="color:var(--text-3)">${u.orgType}</small>` : ''}</td>
              <td>${u.email}</td>
              <td>${u.phone}</td>
              <td>${statusBadge(u.status)}</td>
              <td>${formatDate(u.joinDate)}</td>
            </tr>`).join('')}
          </tbody></table>`;
  } catch {
    wrap.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>Failed to load receivers.</p></div>';
  }
}

// ── DONATIONS TABLE ────────────────────────────────────────────────────────────
function filterDonations(filter) {
  currentDonationFilter = filter;
  document.querySelectorAll('#tab-donations .filter-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  renderDonationsTable();
}

async function renderDonationsTable() {
  const wrap = document.getElementById('donationsTableWrap');
  wrap.innerHTML = '<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading…</p></div>';
  try {
    let donations = await getDonations();
    if (currentDonationFilter !== 'all') donations = donations.filter(d => d.status === currentDonationFilter);
    wrap.innerHTML = donations.length === 0
      ? '<div class="empty-state"><div class="empty-icon">🍱</div><p>No donations found</p></div>'
      : `<table class="data-table">
          <thead><tr><th>Food</th><th>Donor</th><th>Qty</th><th>Serves</th><th>Expiry</th><th>Status</th><th>Listed</th></tr></thead>
          <tbody>${donations.map(d => `
            <tr>
              <td><strong>${d.foodName}</strong><br/><small style="color:var(--text-3)">${d.category}</small></td>
              <td>${d.donorName}</td>
              <td>${d.qty} ${d.unit}</td>
              <td>${d.serves || '-'}</td>
              <td>${formatDateTime(d.expiry)}</td>
              <td>${statusBadge(d.status)}</td>
              <td>${timeAgo(d.createdAt)}</td>
            </tr>`).join('')}
          </tbody></table>`;
  } catch {
    wrap.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>Failed to load donations.</p></div>';
  }
}

// ── REPORTS ────────────────────────────────────────────────────────────────────
async function renderReports() {
  document.getElementById('reportsContent').innerHTML = '<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading…</p></div>';
  try {
    const [donations, users, requests] = await Promise.all([getDonations(), getUsers(), getRequests()]);
    const totalServed     = donations.reduce((a, d) => a + (d.serves || 0), 0);
    const completed       = donations.filter(d => d.status === 'completed').length;
    const completionRate  = donations.length ? Math.round((completed / donations.length) * 100) : 0;

    document.getElementById('reportsContent').innerHTML = `
      <div class="report-card">
        <h3>Platform Summary</h3>
        <div class="bar-chart">
          ${[['Total Users', users.length, users.length], ['Donors', users.filter(u => u.role === 'donor').length, users.length], ['Receivers', users.filter(u => u.role === 'receiver').length, users.length], ['Pending', users.filter(u => u.status === 'pending').length, users.length]].map(([label, val, max]) => `
            <div class="bar-row">
              <div class="bar-label">${label}</div>
              <div class="bar-track"><div class="bar-fill" style="width:${max ? (val / max) * 100 : 0}%"></div></div>
              <div class="bar-count">${val}</div>
            </div>`).join('')}
        </div>
      </div>
      <div class="report-card">
        <h3>Donation Performance</h3>
        <div class="bar-chart">
          ${[['Available', donations.filter(d => d.status === 'available').length, donations.length], ['Claimed', donations.filter(d => d.status === 'claimed').length, donations.length], ['Completed', completed, donations.length]].map(([label, val, max]) => `
            <div class="bar-row">
              <div class="bar-label">${label}</div>
              <div class="bar-track"><div class="bar-fill" style="width:${max ? (val / max) * 100 : 0}%"></div></div>
              <div class="bar-count">${val}</div>
            </div>`).join('')}
        </div>
      </div>
      <div class="report-card">
        <h3>Key Metrics</h3>
        ${[['🍽 Total Meals Served', totalServed.toLocaleString()], ['✅ Completion Rate', completionRate + '%'], ['📦 Total Requests', requests.length], ['📅 Avg Donations/Week', Math.round(donations.length / 4)]].map(([label, val]) => `
          <div class="pending-mini-item">
            <div class="pending-mini-name">${label}</div>
            <div style="margin-left:auto;font-family:var(--font-display);font-size:1.1rem;font-weight:900">${val}</div>
          </div>`).join('')}
      </div>
      <div class="report-card">
        <h3>Top Donors</h3>
        ${users.filter(u => u.role === 'donor').sort((a, b) =>
          donations.filter(d => d.donorId === b.id).length - donations.filter(d => d.donorId === a.id).length
        ).slice(0, 4).map((u, i) => `
          <div class="pending-mini-item">
            <div class="pending-mini-avatar" style="background:var(--green-pale);">${['🥇', '🥈', '🥉', '🏅'][i]}</div>
            <div>
              <div class="pending-mini-name">${u.name}</div>
              <div class="pending-mini-time">${donations.filter(d => d.donorId === u.id).length} donations</div>
            </div>
          </div>`).join('')}
      </div>`;
  } catch {
    document.getElementById('reportsContent').innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>Failed to load reports.</p></div>';
  }
}

function toggleNotifs() {
  document.getElementById('notifDropdown').classList.toggle('open');
}

function showAdminToast(msg, type = 'success') {
  const existing = document.getElementById('adminToast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.id = 'adminToast';
  el.className = 'toast show ' + type;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// Add toast styles dynamically
const toastStyle = document.createElement('style');
toastStyle.textContent = '.toast{position:fixed;bottom:32px;right:32px;padding:14px 22px;border-radius:10px;font-weight:500;z-index:9999;color:white;font-family:var(--font-body)}.toast.success{background:var(--green)}.toast.info{background:var(--blue)}';
document.head.appendChild(toastStyle);
