const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Database Setup ──────────────────────────────────────────────────────────
// ─── Database Setup ──────────────────────────────────────────────────────────
// On Render.com, use the persistent disk at /data if available. Otherwise, fallback to project root.
let DB_DIR = __dirname;
if (IS_PROD) {
  try {
    if (!fs.existsSync('/data')) {
      fs.mkdirSync('/data', { recursive: true });
    }
    fs.accessSync('/data', fs.constants.W_OK);
    DB_DIR = '/data';
  } catch (err) {
    console.warn('⚠️ Persistent disk (/data) not available or writable. Falling back to local directory for SQLite. Data will reset on deployment.');
  }
}
const DB_PATH = path.join(DB_DIR, 'database.sqlite');
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to SQLite database.');
  initSchema();
});

function initSchema() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      org_type TEXT,
      beneficiaries INTEGER DEFAULT 0,
      status TEXT DEFAULT 'approved',
      join_date TEXT,
      donation_count INTEGER DEFAULT 0,
      total_served INTEGER DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS donations (
      id TEXT PRIMARY KEY,
      donor_id TEXT NOT NULL,
      donor_name TEXT,
      food_name TEXT NOT NULL,
      category TEXT,
      qty REAL,
      unit TEXT,
      serves INTEGER,
      expiry TEXT,
      pickup_from TEXT,
      pickup_until TEXT,
      address TEXT,
      notes TEXT,
      tags TEXT DEFAULT '[]',
      status TEXT DEFAULT 'available',
      claimed_by TEXT,
      claimed_by_name TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      donation_id TEXT NOT NULL,
      receiver_id TEXT NOT NULL,
      receiver_name TEXT,
      donor_id TEXT,
      donor_name TEXT,
      food_name TEXT,
      status TEXT DEFAULT 'confirmed',
      requested_at TEXT DEFAULT CURRENT_TIMESTAMP,
      pickup_time TEXT
    )`);

    // Seed demo data if tables are empty
    db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
      if (!err && row.count === 0) seedDemoData();
    });
  });
}

function seedDemoData() {
  console.log('🌱 Seeding demo data...');
  const now = new Date();
  const h = (n) => new Date(now.getTime() + n * 3600000).toISOString();
  const today = now.toISOString().split('T')[0];

  const users = [
    ['u1', 'Admin', 'admin@nourishnet.com', 'admin123', 'admin', '+91 98000 00001', 'HQ, Mumbai', null, 0, 'approved', '2024-01-01', 0, 0],
    ['u2', 'Ravi Kumar', 'ravi@food.com', 'donor123', 'donor', '+91 98000 00002', '42 MG Road, Bengaluru', null, 0, 'approved', '2024-02-15', 24, 480],
    ['u3', 'Anjali Sharma', 'anjali@food.com', 'donor123', 'donor', '+91 98000 00003', '7 Park Street, Kolkata', null, 0, 'approved', '2024-03-01', 12, 210],
    ['u4', 'Helping Hands NGO', 'helpinghands@ngo.org', 'recv123', 'receiver', '+91 98000 00004', '15 Seva Nagar, Delhi', 'NGO', 150, 'approved', '2024-02-20', 0, 0],
    ['u5', 'City Shelter Home', 'shelter@city.org', 'recv123', 'receiver', '+91 98000 00005', '8 Relief Colony, Hyderabad', 'Shelter', 80, 'approved', '2024-03-10', 0, 0],
    ['u6', 'Hope Foundation', 'hope@ngo.org', 'recv123', 'receiver', '+91 98000 00006', '3 NGO Complex, Chennai', 'NGO', 200, 'pending', '2024-04-01', 0, 0],
    ['u7', 'Sunrise Community Kitchen', 'sunrise@kitchen.com', 'recv123', 'receiver', '+91 98000 00007', '9 East Lane, Pune', 'Community Kitchen', 120, 'pending', '2024-04-03', 0, 0],
  ];

  const userStmt = db.prepare(`INSERT OR IGNORE INTO users
    (id,name,email,password,role,phone,address,org_type,beneficiaries,status,join_date,donation_count,total_served)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  users.forEach(u => userStmt.run(u));
  userStmt.finalize();

  const donations = [
    ['d1','u2','Ravi Kumar','Biryani & Raita','Cooked Meals',40,'portions / servings',40,h(3),h(0.5),h(4),'42 MG Road, Bengaluru','Contains nuts','["halal"]','available',null,null, new Date(now.getTime() - 3600000).toISOString()],
    ['d2','u2','Ravi Kumar','Fresh Vegetables','Raw Vegetables',15,'kg',60,h(24),now.toISOString(),h(6),'42 MG Road, Bengaluru','','["vegetarian","vegan"]','claimed','u4','Helping Hands NGO', new Date(now.getTime() - 2*3600000).toISOString()],
    ['d3','u3','Anjali Sharma','Bread & Butter','Baked Goods',50,'packets',100,h(12),now.toISOString(),h(3),'7 Park Street, Kolkata','','["vegetarian"]','available',null,null, new Date(now.getTime() - 1800000).toISOString()],
    ['d4','u2','Ravi Kumar','Dal & Rice','Cooked Meals',80,'portions / servings',80,h(-2),h(-4),h(-0.5),'42 MG Road, Bengaluru','','["vegetarian","vegan"]','completed','u5','City Shelter Home', new Date(now.getTime() - 5*3600000).toISOString()],
    ['d5','u3','Anjali Sharma','Milk & Paneer','Dairy Products',10,'kg',30,h(8),now.toISOString(),h(5),'7 Park Street, Kolkata','Keep refrigerated','["vegetarian"]','available',null,null, new Date(now.getTime() - 900000).toISOString()],
    ['d6','u2','Ravi Kumar','Samosas & Chutney','Cooked Meals',200,'portions / servings',200,h(5),now.toISOString(),h(4),'42 MG Road, Bengaluru','','["vegetarian"]','available',null,null, new Date(now.getTime() - 600000).toISOString()],
  ];

  const donStmt = db.prepare(`INSERT OR IGNORE INTO donations
    (id,donor_id,donor_name,food_name,category,qty,unit,serves,expiry,pickup_from,pickup_until,address,notes,tags,status,claimed_by,claimed_by_name,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  donations.forEach(d => donStmt.run(d));
  donStmt.finalize();

  const requests = [
    ['r1','d2','u4','Helping Hands NGO','u2','Ravi Kumar','Fresh Vegetables','confirmed',new Date(now.getTime()-3600000).toISOString(),h(2)],
    ['r2','d4','u5','City Shelter Home','u2','Ravi Kumar','Dal & Rice','completed',new Date(now.getTime()-5*3600000).toISOString(),h(-2)],
  ];

  const reqStmt = db.prepare(`INSERT OR IGNORE INTO requests
    (id,donation_id,receiver_id,receiver_name,donor_id,donor_name,food_name,status,requested_at,pickup_time)
    VALUES (?,?,?,?,?,?,?,?,?,?)`);
  requests.forEach(r => reqStmt.run(r));
  reqStmt.finalize();

  console.log('✅ Demo data seeded.');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function uid()  { return 'u' + Date.now() + Math.random().toString(36).substr(2, 4); }
function did()  { return 'd' + Date.now() + Math.random().toString(36).substr(2, 4); }
function rid()  { return 'r' + Date.now() + Math.random().toString(36).substr(2, 4); }

// Map DB row → frontend user object
function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    role: row.role,
    phone: row.phone,
    address: row.address,
    orgType: row.org_type,
    beneficiaries: row.beneficiaries,
    status: row.status,
    joinDate: row.join_date,
    donationCount: row.donation_count,
    totalServed: row.total_served,
  };
}

// Map DB row → frontend donation object
function mapDonation(row) {
  if (!row) return null;
  return {
    id: row.id,
    donorId: row.donor_id,
    donorName: row.donor_name,
    foodName: row.food_name,
    category: row.category,
    qty: row.qty,
    unit: row.unit,
    serves: row.serves,
    expiry: row.expiry,
    pickupFrom: row.pickup_from,
    pickupUntil: row.pickup_until,
    address: row.address,
    notes: row.notes,
    tags: JSON.parse(row.tags || '[]'),
    status: row.status,
    claimedBy: row.claimed_by,
    claimedByName: row.claimed_by_name,
    createdAt: row.created_at,
  };
}

// Map DB row → frontend request object
function mapRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    donationId: row.donation_id,
    receiverId: row.receiver_id,
    receiverName: row.receiver_name,
    donorId: row.donor_id,
    donorName: row.donor_name,
    foodName: row.food_name,
    status: row.status,
    requestedAt: row.requested_at,
    pickupTime: row.pickup_time,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

  db.get('SELECT * FROM users WHERE email = ? AND password = ?', [email, password], (err, row) => {
    if (err)  return res.status(500).json({ error: 'Database error.' });
    if (!row) return res.status(401).json({ error: 'Invalid email or password.' });
    res.json({ success: true, user: mapUser(row) });
  });
});

// POST /api/register
app.post('/api/register', (req, res) => {
  const { name, phone, email, password, address, role } = req.body;
  if (!name || !email || !password || !role) return res.status(400).json({ error: 'Required fields missing.' });

  db.get('SELECT id FROM users WHERE email = ?', [email], (err, existing) => {
    if (err)      return res.status(500).json({ error: 'Database error.' });
    if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

    const id = uid();
    const status = role === 'receiver' ? 'pending' : 'approved';
    const joinDate = new Date().toISOString().split('T')[0];

    db.run(
      `INSERT INTO users (id,name,email,password,role,phone,address,status,join_date,donation_count,total_served)
       VALUES (?,?,?,?,?,?,?,?,?,0,0)`,
      [id, name, email, password, role, phone || '', address || '', status, joinDate],
      function(err) {
        if (err) return res.status(500).json({ error: 'Failed to create account.' });
        db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
          res.status(201).json({ success: true, user: mapUser(row) });
        });
      }
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// USERS ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/users — all users
app.get('/api/users', (req, res) => {
  db.all('SELECT * FROM users', (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error.' });
    res.json(rows.map(mapUser));
  });
});

// GET /api/users/:id
app.get('/api/users/:id', (req, res) => {
  db.get('SELECT * FROM users WHERE id = ?', [req.params.id], (err, row) => {
    if (err)  return res.status(500).json({ error: 'Database error.' });
    if (!row) return res.status(404).json({ error: 'User not found.' });
    res.json(mapUser(row));
  });
});

// PATCH /api/users/:id/status
app.patch('/api/users/:id/status', (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'Status is required.' });
  db.run('UPDATE users SET status = ? WHERE id = ?', [status, req.params.id], function(err) {
    if (err)             return res.status(500).json({ error: 'Database error.' });
    if (!this.changes)   return res.status(404).json({ error: 'User not found.' });
    res.json({ success: true });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DONATIONS ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/donations
app.get('/api/donations', (req, res) => {
  db.all('SELECT * FROM donations ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error.' });
    res.json(rows.map(mapDonation));
  });
});

// POST /api/donations
app.post('/api/donations', (req, res) => {
  const { donorId, donorName, foodName, category, qty, unit, serves, expiry, pickupFrom, pickupUntil, address, notes, tags } = req.body;
  if (!donorId || !foodName) return res.status(400).json({ error: 'donorId and foodName are required.' });

  const id = did();
  const createdAt = new Date().toISOString();
  db.run(
    `INSERT INTO donations (id,donor_id,donor_name,food_name,category,qty,unit,serves,expiry,pickup_from,pickup_until,address,notes,tags,status,created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, donorId, donorName, foodName, category, qty, unit, serves, expiry, pickupFrom, pickupUntil, address, notes, JSON.stringify(tags || []), 'available', createdAt],
    function(err) {
      if (err) return res.status(500).json({ error: 'Failed to create donation.' });
      // Increment donor's donation_count
      db.run('UPDATE users SET donation_count = donation_count + 1 WHERE id = ?', [donorId]);
      db.get('SELECT * FROM donations WHERE id = ?', [id], (err, row) => {
        res.status(201).json(mapDonation(row));
      });
    }
  );
});

// PATCH /api/donations/:id/claim
app.patch('/api/donations/:id/claim', (req, res) => {
  const { receiverId, receiverName } = req.body;
  if (!receiverId) return res.status(400).json({ error: 'receiverId is required.' });

  db.get('SELECT * FROM donations WHERE id = ?', [req.params.id], (err, donation) => {
    if (err)      return res.status(500).json({ error: 'Database error.' });
    if (!donation) return res.status(404).json({ error: 'Donation not found.' });
    if (donation.status !== 'available') return res.status(409).json({ error: 'Donation is no longer available.' });

    db.run(
      'UPDATE donations SET status = ?, claimed_by = ?, claimed_by_name = ? WHERE id = ?',
      ['claimed', receiverId, receiverName, req.params.id],
      function(err) {
        if (err) return res.status(500).json({ error: 'Failed to claim donation.' });

        // Create a request record
        const reqId = rid();
        const d = donation;
        db.run(
          `INSERT INTO requests (id,donation_id,receiver_id,receiver_name,donor_id,donor_name,food_name,status,requested_at,pickup_time)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [reqId, d.id, receiverId, receiverName, d.donor_id, d.donor_name, d.food_name, 'confirmed', new Date().toISOString(), d.pickup_from],
          function(err) {
            if (err) return res.status(500).json({ error: 'Claimed but failed to create request.' });
            db.get('SELECT * FROM requests WHERE id = ?', [reqId], (err, reqRow) => {
              res.json({ success: true, request: mapRequest(reqRow) });
            });
          }
        );
      }
    );
  });
});

// PATCH /api/donations/:id/complete
app.patch('/api/donations/:id/complete', (req, res) => {
  db.run('UPDATE donations SET status = ? WHERE id = ?', ['completed', req.params.id], function(err) {
    if (err)           return res.status(500).json({ error: 'Database error.' });
    if (!this.changes) return res.status(404).json({ error: 'Donation not found.' });
    res.json({ success: true });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// REQUESTS ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/requests
app.get('/api/requests', (req, res) => {
  db.all('SELECT * FROM requests ORDER BY requested_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error.' });
    res.json(rows.map(mapRequest));
  });
});

// PATCH /api/requests/:id/complete
app.patch('/api/requests/:id/complete', (req, res) => {
  db.get('SELECT * FROM requests WHERE id = ?', [req.params.id], (err, reqRow) => {
    if (err)    return res.status(500).json({ error: 'Database error.' });
    if (!reqRow) return res.status(404).json({ error: 'Request not found.' });

    db.run('UPDATE requests SET status = ? WHERE id = ?', ['completed', req.params.id], (err) => {
      if (err) return res.status(500).json({ error: 'Database error.' });
      // Also mark the linked donation as completed
      db.run('UPDATE donations SET status = ? WHERE id = ?', ['completed', reqRow.donation_id]);
      res.json({ success: true });
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/health', (req, res) => {
  db.get('SELECT COUNT(*) as users FROM users', (err, u) => {
    db.get('SELECT COUNT(*) as donations FROM donations', (err2, d) => {
      db.get('SELECT COUNT(*) as requests FROM requests', (err3, r) => {
        res.json({
          status: 'ok',
          database: 'connected',
          counts: { users: u?.users || 0, donations: d?.donations || 0, requests: r?.requests || 0 }
        });
      });
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CHATBOT
// ═══════════════════════════════════════════════════════════════════════════════
const CHATBOT_FAQ = {
  "donate":      "You can register as a Donor. Once logged in, click 'New Donation' on your dashboard to list your surplus food.",
  "receive":     "Verified NGOs, shelters, and community kitchens can register as Receivers. Our admin team verifies all receivers before they can request food.",
  "cost":        "No, NourishNet is a completely free platform dedicated to eliminating food waste.",
  "contact":     "You can reach our support team at support@nourishnet.org or call us at 1-800-NOURISH.",
  "forgot":      "Click 'Forgot password?' on the login screen. We will send an OTP to your registered phone number to reset it.",
  "raw":         "Yes! You can donate raw ingredients, grains, and fresh produce as long as they are not spoiled.",
  "cooked":      "Yes, we accept cooked food, but it must be properly packaged and distributed within a safe time frame (usually within 2-4 hours).",
  "certificate": "Yes, once a donation is successfully completed and verified, you can download a 'Certificate of Appreciation' from your Donor history tab.",
  "expired":     "No, we strictly do not accept expired or spoiled food to ensure the health and safety of the recipients.",
  "no show":     "If a receiver does not show up within the agreed time, the donation status will revert to 'Available' so another NGO can claim it.",
  "account":     "You can go to your Profile tab and update your details. If you need to change your role, please contact Admin.",
  "register":    "Click 'Create an Account' on the login page. Fill in your details and choose either Donor or Receiver as your role.",
  "ngo":         "NGOs and shelters register as Receivers. After registering, an admin verifies your account before you can claim donations.",
  "pickup":      "When a receiver requests food, they see the pickup address and window. The receiver arranges the pickup from the donor's location.",
};

function processChatInput(message) {
  const m = message.toLowerCase();
  for (const [keyword, answer] of Object.entries(CHATBOT_FAQ)) {
    if (m.includes(keyword)) return answer;
  }
  return "I'm not quite sure how to answer that yet. Please try asking about donating, receiving food, costs, or contacting support. You can also email support@nourishnet.org for help.";
}

app.post('/api/chat', (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required.' });
  setTimeout(() => {
    res.json({ reply: processChatInput(message) });
  }, 600);
});

// ═══════════════════════════════════════════════════════════════════════════════
// SPA FALLBACK — only for non-API, non-file requests
// ═══════════════════════════════════════════════════════════════════════════════
app.get('*', (req, res) => {
  // Only send index.html for requests that aren't to known HTML pages
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 NourishNet server running at http://localhost:${PORT}`);
  console.log(`   📊 Health check: http://localhost:${PORT}/api/health\n`);
});
