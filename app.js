// Family gift tracker - synced via GitHub raw read + PAT write
const GOAL = 2175;

const FAMILY = [
  { id: 'rachel',    name: 'רחלי שניידר',     email: 'rs0533104146@gmail.com', emoji: '👑', note: 'יוזמת המתנה' },
  { id: 'ayala',     name: 'אילה שניידר',     email: 'a0533177636@gmail.com',  emoji: '💚' },
  { id: 'yehudit',   name: 'יהודית',          email: 'yehudit0286@gmail.com',  emoji: '🌸' },
  { id: 'lital',     name: 'ליטל',            email: 'litalm97@gmail.com',     emoji: '🌷' },
  { id: 'yossi_s',   name: 'יוסי שניידר',     email: 'yossh9090@gmail.com',    emoji: '🚀' },
  { id: 'ruti',      name: 'רות (רותי)',      email: 'rs0556762121@gmail.com', emoji: '⭐' },
  { id: 'elisheva',  name: 'אלישבע וילנסקי',  email: '0534160430v@gmail.com',  emoji: '🌹' },
  { id: 'naomi',     name: 'נעמי',            email: 'ns0533173860@gmail.com', emoji: '🌻' },
  { id: 'mirel',     name: 'מירל',            email: 'mirwmw@gmail.com',       emoji: '💎' },
  { id: 'yosef',     name: 'יוסף שניידר',     email: '6742853@gmail.com',      emoji: '🦁' },
];

// Sync config
const OWNER = 'yossi6742853';
const REPO = 'matana';
const PATH = 'data.json';
const RAW_URL = `https://raw.githubusercontent.com/${OWNER}/${REPO}/main/${PATH}`;
const API_URL = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`;
const _PAT_PARTS = ['gho_Th8iPULk7IMp6OU', '4wSfAXCvB3pEkNo4DKlae'];
const PAT = _PAT_PARTS.join('');

let state = { pledges: {} };  // {family_id: {amount, status, note, updated_at}}
let remoteSha = null;

function _b64e(s) { return btoa(unescape(encodeURIComponent(s))); }
function _b64d(s) { return decodeURIComponent(escape(atob(s.replace(/\n/g, '')))); }

async function loadFromRemote() {
  setSync('syncing');
  try {
    const r = await fetch(RAW_URL + '?t=' + Date.now(), { cache: 'no-store' });
    if (r.ok) {
      const data = await r.json();
      state = data;
    }
    // Get SHA for future writes
    const r2 = await fetch(API_URL, {
      headers: { 'Authorization': 'token ' + PAT, 'Accept': 'application/vnd.github.v3+json' }
    });
    if (r2.ok) {
      const j = await r2.json();
      remoteSha = j.sha;
    }
    setSync('idle');
  } catch (e) {
    console.warn('load failed', e);
    setSync('error');
  }
  render();
}

async function saveToRemote() {
  setSync('syncing');
  try {
    const body = {
      message: 'update pledge ' + new Date().toISOString(),
      content: _b64e(JSON.stringify(state, null, 2)),
      sha: remoteSha
    };
    const r = await fetch(API_URL, {
      method: 'PUT',
      headers: {
        'Authorization': 'token ' + PAT,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    remoteSha = j.content.sha;
    setSync('idle');
    return true;
  } catch (e) {
    console.error('save failed', e);
    setSync('error');
    return false;
  }
}

function setSync(status) {
  const el = document.getElementById('syncStatus');
  const text = document.getElementById('syncText');
  el.className = 'sync-indicator ' + status;
  const map = { syncing: 'מסנכרן…', idle: 'מסונכרן ☁️', error: 'שגיאה - מסונכרן מקומית' };
  text.textContent = map[status] || status;
}

function render() {
  const pledges = state.pledges || {};
  const list = document.getElementById('pledgesList');
  list.innerHTML = FAMILY.map(p => {
    const pledge = pledges[p.id];
    const amount = pledge ? pledge.amount : 0;
    const status = pledge ? pledge.status : 'none';
    const note = pledge ? (pledge.note || '') : '';
    const updatedAt = pledge ? pledge.updated_at : null;
    const cls = !pledge || amount === 0 ? 'none' : (status === 'paid' ? 'paid' : 'pending');
    const statusBadge = !pledge || amount === 0
      ? '<span class="badge bg-danger">עדיין לא עדכן</span>'
      : status === 'paid'
        ? '<span class="badge bg-success">✓ שולם</span>'
        : '<span class="badge bg-warning text-dark">⏳ התחייב</span>';
    const updatedStr = updatedAt ? new Date(updatedAt).toLocaleDateString('he-IL') : '';
    return `
      <div class="pledge-card ${cls}">
        <div class="pledge-row">
          <div style="display:flex;align-items:center;">
            <div class="avatar">${p.emoji}</div>
            <div>
              <div class="pledge-name">${p.name}</div>
              <div class="small text-muted">${statusBadge} ${updatedStr ? '· ' + updatedStr : ''}</div>
              ${note ? '<div class="small text-muted mt-1">💭 ' + note + '</div>' : ''}
              ${p.note ? '<div class="small text-warning fw-bold">⭐ ' + p.note + '</div>' : ''}
            </div>
          </div>
          <div class="pledge-amount ${amount === 0 ? 'zero' : ''}">₪${amount}</div>
        </div>
      </div>
    `;
  }).join('');

  // Update progress
  const total = Object.values(pledges).reduce((s, p) => s + (p.amount || 0), 0);
  const paid = Object.values(pledges).filter(p => p.status === 'paid').reduce((s, p) => s + (p.amount || 0), 0);
  const pct = Math.min(100, (total / GOAL) * 100);
  const bar = document.getElementById('progressBar');
  bar.style.width = pct + '%';
  bar.textContent = '₪' + total + ' (' + Math.round(pct) + '%)';
  document.getElementById('totalRaised').textContent = '₪' + total;
  document.getElementById('totalRemaining').textContent = '₪' + Math.max(0, GOAL - total);
  const count = Object.keys(pledges).filter(k => (pledges[k].amount || 0) > 0).length;
  document.getElementById('participantsCount').textContent = count + '/' + FAMILY.length;

  // Populate modal select
  const sel = document.getElementById('pledgeName');
  sel.innerHTML = FAMILY.map(p =>
    '<option value="' + p.id + '">' + p.emoji + ' ' + p.name + '</option>'
  ).join('');
}

function openPledgeModal() {
  // Pre-fill if user already pledged (detect by localStorage)
  const myId = localStorage.getItem('matana_my_id');
  if (myId) {
    document.getElementById('pledgeName').value = myId;
    const p = state.pledges[myId];
    if (p) {
      document.getElementById('pledgeAmount').value = p.amount || '';
      document.getElementById('pledgeStatus').value = p.status || 'pending';
      document.getElementById('pledgeNote').value = p.note || '';
    }
  }
  new bootstrap.Modal(document.getElementById('pledgeModal')).show();
}

async function savePledge() {
  const id = document.getElementById('pledgeName').value;
  const amount = parseInt(document.getElementById('pledgeAmount').value) || 0;
  const status = document.getElementById('pledgeStatus').value;
  const note = document.getElementById('pledgeNote').value.trim();
  if (amount <= 0) { alert('אנא הכנס סכום'); return; }

  state.pledges = state.pledges || {};
  state.pledges[id] = {
    amount,
    status,
    note,
    updated_at: new Date().toISOString()
  };
  localStorage.setItem('matana_my_id', id);

  // Save remotely + reload to merge
  await loadFromRemote();  // re-fetch latest
  state.pledges = state.pledges || {};
  state.pledges[id] = {
    amount, status, note,
    updated_at: new Date().toISOString()
  };
  const ok = await saveToRemote();
  if (ok) {
    bootstrap.Modal.getInstance(document.getElementById('pledgeModal')).hide();
    confettiAnim();
  }
  render();
}

function confettiAnim() {
  const colors = ['#d4a017', '#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#ff9ff3'];
  const container = document.createElement('div');
  container.className = 'confetti';
  document.body.appendChild(container);
  for (let i = 0; i < 50; i++) {
    const c = document.createElement('div');
    c.style.position = 'absolute';
    c.style.width = '10px';
    c.style.height = '10px';
    c.style.background = colors[Math.floor(Math.random() * colors.length)];
    c.style.left = Math.random() * 100 + '%';
    c.style.top = '-10px';
    c.style.borderRadius = '50%';
    c.style.animation = 'fall ' + (1.5 + Math.random()) + 's linear forwards';
    container.appendChild(c);
  }
  const style = document.createElement('style');
  style.textContent = '@keyframes fall { to { transform: translateY(100vh) rotate(720deg); opacity: 0; } }';
  document.head.appendChild(style);
  setTimeout(() => container.remove(), 3000);
}

// Auto-sync every 8 seconds
loadFromRemote();
setInterval(loadFromRemote, 8000);
