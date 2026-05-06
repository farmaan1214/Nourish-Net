// ===== RECEIVER.JS =====

let currentUser = null;
let currentRequestFilter = 'all';
let activeTagFilter      = 'all';
let claimTargetDonationId = null;

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = requireAuth('receiver');
  if (!currentUser) return;

  try {
    const users = await getUsers();
    currentUser = users.find(u => u.id === currentUser.id) || currentUser;
    setCurrentUser(currentUser);
  } catch { /* use cached */ }

  document.getElementById('receiverWelcome').textContent = `Welcome, ${currentUser.name.split(' ')[0]}! 👋`;
  document.getElementById('receiverUserMini').innerHTML = `
    <div class="user-avatar" style="background:linear-gradient(135deg,#3B82F6,#60A5FA)">${currentUser.name.charAt(0)}</div>
    <div class="user-info"><strong>${currentUser.name}</strong><span>Receiver</span></div>`;

  if (currentUser.status === 'pending') {
    document.getElementById('approvalBanner').style.display = 'flex';
  }

  await renderOverview();
  await updateActiveRequestsBadge();
});

function showTab(name) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.getAttribute('onclick') && n.getAttribute('onclick').includes(`'${name}'`)) n.classList.add('active');
  });
  const titles = { overview: 'Dashboard', browse: 'Browse Donations', myrequests: 'My Requests', history: 'History', profile: 'Profile' };
  document.getElementById('topBarTitle').textContent = titles[name] || name;

  if (name === 'browse')      renderBrowse();
  if (name === 'myrequests')  renderMyRequests();
  if (name === 'history')     renderHistory();
  if (name === 'profile')     renderReceiverProfile();
}

async function updateActiveRequestsBadge() {
  try {
    const active = (await getRequests()).filter(r => r.receiverId === currentUser.id && r.status !== 'completed').length;
    const badge  = document.getElementById('activeRequestsBadge');
    if (badge) { badge.textContent = active; badge.style.display = active > 0 ? 'inline' : 'none'; }
  } catch { }
}

async function renderOverview() {
  let myRequests = [], donations = [];
  try {
    [myRequests, donations] = await Promise.all([getRequests(), getDonations()]);
    myRequests = myRequests.filter(r => r.receiverId === currentUser.id);
  } catch { return; }

  const available = donations.filter(d => d.status === 'available').length;

  document.getElementById('receiverStats').innerHTML = [
    { icon: '🍱', value: available,                                               label: 'Available Now',  change: 'Ready to request' },
    { icon: '📋', value: myRequests.length,                                       label: 'Total Requests', change: 'All time' },
    { icon: '✅', value: myRequests.filter(r => r.status === 'completed').length, label: 'Received',       change: 'Completed' },
    { icon: '⏳', value: myRequests.filter(r => r.status === 'pending' || r.status === 'confirmed').length, label: 'In Progress', change: 'Active requests' },
  ].map(s => `
    <div class="stat-card">
      <div class="stat-card-icon">${s.icon}</div>
      <div class="stat-card-value">${s.value}</div>
      <div class="stat-card-label">${s.label}</div>
      <div class="stat-card-change up">${s.change}</div>
    </div>`).join('');

  const availNow = donations.filter(d => d.status === 'available').slice(0, 3);
  document.getElementById('availableNowList').innerHTML = availNow.length === 0
    ? '<div class="empty-state"><div class="empty-icon">🍱</div><p>No donations available right now</p></div>'
    : availNow.map(d => donationCardHTML(d, true)).join('');

  const activeReqs = myRequests.filter(r => r.status !== 'completed').slice(0, 4);
  document.getElementById('myActiveRequests').innerHTML = activeReqs.length === 0
    ? '<div class="empty-state"><div class="empty-icon">📋</div><p>No active requests</p></div>'
    : activeReqs.map(r => `
      <div class="pending-mini-item" style="padding:12px 0">
        <div class="pending-mini-avatar">🍱</div>
        <div>
          <div class="pending-mini-name">${r.foodName}</div>
          <div class="pending-mini-time">${statusBadge(r.status)}</div>
        </div>
      </div>`).join('');
}

function donationCardHTML(d, compact = false) {
  const urgency      = timeUntil(d.expiry);
  const diff         = new Date(d.expiry) - Date.now();
  const urgencyClass = diff < 2 * 3600000 ? 'urgency-red' : diff < 6 * 3600000 ? 'urgency-amber' : 'urgency-green';
  const urgencyIcon  = diff < 2 * 3600000 ? '🔴' : diff < 6 * 3600000 ? '🟡' : '🟢';
  const isApproved   = currentUser.status === 'approved';

  if (compact) {
    return `
      <div class="donation-item" style="cursor:pointer" onclick="${isApproved ? `openClaimModal('${d.id}')` : ''}">
        <div class="donation-item-header">
          <div class="donation-item-title">${d.foodName}</div>
          <div class="${urgencyClass} urgency-indicator">${urgencyIcon} ${urgency}</div>
        </div>
        <div class="donation-item-meta">
          <span>⚖ ${d.qty} ${d.unit}${d.serves ? ` · ~${d.serves} servings` : ''}</span>
          <span>📍 ${d.address}</span>
          <span>👤 By ${d.donorName}</span>
        </div>
        <div class="donation-item-footer">
          <div class="donation-tags">${(d.tags || []).map(t => `<span class="donation-tag">${t}</span>`).join('')}</div>
          ${isApproved ? `<button class="btn-claim" onclick="event.stopPropagation();openClaimModal('${d.id}')">Request</button>` : `<span class="badge badge-amber">Pending Approval</span>`}
        </div>
      </div>`;
  }

  return `
    <div class="donation-card" onclick="${isApproved ? `openClaimModal('${d.id}')` : ''}">
      <div class="donation-card-header">
        <div class="donation-card-title">${d.foodName}</div>
        <span class="badge badge-green">🟢 Available</span>
      </div>
      <div class="donation-card-meta">
        <span>🏷 ${d.category}</span>
        <span>⚖ ${d.qty} ${d.unit}${d.serves ? ` · ~${d.serves} servings` : ''}</span>
        <span>👤 By ${d.donorName}</span>
        <span>📍 ${d.address.substring(0, 40)}...</span>
      </div>
      <div style="margin-bottom:10px">${(d.tags || []).map(t => `<span class="donation-tag">${t}</span>`).join('')}</div>
      <div class="donation-card-footer">
        <div class="urgency-indicator ${urgencyClass}">${urgencyIcon} ${urgency}</div>
        ${isApproved ? `<button class="btn-claim" onclick="event.stopPropagation();openClaimModal('${d.id}')">Request →</button>` : `<span class="badge badge-amber">Pending Approval</span>`}
      </div>
    </div>`;
}

async function renderBrowse() {
  const container = document.getElementById('browseDonationsList');
  container.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">⏳</div><p>Loading donations…</p></div>';
  try {
    const q         = (document.getElementById('browseSearch')?.value || '').toLowerCase();
    const catFilter = document.getElementById('categoryFilter')?.value || '';
    let   donations = (await getDonations()).filter(d => d.status === 'available');
    if (q)                       donations = donations.filter(d => d.foodName.toLowerCase().includes(q) || d.category.toLowerCase().includes(q) || d.address.toLowerCase().includes(q));
    if (catFilter)               donations = donations.filter(d => d.category === catFilter);
    if (activeTagFilter !== 'all') donations = donations.filter(d => (d.tags || []).includes(activeTagFilter));
    donations.sort((a, b) => new Date(a.expiry) - new Date(b.expiry));
    container.innerHTML = donations.length === 0
      ? '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🔍</div><p>No donations match your search</p></div>'
      : donations.map(d => donationCardHTML(d, false)).join('');
  } catch {
    container.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">⚠️</div><p>Failed to load donations.</p></div>';
  }
}

function toggleTagFilter(btn, tag) {
  activeTagFilter = tag;
  document.querySelectorAll('.tag-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderBrowse();
}

async function openClaimModal(donationId) {
  if (currentUser.status !== 'approved') {
    showToast('Your account is pending admin approval.', 'error');
    return;
  }
  try {
    const [donations, requests] = await Promise.all([getDonations(), getRequests()]);
    const d = donations.find(d => d.id === donationId);
    if (!d || d.status !== 'available') { showToast('This donation is no longer available.', 'error'); return; }
    const existing = requests.find(r => r.donationId === donationId && r.receiverId === currentUser.id);
    if (existing) { showToast('You have already requested this donation.', 'info'); return; }

    claimTargetDonationId = donationId;
    document.getElementById('claimModalBody').innerHTML = `
      <div class="detail-row"><div class="detail-label">Food</div><div class="detail-value"><strong>${d.foodName}</strong></div></div>
      <div class="detail-row"><div class="detail-label">Category</div><div class="detail-value">${d.category}</div></div>
      <div class="detail-row"><div class="detail-label">Quantity</div><div class="detail-value">${d.qty} ${d.unit}</div></div>
      <div class="detail-row"><div class="detail-label">Serves</div><div class="detail-value">~${d.serves || 'N/A'} people</div></div>
      <div class="detail-row"><div class="detail-label">Donor</div><div class="detail-value">${d.donorName}</div></div>
      <div class="detail-row"><div class="detail-label">Pickup From</div><div class="detail-value">${formatDateTime(d.pickupFrom)}</div></div>
      <div class="detail-row"><div class="detail-label">Pickup Until</div><div class="detail-value">${formatDateTime(d.pickupUntil)}</div></div>
      <div class="detail-row"><div class="detail-label">Address</div><div class="detail-value">${d.address}</div></div>
      ${d.notes ? `<div class="detail-row"><div class="detail-label">Notes</div><div class="detail-value">${d.notes}</div></div>` : ''}
      <div class="detail-row"><div class="detail-label">Tags</div><div class="detail-value">${(d.tags || []).map(t => `<span class="donation-tag">${t}</span>`).join(' ') || '—'}</div></div>
      <div style="background:var(--green-pale);border-radius:10px;padding:12px;margin-top:12px;font-size:0.88rem;color:var(--green)">
        ✓ Requesting this will notify the donor. Please ensure your organisation is ready for pickup.
      </div>`;
    document.getElementById('claimModal').classList.add('open');
  } catch (err) {
    showToast(err.message || 'Error loading donation.', 'error');
  }
}

async function confirmClaim() {
  const btn = document.querySelector('#claimModal .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Requesting…'; }
  try {
    await claimDonation(claimTargetDonationId, currentUser.id, currentUser.name);
    closeModal('claimModal');
    showToast('✓ Request sent! Donor has been notified.', 'success');
    await updateActiveRequestsBadge();
    await renderOverview();
    setTimeout(() => showTab('myrequests'), 1500);
  } catch (err) {
    showToast(err.message || 'Failed to claim donation.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Confirm Request'; }
  }
}

function filterRequests(filter) {
  currentRequestFilter = filter;
  document.querySelectorAll('#tab-myrequests .filter-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  renderMyRequests();
}

async function renderMyRequests() {
  const container = document.getElementById('myRequestsList');
  container.innerHTML = '<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading…</p></div>';
  try {
    let [requests, donations] = await Promise.all([getRequests(), getDonations()]);
    requests = requests.filter(r => r.receiverId === currentUser.id);
    if (currentRequestFilter !== 'all') requests = requests.filter(r => r.status === currentRequestFilter);
    requests.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));

    container.innerHTML = requests.length === 0
      ? `<div class="empty-state"><div class="empty-icon">📋</div><p>No ${currentRequestFilter !== 'all' ? currentRequestFilter : ''} requests</p></div>`
      : requests.map(r => {
          const d = donations.find(d => d.id === r.donationId);
          return `
            <div class="donation-item">
              <div class="donation-item-header">
                <div><div class="donation-item-title">${r.foodName}</div><div style="font-size:0.8rem;color:var(--text-3)">From ${r.donorName}</div></div>
                ${statusBadge(r.status)}
              </div>
              <div class="donation-item-meta">
                ${d ? `<span>⚖ ${d.qty} ${d.unit}</span><span>📍 ${d.address}</span>` : ''}
                <span>📅 Requested ${timeAgo(r.requestedAt)}</span>
                ${r.pickupTime ? `<span>🚚 Pickup: ${formatDateTime(r.pickupTime)}</span>` : ''}
              </div>
              ${r.status === 'confirmed' ? `
                <div class="donation-item-footer">
                  <div style="font-size:0.85rem;color:var(--green);font-weight:600">✓ Donor confirmed — proceed to pickup address</div>
                  <button class="btn-sm btn-success" onclick="markComplete('${r.id}')">Mark Received</button>
                </div>` : ''}
            </div>`;
        }).join('');
  } catch {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>Failed to load requests.</p></div>';
  }
}

async function markComplete(requestId) {
  try {
    await completeRequest(requestId);
    showToast('✓ Marked as received!', 'success');
    await renderMyRequests();
    await updateActiveRequestsBadge();
  } catch (err) {
    showToast(err.message || 'Failed to mark as complete.', 'error');
  }
}

async function renderHistory() {
  const container = document.getElementById('receivedHistoryTable');
  container.innerHTML = '<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading…</p></div>';
  try {
    const requests = (await getRequests()).filter(r => r.receiverId === currentUser.id);
    container.innerHTML = requests.length === 0
      ? '<div class="empty-state"><div class="empty-icon">📦</div><p>No history yet</p></div>'
      : `<table class="data-table">
          <thead><tr><th>Food</th><th>Donor</th><th>Status</th><th>Requested</th><th>Pickup</th></tr></thead>
          <tbody>${requests.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt)).map(r => `
            <tr>
              <td><strong>${r.foodName}</strong></td>
              <td>${r.donorName}</td>
              <td>${statusBadge(r.status)}</td>
              <td>${formatDate(r.requestedAt)}</td>
              <td>${r.pickupTime ? formatDateTime(r.pickupTime) : '—'}</td>
            </tr>`).join('')}
          </tbody></table>`;
  } catch {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>Failed to load history.</p></div>';
  }
}

async function renderReceiverProfile() {
  let requestCount = 0;
  try { requestCount = (await getRequests()).filter(r => r.receiverId === currentUser.id).length; } catch { }
  document.getElementById('receiverProfileContent').innerHTML = `
    <div class="profile-avatar-big" style="background:linear-gradient(135deg,#3B82F6,#60A5FA)">${currentUser.name.charAt(0)}</div>
    <div class="profile-field"><label>Organisation Name</label><p>${currentUser.name}</p></div>
    <div class="profile-field"><label>Email</label><p>${currentUser.email}</p></div>
    <div class="profile-field"><label>Phone</label><p>${currentUser.phone || '—'}</p></div>
    <div class="profile-field"><label>Address</label><p>${currentUser.address || '—'}</p></div>
    <div class="profile-field"><label>Org Type</label><p>${currentUser.orgType || 'N/A'}</p></div>
    <div class="profile-field"><label>Account Status</label><p>${statusBadge(currentUser.status)}</p></div>
    <div class="profile-field"><label>Member Since</label><p>${formatDate(currentUser.joinDate)}</p></div>
    <div class="profile-field"><label>Total Requests</label><p>${requestCount}</p></div>`;
}
