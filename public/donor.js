// ===== DONOR.JS =====

let currentDonorFilter = 'all';
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = requireAuth('donor');
  if (!currentUser) return;

  // Refresh user data from server
  try {
    const users = await getUsers();
    currentUser = users.find(u => u.id === currentUser.id) || currentUser;
    setCurrentUser(currentUser);
  } catch { /* use cached user if offline */ }

  document.getElementById('donorWelcome').textContent = `Welcome back, ${currentUser.name.split(' ')[0]}! 👋`;
  document.getElementById('donorUserMini').innerHTML = `
    <div class="user-avatar">${currentUser.name.charAt(0)}</div>
    <div class="user-info"><strong>${currentUser.name}</strong><span>Donor</span></div>`;

  // Set default datetimes
  const now = new Date();
  const fmt = (d) => d.toISOString().slice(0, 16);
  const el  = document.getElementById('pickupFrom');
  const el2 = document.getElementById('pickupUntil');
  const el3 = document.getElementById('foodExpiry');
  if (el)  el.value  = fmt(now);
  if (el2) el2.value = fmt(new Date(now.getTime() + 4 * 3600000));
  if (el3) el3.value = fmt(new Date(now.getTime() + 6 * 3600000));

  await renderOverview();
});

function showTab(name) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.getAttribute('onclick') && n.getAttribute('onclick').includes(`'${name}'`)) n.classList.add('active');
  });
  const titles = { overview: 'My Dashboard', donate: 'New Donation', mydonations: 'My Donations', history: 'History', profile: 'Profile' };
  document.getElementById('topBarTitle').textContent = titles[name] || name;

  if (name === 'mydonations') renderMyDonations();
  if (name === 'history')     renderHistory();
  if (name === 'profile')     renderProfile();
}

async function renderOverview() {
  let myDonations = [];
  try { myDonations = (await getDonations()).filter(d => d.donorId === currentUser.id); } catch { }

  const active    = myDonations.filter(d => d.status === 'available').length;
  const claimed   = myDonations.filter(d => d.status === 'claimed').length;
  const completed = myDonations.filter(d => d.status === 'completed').length;
  const totalServed = myDonations.reduce((a, d) => a + (d.serves || 0), 0);

  document.getElementById('donorStats').innerHTML = [
    { icon: '📦', value: myDonations.length, label: 'Total Donations',   change: 'All time' },
    { icon: '✅', value: active,             label: 'Available Now',      change: 'Active listings' },
    { icon: '🚚', value: claimed,            label: 'Being Collected',    change: 'In progress' },
    { icon: '👥', value: totalServed,        label: 'People Served',      change: 'Estimated impact' },
  ].map(s => `
    <div class="stat-card">
      <div class="stat-card-icon">${s.icon}</div>
      <div class="stat-card-value">${s.value}</div>
      <div class="stat-card-label">${s.label}</div>
      <div class="stat-card-change up">${s.change}</div>
    </div>`).join('');

  const activeDonations = myDonations.filter(d => ['available', 'claimed'].includes(d.status)).slice(0, 4);
  document.getElementById('activeDonationsList').innerHTML = activeDonations.length === 0
    ? `<div class="empty-state"><div class="empty-icon">📦</div><p>No active donations. <a href="#" onclick="showTab('donate')">Add one →</a></p></div>`
    : activeDonations.map(d => donationItemHTML(d)).join('');

  document.getElementById('impactVisual').innerHTML = `
    <div class="impact-metric"><div class="impact-icon">🍽</div><div><div class="impact-val">${totalServed}</div><div class="impact-lab">Meals Provided</div></div></div>
    <div class="impact-metric"><div class="impact-icon">📦</div><div><div class="impact-val">${completed}</div><div class="impact-lab">Completed</div></div></div>
    <div class="impact-metric"><div class="impact-icon">🌱</div><div><div class="impact-val">${myDonations.reduce((a, d) => a + (d.qty || 0), 0)} kg</div><div class="impact-lab">Food Saved</div></div></div>
  `;

  const recentActs = myDonations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  document.getElementById('recentActivity').innerHTML = recentActs.length === 0
    ? '<div class="empty-state"><div class="empty-icon">📋</div><p>No activity yet</p></div>'
    : recentActs.map(d => `
      <div class="activity-item">
        <div class="activity-dot ${d.status === 'claimed' ? 'blue' : d.status === 'completed' ? 'amber' : ''}"></div>
        <div class="activity-text">
          <strong>${d.foodName} — ${d.status.charAt(0).toUpperCase() + d.status.slice(1)}</strong>
          <span>${timeAgo(d.createdAt)} · ${d.qty} ${d.unit}</span>
        </div>
      </div>`).join('');
}

function donationItemHTML(d) {
  const urgency  = timeUntil(d.expiry);
  const isUrgent = new Date(d.expiry) - Date.now() < 2 * 3600000;
  return `
    <div class="donation-item">
      <div class="donation-item-header">
        <div>
          <div class="donation-item-title">${d.foodName}</div>
          <div style="font-size:0.8rem;color:var(--text-3);margin-top:2px">${d.category}</div>
        </div>
        ${statusBadge(d.status)}
      </div>
      <div class="donation-item-meta">
        <span>⚖ ${d.qty} ${d.unit}${d.serves ? ` · serves ~${d.serves}` : ''}</span>
        <span>📍 ${d.address}</span>
        <span ${isUrgent ? 'style="color:var(--red);font-weight:600"' : ''}>⏰ ${urgency}</span>
        ${d.claimedByName ? `<span>🏠 Claimed by: ${d.claimedByName}</span>` : ''}
      </div>
      <div class="donation-item-footer">
        <div class="donation-tags">${(d.tags || []).map(t => `<span class="donation-tag">${t}</span>`).join('')}</div>
        <span style="font-size:0.78rem;color:var(--text-3)">Listed ${timeAgo(d.createdAt)}</span>
      </div>
    </div>`;
}

function filterMyDonations(filter) {
  currentDonorFilter = filter;
  document.querySelectorAll('#tab-mydonations .filter-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  renderMyDonations();
}

async function renderMyDonations() {
  document.getElementById('myDonationsList').innerHTML = '<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading…</p></div>';
  try {
    let donations = (await getDonations()).filter(d => d.donorId === currentUser.id);
    if (currentDonorFilter !== 'all') donations = donations.filter(d => d.status === currentDonorFilter);
    donations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    document.getElementById('myDonationsList').innerHTML = donations.length === 0
      ? `<div class="empty-state"><div class="empty-icon">📦</div><p>No ${currentDonorFilter !== 'all' ? currentDonorFilter : ''} donations yet</p></div>`
      : donations.map(d => donationItemHTML(d)).join('');
  } catch (err) {
    document.getElementById('myDonationsList').innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>Failed to load donations. Is the server running?</p></div>';
  }
}

async function renderHistory() {
  document.getElementById('historyTable').innerHTML = '<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading…</p></div>';
  try {
    const donations = (await getDonations()).filter(d => d.donorId === currentUser.id);
    document.getElementById('historyTable').innerHTML = donations.length === 0
      ? '<div class="empty-state"><div class="empty-icon">📋</div><p>No history yet</p></div>'
      : `<table class="data-table">
          <thead><tr><th>Food</th><th>Qty</th><th>Serves</th><th>Status</th><th>Claimed By</th><th>Date</th></tr></thead>
          <tbody>${donations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(d => `
            <tr>
              <td><strong>${d.foodName}</strong><br/><small style="color:var(--text-3)">${d.category}</small></td>
              <td>${d.qty} ${d.unit}</td>
              <td>${d.serves || '-'}</td>
              <td>${statusBadge(d.status)}</td>
              <td>${d.claimedByName || '—'}</td>
              <td>${formatDate(d.createdAt)}</td>
            </tr>`).join('')}
          </tbody></table>`;
  } catch {
    document.getElementById('historyTable').innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>Failed to load history.</p></div>';
  }
}

async function renderProfile() {
  let myDonations = [];
  try { myDonations = (await getDonations()).filter(d => d.donorId === currentUser.id); } catch { }
  const totalServed = myDonations.reduce((a, d) => a + (d.serves || 0), 0);
  const completed   = myDonations.filter(d => d.status === 'completed').length;

  document.getElementById('profileContent').innerHTML = `
    <div class="profile-avatar-big">${currentUser.name.charAt(0)}</div>
    <div class="profile-field"><label>Full Name</label><p>${currentUser.name}</p></div>
    <div class="profile-field"><label>Email</label><p>${currentUser.email}</p></div>
    <div class="profile-field"><label>Phone</label><p>${currentUser.phone || '—'}</p></div>
    <div class="profile-field"><label>Address</label><p>${currentUser.address || '—'}</p></div>
    <div class="profile-field"><label>Member Since</label><p>${formatDate(currentUser.joinDate)}</p></div>
    <div class="profile-field"><label>Total Donations</label><p>${myDonations.length}</p></div>
    <div class="profile-field"><label>People Served</label><p>${totalServed}</p></div>`;

  const certs = [];
  if (myDonations.length >= 1) certs.push({ icon: '🥉', name: 'First Donation', desc: 'Listed your first food donation' });
  if (myDonations.length >= 5) certs.push({ icon: '🥈', name: 'Active Donor',   desc: '5+ donations listed' });
  if (totalServed >= 100)       certs.push({ icon: '🥇', name: 'Century Club',   desc: 'Fed 100+ people' });
  if (completed >= 3)           certs.push({ icon: '🏆', name: 'Reliable Donor', desc: '3+ donations completed' });

  document.getElementById('certsList').innerHTML = certs.length === 0
    ? '<div class="empty-state"><p>Complete donations to earn certificates!</p></div>'
    : certs.map(c => `
      <div class="cert-item">
        <div class="cert-badge">${c.icon}</div>
        <div class="cert-info"><strong>${c.name}</strong><span>${c.desc}</span></div>
        <a class="cert-download" href="#" onclick="showToast('Certificate downloaded!','success');return false;">⬇ Save</a>
      </div>`).join('');
}

async function submitDonation(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }

  const foodName   = document.getElementById('foodName').value.trim();
  const category   = document.getElementById('foodCategory').value;
  const qty        = parseFloat(document.getElementById('foodQty').value);
  const unit       = document.getElementById('foodUnit').value;
  const expiry     = document.getElementById('foodExpiry').value;
  const serves     = parseInt(document.getElementById('foodServes').value) || 0;
  const address    = document.getElementById('pickupAddress').value.trim();
  const pickupFrom  = document.getElementById('pickupFrom').value;
  const pickupUntil = document.getElementById('pickupUntil').value;
  const notes      = document.getElementById('specialNotes').value.trim();
  const tags       = Array.from(document.querySelectorAll('.tag-check input:checked')).map(i => i.value);

  const msg = document.getElementById('donationMsg');

  try {
    await createDonation({
      donorId: currentUser.id, donorName: currentUser.name,
      foodName, category, qty, unit, serves,
      expiry: new Date(expiry).toISOString(),
      pickupFrom: new Date(pickupFrom).toISOString(),
      pickupUntil: new Date(pickupUntil).toISOString(),
      address, notes, tags,
    });

    msg.className = 'form-msg success';
    msg.textContent = '✓ Donation listed successfully! Receivers can now see and claim it.';
    showToast('🍱 Donation listed!', 'success');
    document.getElementById('donationForm').reset();
    setTimeout(() => { showTab('mydonations'); }, 1800);
  } catch (err) {
    msg.className = 'form-msg error';
    msg.textContent = '✗ ' + (err.message || 'Failed to submit donation. Is the server running?');
    if (btn) { btn.disabled = false; btn.textContent = 'List Donation'; }
  }
}
