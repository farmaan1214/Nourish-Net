// ===== CHATBOT.JS — Fixed Q&A Button Style =====

const CHATBOT_FAQ = [
  { q: "How do I donate food?",              a: "You can register as a Donor. Once logged in, click 'New Donation' on your dashboard to list your surplus food." },
  { q: "Who can receive food?",              a: "Verified NGOs, shelters, and community kitchens can register as Receivers. Our admin team verifies all receivers before they can request food." },
  { q: "Is there any cost?",                 a: "No, NourishNet is a completely free platform dedicated to eliminating food waste." },
  { q: "Can I donate raw ingredients?",      a: "Yes! We gladly accept raw vegetables, fruits, and unopened packaged ingredients as long as they are not expired or spoiled." },
  { q: "Can I donate cooked food?",          a: "Yes, we accept cooked food. It must be properly packaged and distributed within a safe time frame (usually 2–4 hours of preparation)." },
  { q: "How does food pickup work?",         a: "When a receiver requests food, they see the pickup address and window. The receiver arranges pickup from the donor's location." },
  { q: "What if the receiver doesn't show?", a: "If a receiver misses the designated pickup window, the donation reverts to 'Available' for other NGOs to claim." },
  { q: "How do I get a certificate?",        a: "Donation certificates are auto-generated in your Donor Profile once you successfully complete donations. Download them anytime." },
  { q: "What food is NOT accepted?",         a: "We do not accept alcohol, expired food, or items with damaged packaging to ensure recipient safety." },
  { q: "How do I register as an NGO?",       a: "Click 'Create an Account', choose 'Receiver / NGO', and fill in your details. An admin will verify your account before you can request food." },
  { q: "How do I contact support?",          a: "Email us at support@nourishnet.org or call 1-800-NOURISH. We respond within 24 hours." },
  { q: "Can individuals request food?",      a: "Currently only registered and verified NGOs, shelters, and community kitchens can request food to ensure safe and proper distribution." },
];

function injectChatbot() {
  const container = document.createElement('div');
  container.id = 'nn-chatbot-container';

  container.innerHTML = `
    <button class="nn-chatbot-btn" id="nn-chatbot-btn" aria-label="Open Chat">
      <span class="nn-chat-icon">💬</span>
      <span class="nn-chat-badge" id="nn-chat-badge" style="display:none">1</span>
    </button>
    <div class="nn-chatbot-window" id="nn-chatbot-window">
      <div class="nn-chatbot-header">
        <div class="nn-header-info">
          <div class="nn-bot-avatar">🤖</div>
          <div>
            <div class="nn-header-name">NourishNet Assistant</div>
            <div class="nn-header-status">🟢 Online — Ask me anything</div>
          </div>
        </div>
        <button class="nn-chatbot-close" id="nn-chatbot-close" aria-label="Close chat">✕</button>
      </div>

      <div class="nn-chatbot-body" id="nn-chatbot-body">
        <div class="nn-msg nn-msg-bot nn-msg-welcome">
          <strong>Hi there! 👋</strong><br>
          I'm the NourishNet AI Assistant. Tap a question below or type your own!
        </div>
        <div class="nn-faq-chips" id="nn-faq-chips">
          ${CHATBOT_FAQ.map((item, i) => `
            <button class="nn-faq-chip" onclick="askFAQ(${i})">${item.q}</button>
          `).join('')}
        </div>
      </div>

      <div class="nn-chatbot-footer">
        <form id="nn-chatbot-form">
          <input type="text" id="nn-chatbot-input" placeholder="Type your own question…" autocomplete="off"/>
          <button type="submit" id="nn-send-btn" aria-label="Send">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(container);
  injectChatbotStyles();
  bindChatbotEvents();

  // Show badge hint after 3 seconds
  setTimeout(() => {
    const badge = document.getElementById('nn-chat-badge');
    const win   = document.getElementById('nn-chatbot-window');
    if (badge && !win.classList.contains('open')) badge.style.display = 'flex';
  }, 3000);
}

function bindChatbotEvents() {
  const btn      = document.getElementById('nn-chatbot-btn');
  const win      = document.getElementById('nn-chatbot-window');
  const closeBtn = document.getElementById('nn-chatbot-close');
  const form     = document.getElementById('nn-chatbot-form');
  const input    = document.getElementById('nn-chatbot-input');

  btn.addEventListener('click', () => {
    win.classList.toggle('open');
    document.getElementById('nn-chat-badge').style.display = 'none';
    if (win.classList.contains('open')) setTimeout(() => input.focus(), 300);
  });

  closeBtn.addEventListener('click', () => win.classList.remove('open'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = input.value.trim();
    if (!message) return;
    input.value = '';
    await sendMessage(message);
  });
}

function askFAQ(index) {
  const item = CHATBOT_FAQ[index];
  if (!item) return;

  // Hide chips after first question
  const chips = document.getElementById('nn-faq-chips');
  if (chips) chips.style.display = 'none';

  appendMessage(item.q, 'user');
  showTyping();

  setTimeout(() => {
    removeTyping();
    appendMessage(item.a, 'bot');
    showMoreQuestionsBtn();
  }, 700);
}

async function sendMessage(message) {
  const chips = document.getElementById('nn-faq-chips');
  if (chips) chips.style.display = 'none';

  appendMessage(message, 'user');
  showTyping();

  try {
    const res  = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    removeTyping();
    appendMessage(data.reply || 'Sorry, I couldn\'t get a response.', 'bot');
  } catch {
    removeTyping();
    appendMessage('Sorry, I\'m having trouble connecting. Please try again.', 'bot');
  }
  showMoreQuestionsBtn();
}

function appendMessage(text, sender) {
  const body = document.getElementById('nn-chatbot-body');
  const div  = document.createElement('div');
  div.className = `nn-msg nn-msg-${sender}`;
  div.textContent = text;
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

function showTyping() {
  const body = document.getElementById('nn-chatbot-body');
  const div  = document.createElement('div');
  div.className = 'nn-msg nn-msg-bot nn-typing';
  div.id = 'nn-typing-indicator';
  div.innerHTML = '<span></span><span></span><span></span>';
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

function removeTyping() {
  const t = document.getElementById('nn-typing-indicator');
  if (t) t.remove();
}

function showMoreQuestionsBtn() {
  const body = document.getElementById('nn-chatbot-body');
  // Remove any existing "more questions" button
  const existing = document.getElementById('nn-more-btn');
  if (existing) existing.remove();

  const div = document.createElement('div');
  div.id = 'nn-more-btn';
  div.style.cssText = 'text-align:center;padding:8px 0 4px';
  div.innerHTML = `<button class="nn-faq-chip" style="background:var(--nn-green-light,#e8f5e9);color:var(--nn-green,#2E7D32);font-size:0.78rem;" onclick="showAllFAQs()">📋 Show all questions</button>`;
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

function showAllFAQs() {
  const body = document.getElementById('nn-chatbot-body');
  const existing = document.getElementById('nn-more-btn');
  if (existing) existing.remove();

  const wrapper = document.createElement('div');
  wrapper.className = 'nn-faq-chips';
  wrapper.id = 'nn-faq-chips-inline';
  wrapper.innerHTML = CHATBOT_FAQ.map((item, i) => `
    <button class="nn-faq-chip" onclick="
      this.closest('.nn-faq-chips').remove();
      askFAQ(${i});
    ">${item.q}</button>
  `).join('');
  body.appendChild(wrapper);
  body.scrollTop = body.scrollHeight;
}

function injectChatbotStyles() {
  if (document.getElementById('nn-chatbot-styles')) return;
  const style = document.createElement('style');
  style.id = 'nn-chatbot-styles';
  style.textContent = `
    /* ── Container ── */
    #nn-chatbot-container { position:fixed; bottom:28px; right:28px; z-index:9999; font-family:'DM Sans',system-ui,sans-serif; }

    /* ── Toggle Button ── */
    .nn-chatbot-btn {
      width:58px; height:58px; border-radius:50%; border:none; cursor:pointer;
      background:linear-gradient(135deg,#2E7D32,#43A047);
      box-shadow:0 4px 20px rgba(46,125,50,.45);
      display:flex; align-items:center; justify-content:center; position:relative;
      transition:transform .2s,box-shadow .2s;
    }
    .nn-chatbot-btn:hover { transform:scale(1.08); box-shadow:0 6px 26px rgba(46,125,50,.55); }
    .nn-chat-icon { font-size:1.5rem; line-height:1; }
    .nn-chat-badge {
      position:absolute; top:-4px; right:-4px; width:18px; height:18px;
      background:#EF4444; color:#fff; border-radius:50%; font-size:.7rem;
      font-weight:700; align-items:center; justify-content:center;
      border:2px solid #fff;
    }

    /* ── Window ── */
    .nn-chatbot-window {
      position:absolute; bottom:70px; right:0;
      width:340px; max-height:520px;
      background:#fff; border-radius:18px;
      box-shadow:0 12px 48px rgba(0,0,0,.18);
      display:flex; flex-direction:column;
      opacity:0; transform:translateY(14px) scale(.97);
      pointer-events:none;
      transition:opacity .25s,transform .25s;
      overflow:hidden;
    }
    .nn-chatbot-window.open { opacity:1; transform:translateY(0) scale(1); pointer-events:all; }

    /* ── Header ── */
    .nn-chatbot-header {
      background:linear-gradient(135deg,#1B5E20,#2E7D32);
      padding:14px 16px; display:flex; align-items:center; justify-content:space-between;
    }
    .nn-header-info { display:flex; align-items:center; gap:10px; }
    .nn-bot-avatar {
      width:38px; height:38px; border-radius:50%;
      background:rgba(255,255,255,.18); display:flex; align-items:center;
      justify-content:center; font-size:1.3rem;
    }
    .nn-header-name { color:#fff; font-weight:700; font-size:.95rem; }
    .nn-header-status { color:rgba(255,255,255,.75); font-size:.72rem; margin-top:1px; }
    .nn-chatbot-close {
      background:rgba(255,255,255,.15); border:none; color:#fff;
      width:28px; height:28px; border-radius:50%; cursor:pointer;
      font-size:.85rem; display:flex; align-items:center; justify-content:center;
      transition:background .2s;
    }
    .nn-chatbot-close:hover { background:rgba(255,255,255,.28); }

    /* ── Body ── */
    .nn-chatbot-body {
      flex:1; overflow-y:auto; padding:14px 12px;
      display:flex; flex-direction:column; gap:8px;
      scroll-behavior:smooth;
    }
    .nn-chatbot-body::-webkit-scrollbar { width:4px; }
    .nn-chatbot-body::-webkit-scrollbar-thumb { background:#ccc; border-radius:4px; }

    /* ── Messages ── */
    .nn-msg {
      max-width:82%; padding:10px 13px; border-radius:14px;
      font-size:.85rem; line-height:1.5; word-break:break-word;
    }
    .nn-msg-bot {
      background:#f1f5f1; color:#1a2e1a;
      border-bottom-left-radius:4px; align-self:flex-start;
    }
    .nn-msg-user {
      background:linear-gradient(135deg,#2E7D32,#43A047);
      color:#fff; border-bottom-right-radius:4px; align-self:flex-end;
    }
    .nn-msg-welcome { max-width:100%; background:#e8f5e9; border-left:3px solid #43A047; }

    /* ── Typing indicator ── */
    .nn-typing { display:flex; gap:5px; align-items:center; padding:12px 16px; }
    .nn-typing span {
      width:7px; height:7px; background:#aaa; border-radius:50%;
      animation:nn-bounce .9s infinite;
    }
    .nn-typing span:nth-child(2) { animation-delay:.15s; }
    .nn-typing span:nth-child(3) { animation-delay:.3s; }
    @keyframes nn-bounce {
      0%,60%,100% { transform:translateY(0); }
      30%          { transform:translateY(-6px); }
    }

    /* ── FAQ chips ── */
    .nn-faq-chips {
      display:flex; flex-direction:column; gap:6px; padding:4px 0;
    }
    .nn-faq-chip {
      background:#fff; border:1.5px solid #c8e6c9; color:#2E7D32;
      padding:8px 12px; border-radius:20px; font-size:.8rem; font-weight:500;
      text-align:left; cursor:pointer; transition:all .18s; line-height:1.35;
    }
    .nn-faq-chip:hover {
      background:#e8f5e9; border-color:#2E7D32;
      transform:translateX(3px);
    }

    /* ── Footer / Input ── */
    .nn-chatbot-footer {
      border-top:1px solid #f0f0f0; padding:10px 12px;
      background:#fafafa;
    }
    .nn-chatbot-footer form {
      display:flex; gap:8px; align-items:center;
    }
    #nn-chatbot-input {
      flex:1; padding:9px 14px; border:1.5px solid #e0e0e0;
      border-radius:22px; font-size:.84rem; outline:none;
      transition:border-color .2s; background:#fff;
    }
    #nn-chatbot-input:focus { border-color:#2E7D32; }
    #nn-send-btn {
      width:36px; height:36px; border-radius:50%; border:none;
      background:linear-gradient(135deg,#2E7D32,#43A047); color:#fff;
      cursor:pointer; display:flex; align-items:center; justify-content:center;
      flex-shrink:0; transition:transform .2s,box-shadow .2s;
    }
    #nn-send-btn:hover { transform:scale(1.08); box-shadow:0 3px 10px rgba(46,125,50,.4); }

    @media (max-width:400px) {
      .nn-chatbot-window { width:calc(100vw - 32px); right:-4px; }
    }
  `;
  document.head.appendChild(style);
}

// ── Inject on load ──────────────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectChatbot);
} else {
  injectChatbot();
}
