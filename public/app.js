/* ═══════════════════════════════════════════════════════
   ExamPortal — app.js  (v4 — PHP/MySQL backend)
   University Document Request Management System
═══════════════════════════════════════════════════════ */

'use strict';

/* ══════════════════════════════════════════
   API BASE
══════════════════════════════════════════ */

const API = {
  base: '/api',

  async call(endpoint, params = {}, method = 'GET') {
    try {
      let url  = `${this.base}/${endpoint}`;
      let opts = {
        method,
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
      };
      if (method === 'GET') {
        const qs = new URLSearchParams(params).toString();
        if (qs) url += (url.includes('?') ? '&' : '?') + qs;
      } else {
        opts.body = JSON.stringify(params);
      }
      const res  = await fetch(url, opts);
      const data = await res.json().catch(() => ({ success: false, error: 'Invalid server response' }));
if (!data.success && res.status === 401 && state.user) {
  // Session expired — redirect to login
  onsole.log('RELOAD TRIGGERED');
}
      return data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  get(ep, p)    { return this.call(ep, p, 'GET');    },
  post(ep, p)   { return this.call(ep, p, 'POST');   },
  del(ep, p)    { return this.call(ep, p, 'DELETE'); },
};

/* ══════════════════════════════════════════
   DEBOUNCE HELPER (for live search inputs)
══════════════════════════════════════════ */

function debounce(fn, wait = 350) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/* ══════════════════════════════════════════
   CONSTANTS & DATA MAPS
══════════════════════════════════════════ */

const EXTRA_FEES = { courier: { none: 0, local: 1200, intl: 8000 }, emailPerCopy: 1000 };

function levelLabel(level) {
  if (!level) return '—';
  const l = level.toLowerCase();
  if (l === 'ug') return 'Undergraduate';
  if (l === 'pg') return 'Postgraduate';
  return '—';
}

const DOC_LABELS = {
  degree: 'Degree', dupdegree: 'Duplicate Degree', provisional: 'Provisional Certificate',
  marks: 'Marks Certificate', transcript: 'Transcript', verification: 'Verification of Documents',
  verifyDegree: 'Verification of Degree', verifyProv: 'Verification of Provisional Certificate',
  verifyTrans: 'Verification of Transcript', verifyMarks: 'Verification of Marks Certificate',
  scrutiny: 'Scrutiny of Result', dispatch: 'Dispatch', other: 'Other Certificate', emailcorr: 'Email'
};

const BASE_FEES = {
  degree:      { undergraduate: 3450,  postgraduate: 6000  },
  dupdegree:   { undergraduate: 10350, postgraduate: 13800 },
  provisional: { undergraduate: 4500,  postgraduate: 4500  },
  marks:       { undergraduate: 1750,  postgraduate: 3500  },
  transcript:  { undergraduate: 2000,  postgraduate: 4500  },
  verifyDegree:{ undergraduate: 1750,  postgraduate: 3500  },
  verifyProv:  { undergraduate: 1500,  postgraduate: 3500  },
  verifyTrans: { undergraduate: 1500,  postgraduate: 2500  },
  verifyMarks: { undergraduate: 1000,  postgraduate: 1750  },
  scrutiny:    { undergraduate: 2500,  postgraduate: 4500  },
  dispatch:    { undergraduate: 1250,  postgraduate: 1250  },
  other:       { undergraduate: 2500,  postgraduate: 2500  },
  emailcorr:   { undergraduate: 1000,  postgraduate: 1000  },
};

const URGENT_FEES = {
  postgraduate:  { degree: 12150, dupdegree: 29400, marks: 5250, transcript: 5750 },
  undergraduate: { degree: 6900,  dupdegree: 20700, marks: 3000, transcript: 4500 }
};

const URGENT_ALLOWED = ['degree', 'dupdegree', 'marks', 'transcript'];

const STATUS_BADGE = {
  'Pending':   'badge-pending',
  'Completed': 'badge-approved',
  'Received':  'badge-received',
};

const STATUS_COLORS = {
  'Pending':   '#f59e0b',
  'Completed': '#22c55e',
  'Received':  '#166534',
};

const CHART_COLORS = ['#f5a623', '#00b4d8', '#e94560', '#8b5cf6', '#22c55e', '#f59e0b', '#6366f1'];

/* ══════════════════════════════════════════
   DISCIPLINE LIST
══════════════════════════════════════════ */

const DISCIPLINE_LIST = [
  'Applied Mathematics','Applied Physics','Architecture','Automotive Engineering',
  'Biomedical Engineering','Chemical Engineering','Civil Engineering',
  'Computer & Information Systems Engineering','Computer Science',
  'DCET - Architecture','DCET - Chemical','DCET - Electronics','DCET - Industrial','DCET - Metallurgical',
  'Economics','Electrical Engineering','Electronic Engineering','Electronics','English Linguistics',
  'Environmental Engineering','Food Engineering',
  'GCT-Civil Pass','GCT-Electrical Pass','GCT-Mechanical Pass',
  'GCT-Civil Honors','GCT-Electrical Honors','GCT-Mechanical Honors',
  'IIEE - Industrial Electronics','Industrial & Manufacturing Engineering','Management Sciences',
  'Mechanical Engineering','PAF-AEROSPACE Engg','PAF-AVIONICS Engg',
  'PNEC-MECHANICAL Engg','PNEC-ELECTRICAL Engg',
  'PAF B.Tech Pass – Aero Mechanics','PAF B.Tech Pass – Aero Electronic',
  'PMA-Marine Engg','PMA-Nautical Science','PMA-Ship Management',
  'PCSIR-Mechanical Pass','Software Engineering','Statistics','Textile Engineering',
  'UIT- Electronic','UIT - Computer System','UIT - Telecommunications',
  'UIT - Power','UIT - Computer Science','UIT - Software Engineering'
];

/* ══════════════════════════════════════════
   APP STATE
══════════════════════════════════════════ */

const state = {
  role: '',
  user: '',
  dept: '',
  currentPage: '',
  modalId: null,
  sortField: 'datetime',
  sortDir: -1,
  acIndex: -1,
  // Cached request lists (refreshed per navigation)
  requests: [],
};

let counterActiveTab = 'in';
let deptActiveTab    = 'in';

/* ══════════════════════════════════════════
   LOGIN / LOGOUT
══════════════════════════════════════════ */

document.querySelectorAll('.role-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.role-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    state.role = tab.dataset.role;
    document.getElementById('dept-selector-wrap').style.display =
      (state.role === 'department') ? 'flex' : 'none';
  });
});
state.role = 'data-entry';

document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    if (document.getElementById('login-screen').style.display !== 'none') { doLogin(); return; }
  }
  if (e.key === 'Escape') { acClose(); closeModal(); closeConfirmModal(); closeEnterTokenModal(); closeSetUserPasswordModal(); }
});

async function doLogin() {
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value.trim();
  const dept     = document.getElementById('login-dept')?.value || '';

  if (!username || !password) { showToast('Enter username and password', 'error'); return; }
  if (state.role === 'department' && !dept) { showToast('Please select your department', 'error'); return; }

  const btn = document.querySelector('.btn-login');
  btn.textContent = 'Signing in…';
  btn.disabled    = true;

  const res = await API.post('auth.php?action=login', { username, password, role: state.role, dept });

  btn.textContent = 'Sign In';
  btn.disabled    = false;

  if (!res.success) { showToast(res.error || 'Login failed', 'error'); return; }

  const u = res.user;
  state.user = u.username;
  state.role = u.role;
  state.dept = u.dept || '';

  document.getElementById('user-avatar').textContent    = u.username[0].toUpperCase();
  document.getElementById('user-name-disp').textContent = u.full_name || u.username;
  document.getElementById('user-role-disp').textContent =
    u.role === 'data-entry' ? 'Counter' :
    u.role === 'department' ? (u.dept || 'Section') : 'Super Admin';

  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display          = 'block';

  setupNavigation();
  initEntryForm();
  updatePreviewStats();
}

async function doLogout() {
  await API.post('auth.php?action=logout', {});
  state.user = ''; state.role = 'data-entry'; state.dept = '';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app').style.display          = 'none';
  ['login-user', 'login-pass', 'login-dept'].forEach(id => { document.getElementById(id).value = ''; });
  document.querySelectorAll('.role-tab').forEach((t, i) => t.classList.toggle('active', i === 0));
  document.getElementById('dept-selector-wrap').style.display = 'none';
  updatePreviewStats();
}

/* Check if already logged in on page load */
(async () => {
  const res = await API.get('auth.php?action=me', {});
  if (res.success && res.user) {
    const u = res.user;
    state.user = u.username;
    state.role = u.role;
    state.dept = u.dept || '';

    document.getElementById('user-avatar').textContent    = u.username[0].toUpperCase();
    document.getElementById('user-name-disp').textContent = u.full_name || u.username;
    document.getElementById('user-role-disp').textContent =
      u.role === 'data-entry' ? 'Counter' :
      u.role === 'department' ? (u.dept || 'Section') : 'Super Admin';

    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display          = 'block';
    setupNavigation();
    initEntryForm();
    updatePreviewStats();
  }
})();

/* ══════════════════════════════════════════
   NAVIGATION
══════════════════════════════════════════ */

function setupNavigation() {
  const nav   = document.getElementById('topbar-nav');
  nav.innerHTML = '';
  const items = {
    'data-entry': [
      { label: '📝 New Request', page: 'page-entry' },
      { label: '📋 Records',     page: 'page-counter-records' },
    ],
    'department': [{ label: '📋 Request Queue', page: 'page-dept' }],
    'admin': [
      { label: '📊 Dashboard',       page: 'page-admin-dash'      },
      { label: '📋 All Requests',    page: 'page-admin-requests'  },
      { label: '👥 User Management', page: 'page-admin-users'     },
      { label: '💾 Backups',         page: 'page-admin-backups'   },
      { label: '📈 Reports',         page: 'page-admin-reports'   },
    ],
  };
  (items[state.role] || []).forEach(item => {
    const btn   = document.createElement('button');
    btn.className = 'nav-btn';
    btn.textContent = item.label;
    btn.onclick = () => showPage(item.page);
    nav.appendChild(btn);
  });
  const defaultPages = { 'data-entry': 'page-entry', 'department': 'page-dept', 'admin': 'page-admin-dash' };
  showPage(defaultPages[state.role]);
}

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.textContent.includes(
      pageId === 'page-entry'           ? 'New Request'      :
      pageId === 'page-counter-records' ? 'Records'          :
      pageId === 'page-dept'            ? 'Request Queue'    :
      pageId === 'page-admin-dash'      ? 'Dashboard'        :
      pageId === 'page-admin-requests'  ? 'All Requests'     :
      pageId === 'page-admin-users'     ? 'User Management'  :
      pageId === 'page-admin-backups'   ? 'Backups'          : 'Reports'
    ));
  });
  const page = document.getElementById(pageId);
  if (page) page.classList.add('active');
  state.currentPage = pageId;

  if (pageId === 'page-counter-records') {
    counterActiveTab = 'in';
    ['in','out','done'].forEach(t => document.getElementById('ctr-tab-' + t)?.classList.remove('active'));
    document.getElementById('ctr-tab-in')?.classList.add('active');
    loadAndRenderCounterRecords();
  }
  if (pageId === 'page-dept') {
    deptActiveTab = 'in';
    document.getElementById('tab-in')?.classList.add('active');
    document.getElementById('tab-out')?.classList.remove('active');
    loadAndRenderDept();
  }
  if (pageId === 'page-admin-dash')     loadAdminDash();
  if (pageId === 'page-admin-requests') loadAndRenderAdminTable();
  if (pageId === 'page-admin-reports')  loadAndRenderReports();
  if (pageId === 'page-admin-users')    loadUsers();
  if (pageId === 'page-admin-backups')  loadBackups();

  setTimeout(injectCalButtons, 60);
}

/* ══════════════════════════════════════════
   PREVIEW STATS (login screen)
══════════════════════════════════════════ */

async function updatePreviewStats() {
  const res = await API.get('requests.php?action=stats', {});
  if (!res.success) return;
  const s = res.stats;
  const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setEl('prev-total',   s.total);
  setEl('prev-pending', s.pending);
  setEl('prev-urgent',  s.urgent);
}
updatePreviewStats();


/* ══════════════════════════════════════════
   COUNTRY CODE PICKER
══════════════════════════════════════════ */

const COUNTRY_CODES = [
  { iso:'pk', name:'Pakistan',       code:'+92',  max:10 },
  { iso:'us', name:'United States',  code:'+1',   max:10 },
  { iso:'gb', name:'United Kingdom', code:'+44',  max:10 },
  { iso:'ae', name:'UAE',            code:'+971', max:9  },
  { iso:'sa', name:'Saudi Arabia',   code:'+966', max:9  },
  { iso:'ca', name:'Canada',         code:'+1',   max:10 },
  { iso:'au', name:'Australia',      code:'+61',  max:9  },
  { iso:'de', name:'Germany',        code:'+49',  max:11 },
  { iso:'fr', name:'France',         code:'+33',  max:9  },
  { iso:'it', name:'Italy',          code:'+39',  max:10 },
  { iso:'es', name:'Spain',          code:'+34',  max:9  },
  { iso:'nl', name:'Netherlands',    code:'+31',  max:9  },
  { iso:'be', name:'Belgium',        code:'+32',  max:9  },
  { iso:'ch', name:'Switzerland',    code:'+41',  max:9  },
  { iso:'se', name:'Sweden',         code:'+46',  max:9  },
  { iso:'no', name:'Norway',         code:'+47',  max:8  },
  { iso:'dk', name:'Denmark',        code:'+45',  max:8  },
  { iso:'pl', name:'Poland',         code:'+48',  max:9  },
  { iso:'ru', name:'Russia',         code:'+7',   max:10 },
  { iso:'tr', name:'Turkey',         code:'+90',  max:10 },
  { iso:'in', name:'India',          code:'+91',  max:10 },
  { iso:'bd', name:'Bangladesh',     code:'+880', max:10 },
  { iso:'lk', name:'Sri Lanka',      code:'+94',  max:9  },
  { iso:'np', name:'Nepal',          code:'+977', max:10 },
  { iso:'af', name:'Afghanistan',    code:'+93',  max:9  },
  { iso:'ir', name:'Iran',           code:'+98',  max:10 },
  { iso:'iq', name:'Iraq',           code:'+964', max:10 },
  { iso:'kw', name:'Kuwait',         code:'+965', max:8  },
  { iso:'qa', name:'Qatar',          code:'+974', max:8  },
  { iso:'bh', name:'Bahrain',        code:'+973', max:8  },
  { iso:'om', name:'Oman',           code:'+968', max:8  },
  { iso:'jo', name:'Jordan',         code:'+962', max:9  },
  { iso:'lb', name:'Lebanon',        code:'+961', max:8  },
  { iso:'sy', name:'Syria',          code:'+963', max:9  },
  { iso:'eg', name:'Egypt',          code:'+20',  max:10 },
  { iso:'ma', name:'Morocco',        code:'+212', max:9  },
  { iso:'za', name:'South Africa',   code:'+27',  max:9  },
  { iso:'ng', name:'Nigeria',        code:'+234', max:10 },
  { iso:'ke', name:'Kenya',          code:'+254', max:9  },
  { iso:'gh', name:'Ghana',          code:'+233', max:9  },
  { iso:'cn', name:'China',          code:'+86',  max:11 },
  { iso:'jp', name:'Japan',          code:'+81',  max:10 },
  { iso:'kr', name:'South Korea',    code:'+82',  max:10 },
  { iso:'sg', name:'Singapore',      code:'+65',  max:8  },
  { iso:'my', name:'Malaysia',       code:'+60',  max:9  },
  { iso:'id', name:'Indonesia',      code:'+62',  max:11 },
  { iso:'ph', name:'Philippines',    code:'+63',  max:10 },
  { iso:'th', name:'Thailand',       code:'+66',  max:9  },
  { iso:'vn', name:'Vietnam',        code:'+84',  max:9  },
  { iso:'br', name:'Brazil',         code:'+55',  max:11 },
  { iso:'mx', name:'Mexico',         code:'+52',  max:10 },
  { iso:'ar', name:'Argentina',      code:'+54',  max:10 },
];

let selectedCountryCode = '+92';
let selectedCountryMax  = 10;
let selectedCountryIso  = 'pk';

function flagImg(iso, size) {
  return `<img src="https://flagcdn.com/${size}x${Math.round(size*0.75)}/${iso}.png" width="${size}" height="${Math.round(size*0.75)}" alt="${iso}" style="border-radius:2px;display:inline-block;vertical-align:middle;" onerror="this.style.display='none'" />`;
}

function buildCCDropdown() {
  const dropdown = document.getElementById('cc-dropdown');
  if (!dropdown) return;
  dropdown.innerHTML = `
    <div class="cc-search-wrap">
      <input class="cc-search" id="cc-search-input" type="text" placeholder="Search country…" oninput="filterCCList(this.value)" />
    </div>
    <div class="cc-list" id="cc-list"></div>`;
  renderCCList(COUNTRY_CODES);
}

function renderCCList(list) {
  const el = document.getElementById('cc-list');
  if (!el) return;
  window._ccFiltered = list;
  el.innerHTML = list.map((c, i) => `
    <div class="cc-item${c.iso === selectedCountryIso ? ' active' : ''}" onmousedown="selectCountryCodeFromFiltered(${i})">
      <span class="cc-item-flag">${flagImg(c.iso, 24)}</span>
      <span class="cc-item-name">${c.name}</span>
      <span class="cc-item-code">${c.code}</span>
    </div>`).join('');
}

function filterCCList(q) {
  const filtered = q.trim() === ''
    ? COUNTRY_CODES
    : COUNTRY_CODES.filter(c =>
        c.name.toLowerCase().includes(q.toLowerCase()) || c.code.includes(q));
  renderCCList(filtered);
}

function selectCountryCode(masterIndex) {
  const c = COUNTRY_CODES[masterIndex];
  if (!c) return;
  selectedCountryCode = c.code;
  selectedCountryMax  = c.max;
  selectedCountryIso  = c.iso;
  // Update trigger button
  const flagEl = document.getElementById('cc-flag');
  const codeEl = document.getElementById('cc-code');
  if (flagEl) flagEl.innerHTML = flagImg(c.iso, 20);
  if (codeEl) codeEl.textContent = c.code;
  // Update phone input constraints
  const phoneInput = document.getElementById('f-phone');
  if (phoneInput) {
    phoneInput.maxLength   = c.max;
    phoneInput.placeholder = '0'.repeat(c.max);
    if (phoneInput.value.replace(/\D/g,'').length > c.max)
      phoneInput.value = phoneInput.value.slice(0, c.max);
  }
  document.getElementById('cc-dropdown').classList.remove('open');
}

function selectCountryCodeFromFiltered(filteredIndex) {
  const list = window._ccFiltered || COUNTRY_CODES;
  const c    = list[filteredIndex];
  if (!c) return;
  selectCountryCode(COUNTRY_CODES.indexOf(c));
}

function toggleCCDropdown() {
  const dd = document.getElementById('cc-dropdown');
  if (!dd) return;
  if (dd.classList.contains('open')) { dd.classList.remove('open'); return; }
  window._ccFiltered = COUNTRY_CODES;
  buildCCDropdown();
  dd.classList.add('open');
  setTimeout(() => document.getElementById('cc-search-input')?.focus(), 60);
}

function getFullPhone() {
  const local = document.getElementById('f-phone')?.value.replace(/\D/g, '') || '';
  return selectedCountryCode + local;
}

function fmtPhoneLocal(el) {
  let v = el.value.replace(/\D/g, '');
  el.value = v.slice(0, selectedCountryMax);
}

document.addEventListener('click', e => {
  const wrap = document.getElementById('cc-wrap');
  if (wrap && !wrap.contains(e.target)) {
    document.getElementById('cc-dropdown')?.classList.remove('open');
  }
});

/* ══════════════════════════════════════════
   FORM INIT
══════════════════════════════════════════ */

async function initEntryForm() {
  const res = await API.get('requests.php?action=peek_id', {});
  const nxt = res.success ? res.id : '—';
  document.getElementById('f-reqid').value            = nxt;
  document.getElementById('entry-req-id').textContent = nxt;
  document.getElementById('f-operator').value         = state.user;
  document.getElementById('f-copies').value           = '1';
  updateEntryDateTime();
}

function updateEntryDateTime() {
  const now = new Date();
  document.getElementById('f-datetime').value =
    now.toLocaleDateString('en-PK') + ' ' +
    now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
}

/* ══════════════════════════════════════════
   AUTO-FORMATTERS
══════════════════════════════════════════ */

function fmtCnic(el) {
  let v = el.value.replace(/\D/g, '');
  if (v.length > 5)  v = v.slice(0, 5)  + '-' + v.slice(5);
  if (v.length > 13) v = v.slice(0, 13) + '-' + v.slice(13);
  el.value = v.slice(0, 15);
}

function fmtPhone(el) {
  let v = el.value.replace(/\D/g, '');
  if (v.length > 4) v = v.slice(0, 4) + '-' + v.slice(4);
  el.value = v.slice(0, 12);
}

/* ══════════════════════════════════════════
   AUTOCOMPLETE ENGINE
══════════════════════════════════════════ */

function escapeReg(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function acFilter() {
  const input = document.getElementById('f-discipline');
  const dropdown = document.getElementById('ac-dropdown');
  const q = input.value.trim().toLowerCase();
  state.acIndex = -1;
  const hits = q.length === 0 ? DISCIPLINE_LIST : DISCIPLINE_LIST.filter(d => d.toLowerCase().includes(q));
  if (!hits.length) { dropdown.innerHTML = '<div class="ac-no-result">No matching disciplines found</div>'; dropdown.classList.add('open'); return; }
  const re = q ? new RegExp(`(${escapeReg(q)})`, 'gi') : null;
  dropdown.innerHTML = hits.map(d => {
    const label = re ? d.replace(re, '<mark>$1</mark>') : d;
    return `<div class="ac-item" data-value="${d.replace(/"/g,'&quot;')}" onmousedown="acSelect(this.dataset.value)">${label}</div>`;
  }).join('');
  dropdown.classList.add('open');
}

function acSelect(value) { document.getElementById('f-discipline').value = value; document.getElementById('f-discipline').classList.remove('error'); acClose(); }
function acClose() { const d = document.getElementById('ac-dropdown'); if (d) { d.classList.remove('open'); d.innerHTML = ''; } state.acIndex = -1; }
function acBlur() { setTimeout(() => acClose(), 180); }

function acKeyNav(e) {
  const dropdown = document.getElementById('ac-dropdown');
  const items = dropdown.querySelectorAll('.ac-item');
  if (!dropdown.classList.contains('open') && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { acFilter(); return; }
  if (e.key === 'ArrowDown') { e.preventDefault(); state.acIndex = Math.min(state.acIndex + 1, items.length - 1); acHighlight(items); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); state.acIndex = Math.max(state.acIndex - 1, -1); acHighlight(items); }
  else if (e.key === 'Enter') { e.preventDefault(); if (state.acIndex >= 0 && items[state.acIndex]) acSelect(items[state.acIndex].dataset.value); else acClose(); }
  else if (e.key === 'Tab') { if (state.acIndex >= 0 && items[state.acIndex]) { e.preventDefault(); acSelect(items[state.acIndex].dataset.value); } else acClose(); }
}

function acHighlight(items) {
  items.forEach((item, i) => { item.classList.toggle('ac-active', i === state.acIndex); if (i === state.acIndex) item.scrollIntoView({ block: 'nearest' }); });
}

document.addEventListener('click', e => {
  const wrap = document.getElementById('discipline-wrap');
  if (wrap && !wrap.contains(e.target)) acClose();
});

/* ══════════════════════════════════════════
   FEE LOGIC (client-side, mirrors PHP)
══════════════════════════════════════════ */

function updateDeliveryOptions(docKey) {
  const deliverySelect = document.getElementById('f-delivery');
  const urgentOption   = deliverySelect.querySelector('option[value="urgent"]');
  if (URGENT_ALLOWED.includes(docKey)) { if (urgentOption) urgentOption.disabled = false; }
  else { if (urgentOption) urgentOption.disabled = true; deliverySelect.value = 'normal'; }
  calcFee();
}

function onDocChange() {
  const docKey     = document.getElementById('f-doctype').value;
  const verWrap    = document.getElementById('verification-sub-wrap');
  const courier    = document.getElementById('f-courier');
  const intlWrap   = document.getElementById('intl-courier-wrap');
  const noneOpt    = courier.querySelector('option[value="none"]');

  if (docKey === 'verification') { verWrap.style.display = 'block'; }
  else {
    verWrap.style.display = 'none';
    document.querySelectorAll('.verify-check').forEach(cb => { cb.checked = false; });
    document.querySelectorAll('.verify-table').forEach(t  => { t.style.display = 'none'; });
    document.querySelectorAll('.verify-count').forEach(inp => { inp.value = 1; });
  }

  courier.disabled = false; courier.value = 'none';
  if (noneOpt) noneOpt.disabled = false;
  if (docKey === 'dispatch')  { courier.value = 'local'; if (noneOpt) noneOpt.disabled = true; }
  if (docKey === 'emailcorr') { courier.value = 'none'; courier.disabled = true; }
  if (intlWrap) intlWrap.style.display = 'none';
  document.getElementById('f-intl-count').value = 1;
  updateDeliveryOptions(docKey);
  calcFee();
}

function onCourierChange() {
  const courier  = document.getElementById('f-courier').value;
  const intlWrap = document.getElementById('intl-courier-wrap');
  if (courier === 'intl') { if (intlWrap) intlWrap.style.display = 'block'; }
  else { if (intlWrap) intlWrap.style.display = 'none'; document.getElementById('f-intl-count').value = 1; }
  calcFee();
}

function changeIntlCount(delta) {
  const input = document.getElementById('f-intl-count');
  let value   = parseInt(input.value) || 1;
  value = Math.max(1, value + delta);
  input.value = value;
  calcFee();
}

function calcFee() {
  const mainDocKey = document.getElementById('f-doctype').value;
  const delivery   = document.getElementById('f-delivery').value;
  const copies     = Math.max(1, parseInt(document.getElementById('f-copies')?.value) || 1);
  const level      = document.getElementById('f-level')?.value || '';
  const courier    = document.getElementById('f-courier')?.value || 'none';
  const emailCount = Math.max(0, parseInt(document.getElementById('f-email-copies')?.value) || 0);
  const badge      = document.getElementById('delivery-badge');
  const breakdown  = document.getElementById('fee-breakdown');
  const copiesTag  = document.getElementById('copies-tag');

  let total = 0;
  let breakdownParts = [];
  const levelKey = level === 'ug' ? 'undergraduate' : 'postgraduate';

  const NAME_MAP = { verifyDegree:'Degree Verification', verifyProv:'Provisional Verification', verifyMarks:'Marks Certificate Verification', verifyTrans:'Transcript Verification' };

  if (mainDocKey === 'verification') {
    document.querySelectorAll('.verify-check:checked').forEach(check => {
      const docKey   = check.value;
      let perCopy    = (BASE_FEES[docKey]?.[levelKey]) || 0;
      if (delivery === 'urgent' && URGENT_ALLOWED.includes(docKey)) perCopy = URGENT_FEES[levelKey]?.[docKey] || perCopy;
      let docQty = 0;
      document.querySelectorAll(`.verify-count[data-doc="${docKey}"]`).forEach(inp => { docQty += Math.max(0, parseInt(inp.value) || 0); });
      if (docQty > 0) { total += perCopy * docQty; breakdownParts.push(`${NAME_MAP[docKey]}: Rs.${perCopy.toLocaleString()} × ${docQty}`); }
    });
    if (delivery) { badge.textContent = delivery.toUpperCase(); badge.className = `delivery-badge ${delivery}`; badge.style.display = 'inline-block'; }
  } else {
    let perCopy = BASE_FEES[mainDocKey]?.[levelKey] || 0;
    if (delivery === 'urgent' && URGENT_ALLOWED.includes(mainDocKey)) perCopy = URGENT_FEES[levelKey]?.[mainDocKey] || perCopy;
    total += perCopy * copies;
    if (perCopy > 0) breakdownParts.push(`Base: Rs.${perCopy.toLocaleString()} × ${copies}`);
    if (delivery) { badge.textContent = delivery.toUpperCase(); badge.className = `delivery-badge ${delivery}`; badge.style.display = 'inline-block'; }
    else badge.style.display = 'none';
  }

  let courierFee = EXTRA_FEES.courier[courier] || 0;
  if (courier === 'intl') {
    const intlCount = Math.max(1, parseInt(document.getElementById('f-intl-count')?.value) || 1);
    courierFee *= intlCount;
    breakdownParts.push(`Intl Courier (${intlCount}): Rs.${courierFee.toLocaleString()}`);
  } else if (courierFee > 0) breakdownParts.push(`Courier: Rs.${courierFee.toLocaleString()}`);
  total += courierFee;

  if (emailCount > 0) {
    const emailFee = emailCount * EXTRA_FEES.emailPerCopy;
    total += emailFee;
    breakdownParts.push(`Email (${emailCount}): Rs.${emailFee.toLocaleString()}`);
  }

  breakdown.textContent = breakdownParts.length ? breakdownParts.join(' + ') : 'Select document type and delivery type';
  document.getElementById('fee-amount').textContent = total.toLocaleString();

  if (copies > 1 && delivery) { copiesTag.textContent = `× ${copies} copies`; copiesTag.style.display = 'inline-block'; }
  else copiesTag.style.display = 'none';

  return total;
}

/* ══════════════════════════════════════════
   FORM RESET
══════════════════════════════════════════ */

async function resetEntryForm() {
  ['f-name','f-roll','f-cnic','f-email','f-phone','f-discipline'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  ['f-dept','f-doctype','f-delivery','f-level','f-courier'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const emailEl = document.getElementById('f-email-copies'); if (emailEl) emailEl.value = '0';
  document.getElementById('f-copies').value = '1';
  document.getElementById('fee-amount').textContent  = '0';
  document.getElementById('fee-breakdown').textContent = 'Select document type and delivery type';
  document.getElementById('delivery-badge').style.display = 'none';
  document.getElementById('copies-tag').style.display     = 'none';
  document.querySelectorAll('.verify-check').forEach(cb => { cb.checked = false; });
  document.querySelectorAll('.verify-table').forEach(t  => { t.style.display = 'none'; });
  document.querySelectorAll('.verify-count').forEach(inp => { inp.value = 1; });
  const verWrap  = document.getElementById('verification-sub-wrap'); if (verWrap)  verWrap.style.display  = 'none';
  const intlWrap = document.getElementById('intl-courier-wrap');     if (intlWrap) intlWrap.style.display = 'none';
  document.querySelectorAll('.field-input.error,.field-select.error').forEach(el => el.classList.remove('error'));
  acClose();
  await initEntryForm();
}

/* ══════════════════════════════════════════
   FORM SUBMIT
══════════════════════════════════════════ */

async function submitRequest() {
  const errors = [];
  const name       = document.getElementById('f-name').value.trim();
  const roll       = document.getElementById('f-roll').value.trim();
  const dept       = document.getElementById('f-dept').value;
  const discipline = document.getElementById('f-discipline').value.trim();
  const cnic       = document.getElementById('f-cnic').value.trim();
  const email      = document.getElementById('f-email').value.trim();
  const phone      = getFullPhone();
  const docKey     = document.getElementById('f-doctype').value;
  const delivery   = document.getElementById('f-delivery').value;
  const copies     = Math.max(1, parseInt(document.getElementById('f-copies')?.value) || 1);
  const level      = document.getElementById('f-level')?.value || '';
  const courier    = document.getElementById('f-courier')?.value || 'none';
  const emailCount = Math.max(0, parseInt(document.getElementById('f-email-copies')?.value) || 0);

  if (docKey === 'verification' && !document.querySelectorAll('.verify-check:checked').length)
    errors.push('At least one Verification Document');

  const mark = (id, bad) => document.getElementById(id)?.classList.toggle('error', bad);
  mark('f-name',      !name);      if (!name)                                  errors.push('Full Name');
  mark('f-roll',      !roll);      if (!roll)                                  errors.push('Roll Number');
  mark('f-dept',      !dept);      if (!dept)                                  errors.push('Section');
  mark('f-discipline',!discipline);if (!discipline)                            errors.push('Discipline');
  mark('f-cnic',      cnic.length > 0 && cnic.length < 15); if (cnic.length > 0 && cnic.length < 15) errors.push('Valid CNIC (or leave blank)');
  mark('f-email',     !email.includes('@')); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Valid Email');
  const localPhone = document.getElementById('f-phone')?.value.replace(/\D/g,'') || '';
  mark('f-phone',     localPhone.length < 7); if (localPhone.length < 7)        errors.push('Valid Phone');
  mark('f-doctype',   !docKey);    if (!docKey)                                errors.push('Document Type');
  mark('f-delivery',  !delivery);  if (!delivery)                              errors.push('Delivery Type');
  mark('f-level',     !level);     if (!level)                                 errors.push('Programme Level');

  if (errors.length) { showToast('Required: ' + errors.join(', '), 'error'); return; }

  // Build verification details
  let verificationDetails = [];
  if (docKey === 'verification') {
    const verifyNames = { verifyDegree:'Degree', verifyProv:'Provisional', verifyMarks:'Marks Certificate', verifyTrans:'Transcript' };
    document.querySelectorAll('.verify-check:checked').forEach(cb => {
      const key        = cb.value;
      const origInput  = document.querySelector(`.verify-count[data-doc="${key}"][data-type="original"]`);
      const photoInput = document.querySelector(`.verify-count[data-doc="${key}"][data-type="photocopy"]`);
      const orig       = parseInt(origInput?.value)  || 0;
      const photo      = parseInt(photoInput?.value) || 0;
      if (orig > 0 || photo > 0) verificationDetails.push({ key, name: verifyNames[key], original: orig, photocopy: photo });
    });
  }

  // Compute total copies for verification
  const totalVerifyCopies = verificationDetails.length
    ? verificationDetails.reduce((s, d) => s + d.original + d.photocopy, 0)
    : copies;

  const fee = calcFee();

  const btn = document.querySelector('[onclick="submitRequest()"]');
  const origText = btn?.innerHTML;
  if (btn) { btn.innerHTML = '⏳ Submitting…'; btn.disabled = true; }

  const res = await API.post('requests.php?action=create', {
    name, roll, dept, discipline, cnic, email, phone,
    docKey, docLabel: DOC_LABELS[docKey] || docKey,
    verificationDetails,
    delivery, copies: docKey === 'verification' ? totalVerifyCopies : copies,
    level, courier, emailCopies: emailCount, fee,
  });

  if (btn) { btn.innerHTML = origText; btn.disabled = false; }

  if (!res.success) { showToast(res.error || 'Submission failed', 'error'); return; }

  showToast(`✓ ${res.id} submitted — Routed to ${dept}`);
  await resetEntryForm();
  updatePreviewStats();
}

/* ══════════════════════════════════════════
   COPIES DISPLAY HELPER
══════════════════════════════════════════ */

function docCopiesDisplay(r) {
  if (r.docKey === 'verification' && r.verificationDetails?.length) {
    const rows = r.verificationDetails.map(d => {
      const parts = [];
      if (d.original  > 0) parts.push(`${d.original} Orig`);
      if (d.photocopy > 0) parts.push(`${d.photocopy} Photo`);
      return `<div class="vd-pill"><span class="vd-name">${d.name}</span><span class="vd-counts">${parts.join(' · ')}</span></div>`;
    });
    return `<div class="vd-cell">${rows.join('')}</div>`;
  }
  return `<span class="badge-copies">×${r.copies || 1}</span>`;
}

/* ══════════════════════════════════════════
   VERIFICATION HELPERS
══════════════════════════════════════════ */

function toggleVerify(checkbox) {
  const doc   = checkbox.value;
  const table = document.querySelector(`.verify-table[data-doc="${doc}"]`);
  if (checkbox.checked) {
    if (table) {
      table.style.display = 'table';
      if (doc === 'verifyDegree' || doc === 'verifyProv') {
        const orig = table.querySelector('.verify-count[data-type="original"]');
        if (orig) { orig.max = 1; orig.value = 1; }
      }
    }
  } else {
    if (table) { table.style.display = 'none'; table.querySelectorAll('.verify-count').forEach(i => { i.value = 1; }); }
  }
  calcFee();
}

function changeVerifyCount(doc, type, change) {
  const input  = document.querySelector(`.verify-count[data-doc="${doc}"][data-type="${type}"]`);
  if (!input) return;
  const maxVal = (type === 'original' && (doc === 'verifyDegree' || doc === 'verifyProv')) ? 1 : 99;
  input.value  = Math.min(maxVal, Math.max(0, (parseInt(input.value) || 0) + change));
  calcFee();
}

/* ══════════════════════════════════════════
   COUNTER RECORDS PAGE
══════════════════════════════════════════ */

function switchCounterTab(tab) {
  counterActiveTab = tab;
  ['in','out','done'].forEach(t => document.getElementById('ctr-tab-' + t)?.classList.toggle('active', t === tab));
  loadAndRenderCounterRecords();
}

async function loadAndRenderCounterRecords() {
  const tbody  = document.getElementById('counter-records-body');
  if (tbody) tbody.innerHTML = `<tr><td colspan="13" class="empty-row" style="color:var(--muted)">Loading…</td></tr>`;

  const params = buildCounterQueryParams();
  const res    = await API.get('requests.php?action=list', params);
  if (!res.success) { showToast(res.error || 'Failed to load', 'error'); return; }

  state.requests = res.requests;
  renderCounterStats(res);
  updateCounterTabCounts(res);
  renderCounterRecordsTable(res.requests);
}

// Debounced wrapper for the live search box — waits until the person
// pauses typing before hitting the server, instead of firing on every key.
const debouncedCounterSearch = debounce(loadAndRenderCounterRecords, 350);

function buildCounterQueryParams() {
  return {
    tab:      counterActiveTab,
    search:   document.getElementById('cr-search')?.value || '',
    delivery: document.getElementById('cr-filter-delivery')?.value || '',
    doc_key:  document.getElementById('cr-filter-doc')?.value || '',
    section:  document.getElementById('cr-filter-section')?.value || '',
    ...buildCalParams('counter'),
  };
}

function renderCounterStats(res) {
  // Fetch global stats for the stat row
  API.get('requests.php?action=stats', {}).then(r => {
    if (!r.success) return;
    const s = r.stats;
    document.getElementById('cr-total').textContent     = s.total;
    document.getElementById('cr-pending').textContent   = s.pending;
    document.getElementById('cr-completed').textContent = s.completed;
    document.getElementById('cr-received').textContent  = s.received;
  });
}

function updateCounterTabCounts() {
  // Use current filter params so tab badges reflect filtered counts
  const cur = buildCounterQueryParams();
  const base = { search: cur.search, delivery: cur.delivery, doc_key: cur.doc_key, section: cur.section,
    date_from: cur.date_from || '', date_to: cur.date_to || '' };
  Promise.all([
    API.get('requests.php?action=list', {...base, tab:'in',   limit:1}),
    API.get('requests.php?action=list', {...base, tab:'out',  limit:1}),
    API.get('requests.php?action=list', {...base, tab:'done', limit:1}),
  ]).then(([inR, outR, doneR]) => {
    document.getElementById('ctr-in-count').textContent   = inR.total   ?? 0;
    document.getElementById('ctr-out-count').textContent  = outR.total  ?? 0;
    document.getElementById('ctr-done-count').textContent = doneR.total ?? 0;
  });
}

function renderCounterRecordsTable(rows) {
  const tbody   = document.getElementById('counter-records-body');
  const countEl = document.getElementById('cr-filter-count');
  if (!tbody) return;

  countEl.textContent = (rows?.length ?? 0) + ' record' + ((rows?.length ?? 0) !== 1 ? 's' : '');

  if (!rows?.length) { tbody.innerHTML = `<tr><td colspan="14" class="empty-row">No records match your filters</td></tr>`; return; }

  // Every request's routing history, regardless of tab: where it last came
  // from (its previous section, or the original submitting section if it
  // has never been transferred) and where it currently sits.
  const routedLabels = (r) => {
    const routedTo = r.routedTo || '—';
    let routedFrom = r.dept || '—';
    if (r.transferLog?.length > 0) {
      routedFrom = r.transferLog[r.transferLog.length - 1].from || routedFrom;
    }
    return { routedFrom, routedTo };
  };

  if (counterActiveTab === 'done') {
    tbody.innerHTML = rows.map(r => {
      const { routedFrom, routedTo } = routedLabels(r);
      return `
    <tr class="${r.status === 'Received' ? 'row-received' : ''}">
      <td><strong class="req-id-cell">${r.id}</strong></td>
      <td><div style="font-weight:600">${r.name}</div><div style="font-size:0.74rem;color:var(--muted)">${r.email}</div></td>
      <td>${r.roll}</td>
      <td style="font-size:0.81rem;color:var(--mid)">${r.discipline}</td>
      <td>${r.docLabel}</td>
      <td>${levelLabel(r.level)}</td>
      <td>${docCopiesDisplay(r)}</td>
      <td><span class="badge badge-${r.delivery === 'Urgent' ? 'urgent' : 'normal'}">${r.delivery}</span></td>
      <td><strong>Rs. ${(r.fee||0).toLocaleString()}</strong></td>
      <td style="color:var(--mid);font-size:0.81rem;font-weight:600">${routedFrom}</td>
      <td style="color:var(--teal);font-size:0.81rem;font-weight:600">${routedTo}</td>
      <td style="font-size:0.78rem;color:var(--muted)">${r.datetime||'—'}</td>
      <td><span class="badge ${r.status==='Received'?'badge-received':'badge-approved'}">${r.status}</span></td>
      <td>
        <div class="action-row">
          <button class="btn-sm-received ${r.status==='Received'?'is-received':''}" onclick="saveCounterReceived('${r.id}',this)">✓ Received</button>
          <button class="btn-sm-view" onclick="openModal('${r.id}')">View</button>
        </div>
      </td>
    </tr>`;
    }).join('');
    return;
  }

  tbody.innerHTML = rows.map(r => {
    const { routedFrom, routedTo } = routedLabels(r);
    return `
    <tr>
      <td><strong class="req-id-cell">${r.id}</strong></td>
      <td><div style="font-weight:600">${r.name}</div><div style="font-size:0.74rem;color:var(--muted)">${r.email}</div></td>
      <td>${r.roll}</td>
      <td style="font-size:0.81rem;color:var(--mid)">${r.discipline}</td>
      <td>${r.docLabel}</td>
      <td>${levelLabel(r.level)}</td>
      <td>${docCopiesDisplay(r)}</td>
      <td><span class="badge badge-${r.delivery==='Urgent'?'urgent':'normal'}">${r.delivery}</span></td>
      <td><strong>Rs. ${(r.fee||0).toLocaleString()}</strong></td>
      <td style="color:var(--mid);font-size:0.81rem;font-weight:600">${routedFrom}</td>
      <td style="color:var(--teal);font-size:0.81rem;font-weight:600">${routedTo}</td>
      <td style="font-size:0.78rem;color:var(--muted)">${r.datetime||'—'}</td>
      <td><span class="badge ${STATUS_BADGE[r.status]||'badge-pending'}">${r.status}</span></td>
      <td>
        <div class="action-row">
          <select class="status-dropdown" data-status="${r.status}" onchange="saveCounterStatus('${r.id}',this.value)">
            <option value="Pending"   ${r.status!=='Completed'?'selected':''}>Pending</option>
            <option value="Completed" ${r.status==='Completed'?'selected':''}>Completed</option>
          </select>
        </div>
      </td>
    </tr>`;
  }).join('');
}

async function saveCounterStatus(id, newStatus) {
  const res = await API.post('requests.php?action=update_status', { id, status: newStatus });
  if (!res.success) { showToast(res.error || 'Update failed', 'error'); return; }
  showToast(`✓ ${id} → "${newStatus}"`);
  loadAndRenderCounterRecords();
  updatePreviewStats();
}

async function saveCounterReceived(id, btn) {
  const current = btn.classList.contains('is-received') ? 'Received' : 'Completed';
  const next    = current === 'Received' ? 'Completed' : 'Received';
  const res     = await API.post('requests.php?action=update_status', { id, status: next });
  if (!res.success) { showToast(res.error || 'Update failed', 'error'); return; }
  showToast(`✓ ${id} → "${next}"`);
  loadAndRenderCounterRecords();
}

async function exportCounterCSV() {
  const params = buildCounterQueryParams();
  window.location.href = `api/requests.php?action=export&${new URLSearchParams(params)}`;
}

/* ══════════════════════════════════════════
   DEPARTMENT QUEUE
══════════════════════════════════════════ */

function switchDeptTab(tab) {
  deptActiveTab = tab;
  ['in','out','done'].forEach(t => document.getElementById('tab-' + t).classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  loadAndRenderDept();
}

async function loadAndRenderDept() {
  const tbody = document.getElementById('dept-tbody');
  if (tbody) tbody.innerHTML = `<tr><td colspan="12" class="empty-row" style="color:var(--muted)">Loading…</td></tr>`;

  const params = {
    tab:      deptActiveTab,
    search:   document.getElementById('dept-search')?.value || '',
    delivery: document.getElementById('dept-filter-delivery')?.value || '',
    doc_key:  document.getElementById('dept-filter-doc')?.value || '',
    ...buildCalParams('dept'),
  };

  const res = await API.get('requests.php?action=list', params);
  if (!res.success) { showToast(res.error || 'Failed to load', 'error'); return; }

  renderDeptStats(res);
  updateDeptTabCounts();
  renderDeptTable(res.requests);
}

// Debounced wrapper for the department queue's live search box.
const debouncedDeptSearch = debounce(loadAndRenderDept, 350);

function renderDeptStats() {
  API.get('requests.php?action=stats', {}).then(r => {
    if (!r.success) return;
    const s = r.stats;
    document.getElementById('ds-total').textContent     = s.total;
    document.getElementById('ds-pending').textContent   = s.pending;
    document.getElementById('ds-completed').textContent = s.completed;
    document.getElementById('ds-received').textContent  = s.received;
  });
  const sub = document.getElementById('dept-page-sub');
  if (sub) sub.textContent = `Requests assigned to: ${state.dept}`;
}

function updateDeptTabCounts() {
  // Use current filter params so tab badges reflect filtered counts
  const base = {
    search:   document.getElementById('dept-search')?.value || '',
    delivery: document.getElementById('dept-filter-delivery')?.value || '',
    doc_key:  document.getElementById('dept-filter-doc')?.value || '',
    ...buildCalParams('dept'),
  };
  Promise.all([
    API.get('requests.php?action=list', { ...base, tab:'in',   limit:1 }),
    API.get('requests.php?action=list', { ...base, tab:'out',  limit:1 }),
    API.get('requests.php?action=list', { ...base, tab:'done', limit:1 }),
  ]).then(([inR, outR, doneR]) => {
    document.getElementById('tab-in-count').textContent   = inR.total   ?? 0;
    document.getElementById('tab-out-count').textContent  = outR.total  ?? 0;
    const doneEl = document.getElementById('tab-done-count');
    if (doneEl) doneEl.textContent = doneR.total ?? 0;
  });
}

function renderDeptTable(rows) {
  const tbody   = document.getElementById('dept-tbody');
  const countEl = document.getElementById('dept-filter-count');
  countEl.textContent = (rows?.length ?? 0) + ' record' + ((rows?.length ?? 0) !== 1 ? 's' : '');

  if (!rows?.length) { tbody.innerHTML = '<tr><td colspan="12" class="empty-row">No requests match</td></tr>'; return; }

  if (deptActiveTab === 'done') {
    tbody.innerHTML = rows.map(r => `
    <tr class="${r.status==='Received'?'row-received':''}">
      <td><strong class="req-id-cell">${r.id}</strong></td>
      <td><div style="font-weight:600">${r.name}</div><div style="font-size:0.75rem;color:var(--muted)">${r.email}</div></td>
      <td>${r.roll}</td>
      <td style="font-size:0.81rem;color:var(--mid)">${r.discipline||'—'}</td>
      <td>${r.docLabel}</td><td>${levelLabel(r.level)}</td>
      <td>${docCopiesDisplay(r)}</td>
      <td><span class="badge badge-${r.delivery==='Urgent'?'urgent':'normal'}">${r.delivery}</span></td>
      <td><strong>Rs. ${r.fee.toLocaleString()}</strong></td>
      <td style="font-size:0.79rem;color:var(--muted)">${r.datetime}</td>
      <td><span class="badge ${r.status==='Received'?'badge-received':'badge-approved'}">${r.status}</span></td>
      <td>
        <div class="action-row">
          <button class="btn-sm-received ${r.status==='Received'?'is-received':''}" onclick="saveDeptReceived('${r.id}',this)">✓ Received</button>
          <button class="btn-sm-view" onclick="openModal('${r.id}')">View</button>
        </div>
      </td>
    </tr>`).join('');
    return;
  }

  if (deptActiveTab === 'out') {
    tbody.innerHTML = rows.map(r => {
      const last = (r.transferLog||[]).slice(-1)[0];
      return `
      <tr>
        <td><strong class="req-id-cell">${r.id}</strong></td>
        <td><div style="font-weight:600">${r.name}</div><div style="font-size:0.75rem;color:var(--muted)">${r.email}</div></td>
        <td>${r.roll}</td>
        <td style="font-size:0.81rem;color:var(--mid)">${r.discipline||'—'}</td>
        <td>${r.docLabel}</td><td>${levelLabel(r.level)}</td>
        <td>${docCopiesDisplay(r)}</td>
        <td><span class="badge badge-${r.delivery==='Urgent'?'urgent':'normal'}">${r.delivery}</span></td>
        <td><strong>Rs. ${r.fee.toLocaleString()}</strong></td>
        <td style="font-size:0.79rem;color:var(--muted)">${r.datetime}</td>
        <td><span style="font-size:0.78rem;color:var(--teal);font-weight:600">→ ${last?.to||r.currentHolder}</span><div style="font-size:0.72rem;color:var(--muted)">${last?.at||''}</div></td>
        <td><button class="btn-sm-view" onclick="openModal('${r.id}')">View</button></td>
      </tr>`;
    }).join('');
    return;
  }

  tbody.innerHTML = rows.map(r => `
    <tr class="${r.status==='Received'?'row-received':''}">
      <td><strong class="req-id-cell">${r.id}</strong></td>
      <td><div style="font-weight:600">${r.name}</div><div style="font-size:0.75rem;color:var(--muted)">${r.email}</div></td>
      <td>${r.roll}</td>
      <td style="font-size:0.81rem;color:var(--mid)">${r.discipline||'—'}</td>
      <td>${r.docLabel}</td><td>${levelLabel(r.level)}</td>
      <td>${docCopiesDisplay(r)}</td>
      <td><span class="badge badge-${r.delivery==='Urgent'?'urgent':'normal'}">${r.delivery}</span></td>
      <td><strong>Rs. ${r.fee.toLocaleString()}</strong></td>
      <td style="font-size:0.79rem;color:var(--muted)">${r.datetime}</td>
      <td><span class="badge ${STATUS_BADGE[r.status]||'badge-pending'}">${r.status}</span></td>
      <td>
        <div class="action-row">
          <select class="status-dropdown" data-status="${r.status}" onchange="saveDeptStatus('${r.id}',this.value)">
            <option value="Pending"   ${r.status!=='Completed'?'selected':''}>Pending</option>
            <option value="Completed" ${r.status==='Completed'?'selected':''}>Completed</option>
          </select>
          <button class="btn-sm-transfer" onclick="openTransferModal('${r.id}')">↗ Transfer</button>
          <button class="btn-sm-view" onclick="openModal('${r.id}')">View</button>
        </div>
      </td>
    </tr>`).join('');
}

async function saveDeptStatus(id, newStatus) {
  const res = await API.post('requests.php?action=update_status', { id, status: newStatus });
  if (!res.success) { showToast(res.error || 'Update failed', 'error'); return; }
  showToast(`✓ ${id} → "${newStatus}"`);
  loadAndRenderDept();
  updatePreviewStats();
}

async function saveDeptReceived(id, btn) {
  const current = btn.classList.contains('is-received') ? 'Received' : 'Completed';
  const next    = current === 'Received' ? 'Completed' : 'Received';
  const res     = await API.post('requests.php?action=update_status', { id, status: next });
  if (!res.success) { showToast(res.error || 'Update failed', 'error'); return; }
  showToast(`✓ ${id} → "${next}"`);
  loadAndRenderDept();
}

/* ── Transfer Modal ── */

function openTransferModal(id) {
  const req = state.requests.find(r => r.id === id) || { id };
  document.getElementById('transfer-modal-req-id').textContent = id;
  document.getElementById('transfer-dest').value  = '';
  document.getElementById('transfer-note').value  = '';
  document.getElementById('transfer-modal-overlay').classList.add('open');
  window._transferId = id;
}

function closeTransferModal() {
  document.getElementById('transfer-modal-overlay').classList.remove('open');
  window._transferId = null;
}

async function confirmTransfer() {
  const id   = window._transferId;
  const dest = document.getElementById('transfer-dest').value;
  const note = document.getElementById('transfer-note').value.trim();
  if (!dest) { showToast('Please select a destination', 'error'); return; }

  const res = await API.post('requests.php?action=transfer', { id, dest, note });
  if (!res.success) { showToast(res.error || 'Transfer failed', 'error'); return; }

  closeTransferModal();
  showToast(`✓ ${id} transferred to ${dest}`);
  loadAndRenderDept();
  updatePreviewStats();
}

document.getElementById('transfer-modal-overlay').addEventListener('click', function(e) { if (e.target === this) closeTransferModal(); });

/* ══════════════════════════════════════════
   ADMIN DASHBOARD
══════════════════════════════════════════ */

async function loadAdminDash() {
  const [statsRes, recentRes] = await Promise.all([
    API.get('requests.php?action=stats',   {}),
    API.get('requests.php?action=list',    { limit: 10, offset: 0 }),
  ]);
  if (statsRes.success)  renderAdminKPI(statsRes.stats);
  if (recentRes.success) renderAdminRecent(recentRes.requests);

  const chartsRes = await API.get('requests.php?action=reports', {});
  if (chartsRes.success) renderAdminCharts(chartsRes);
}

function renderAdminKPI(s) {
  document.getElementById('admin-kpi').innerHTML = `
    <div class="kpi-card"><div class="kpi-val">${s.total}</div><div class="kpi-lbl">Total Requests</div>
      <div class="kpi-icon"><svg viewBox="0 0 24 24"><path d="M20 6h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/></svg></div>
    </div>
    <div class="kpi-card top-teal"><div class="kpi-val" style="color:#c2410c">${s.pending}</div><div class="kpi-lbl">Pending</div></div>
    <div class="kpi-card top-green"><div class="kpi-val" style="color:#22c55e">${s.completed}</div><div class="kpi-lbl">Completed</div></div>
    <div class="kpi-card top-purple"><div class="kpi-val" style="color:#166534">${s.received}</div><div class="kpi-lbl">Received</div></div>
    <div class="kpi-card"><div class="kpi-val" style="font-size:1.3rem">Rs.${Number(s.revenue||0).toLocaleString()}</div><div class="kpi-lbl">Total Fee</div></div>`;
}

function buildBarChart(data, colors) {
  const maxVal  = Math.max(...data.map(d => d.cnt), 1);
  if (!data.length) return '<div style="color:var(--muted);font-size:0.84rem">No data yet</div>';
  return `<div class="bar-chart">${data.map((d, i) => `
    <div class="bar-row">
      <div class="bar-lbl" title="${d.label}">${d.label}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(d.cnt/maxVal*100).toFixed(1)}%;background:${colors[i%colors.length]}"></div></div>
      <div class="bar-num">${d.cnt}</div>
    </div>`).join('')}</div>`;
}

function buildStatusChart(data, total) {
  if (!data.length) return '<div style="color:var(--muted);font-size:0.84rem">No data yet</div>';
  return `<div class="donut-list">${data.map(d => `
    <div class="donut-row">
      <div class="dot-circle" style="background:${STATUS_COLORS[d.label]||'#888'}"></div>
      <div class="donut-label">${d.label}</div>
      <div class="donut-bar"><div class="donut-fill" style="width:${(d.cnt/(total||1)*100).toFixed(1)}%;background:${STATUS_COLORS[d.label]||'#888'}"></div></div>
      <div class="donut-count">${d.cnt}</div>
    </div>`).join('')}</div>`;
}

function renderAdminCharts(data) {
  const total = data.byStatus.reduce((s,d) => s+d.cnt, 0);
  document.getElementById('admin-charts').innerHTML = `
    <div class="chart-card"><div class="chart-title">By Document Type <span class="chart-sub">${total} total</span></div>${buildBarChart(data.byDoc,CHART_COLORS)}</div>
    <div class="chart-card"><div class="chart-title">By Section</div>${buildBarChart(data.byDept,['#00b4d8','#f5a623','#e94560'])}</div>
    <div class="chart-card"><div class="chart-title">By Status</div>${buildStatusChart(data.byStatus,total)}</div>`;
}

function renderAdminRecent(rows) {
  const tbody = document.getElementById('admin-recent-tbody');
  if (!tbody) return;
  tbody.innerHTML = (rows||[]).map(r => `
    <tr>
      <td><strong class="req-id-cell">${r.id}</strong></td>
      <td>${r.name}</td>
      <td style="font-size:0.81rem;color:var(--mid)">${r.discipline||'—'}</td>
      <td>${r.docLabel}</td><td>${levelLabel(r.level)}</td>
      <td>${docCopiesDisplay(r)}</td>
      <td style="color:var(--teal);font-size:0.81rem;font-weight:600">${r.routedTo}</td>
      <td><span class="badge badge-${r.delivery==='Urgent'?'urgent':'normal'}">${r.delivery}</span></td>
      <td><strong>Rs. ${r.fee.toLocaleString()}</strong></td>
      <td><span class="badge ${STATUS_BADGE[r.status]||'badge-pending'}">${r.status}</span></td>
    </tr>`).join('') || '<tr><td colspan="10" class="empty-row">No requests yet</td></tr>';
}

/* ══════════════════════════════════════════
   ADMIN ALL REQUESTS
══════════════════════════════════════════ */

async function loadAndRenderAdminTable() {
  const tbody = document.getElementById('admin-tbody');
  if (tbody) tbody.innerHTML = `<tr><td colspan="14" class="empty-row" style="color:var(--muted)">Loading…</td></tr>`;

  const params = {
    search:   document.getElementById('admin-search')?.value   || '',
    doc_key:  document.getElementById('admin-filter-doc')?.value || '',
    dept:     document.getElementById('admin-filter-dept')?.value || '',
    delivery: document.getElementById('admin-filter-delivery')?.value || '',
    ...buildCalParams('admin'),
  };

  const res = await API.get('requests.php?action=list', params);
  if (!res.success) { showToast(res.error || 'Failed', 'error'); return; }
  state.requests = res.requests;
  renderAdminTable(res.requests, res.total);
}

// Debounced wrapper for the admin table's live search box.
const debouncedAdminSearch = debounce(loadAndRenderAdminTable, 350);

function renderAdminTable(rows, total) {
  const tbody   = document.getElementById('admin-tbody');
  const countEl = document.getElementById('admin-filter-count');
  if (!tbody) return;
  countEl.textContent = (total ?? rows?.length ?? 0) + ' record' + ((rows?.length ?? 0) !== 1 ? 's' : '');

  tbody.innerHTML = (rows||[]).map(r => `
    <tr class="${r.status==='Received'?'row-received':''}">
      <td><strong class="req-id-cell">${r.id}</strong></td>
      <td><div style="font-weight:600">${r.name}</div><div style="font-size:0.73rem;color:var(--muted)">${r.email}</div></td>
      <td>${r.roll}</td>
      <td style="font-size:0.81rem">${r.dept}</td>
      <td style="font-size:0.81rem;color:var(--mid)">${r.discipline||'—'}</td>
      <td>${r.docLabel}</td>
      <td>${levelLabel(r.level)}</td>
      <td>${docCopiesDisplay(r)}</td>
      <td style="color:var(--teal);font-size:0.8rem;font-weight:600">${r.routedTo}</td>
      <td><span class="badge badge-${r.delivery==='Urgent'?'urgent':'normal'}">${r.delivery}</span></td>
      <td><strong>Rs. ${r.fee.toLocaleString()}</strong></td>
      <td style="font-size:0.78rem;color:var(--muted)">${r.datetime||'—'}</td>
      <td><span class="badge ${STATUS_BADGE[r.status]||'badge-pending'}">${r.status}</span></td>
      <td>
        <div class="action-row">
          <button class="btn-sm-view" onclick="openModal('${r.id}')">View</button>
          <button class="btn-sm-del"  onclick="deleteRequest('${r.id}')">Del</button>
        </div>
      </td>
    </tr>`).join('') || '<tr><td colspan="14" class="empty-row">No requests match filters</td></tr>';
}

async function deleteRequest(id) {
  openAdminPassModal(
    `Delete Request ${id}?`,
    'This will permanently remove the request, its transfer history, and any linked documents. This cannot be undone. Enter your Admin Password to confirm:',
    async (admin_password) => {
      const res = await API.del(`requests.php?action=delete&id=${encodeURIComponent(id)}`, { admin_password });
      if (!res.success) { showToast(res.error || 'Delete failed', 'error'); return; }
      showToast(`Request ${id} deleted`);
      loadAndRenderAdminTable();
      loadAdminDash();
      updatePreviewStats();
    }
  );
}

/* ── Generic confirm dialog (theme-matched replacement for window.confirm) ── */
let _confirmOkHandler = null;

function openConfirmModal({ title, message, okLabel = 'Confirm', onConfirm }) {
  document.getElementById('confirm-modal-title').textContent = title;
  document.getElementById('confirm-modal-message').textContent = message;
  const okBtn = document.getElementById('confirm-modal-ok-btn');
  okBtn.textContent = okLabel;
  _confirmOkHandler = onConfirm;
  document.getElementById('confirm-modal-overlay').classList.add('open');
}

function closeConfirmModal() {
  document.getElementById('confirm-modal-overlay').classList.remove('open');
  _confirmOkHandler = null;
}

document.getElementById('confirm-modal-ok-btn').addEventListener('click', async () => {
  const handler = _confirmOkHandler;
  closeConfirmModal();
  if (handler) await handler();
});
document.getElementById('confirm-modal-overlay').addEventListener('click', function(e) { if (e.target === this) closeConfirmModal(); });
document.getElementById('enter-token-modal-overlay').addEventListener('click', function(e) { if (e.target === this) closeEnterTokenModal(); });
document.getElementById('set-user-password-modal-overlay').addEventListener('click', function(e) { if (e.target === this) closeSetUserPasswordModal(); });

async function exportCSV() {
  const params = {
    action:   'export',
    search:   document.getElementById('admin-search')?.value   || '',
    doc_key:  document.getElementById('admin-filter-doc')?.value || '',
    dept:     document.getElementById('admin-filter-dept')?.value || '',
    delivery: document.getElementById('admin-filter-delivery')?.value || '',
    ...buildCalParams('admin'),
  };
  window.location.href = `api/requests.php?${new URLSearchParams(params)}`;
}

/* ══════════════════════════════════════════
   ADMIN REPORTS
══════════════════════════════════════════ */

async function loadAndRenderReports() {
  document.getElementById('reports-content').innerHTML = '<div style="color:var(--muted);padding:32px;text-align:center">Loading…</div>';
  const res = await API.get('requests.php?action=reports', {});
  if (!res.success) { showToast('Failed to load reports', 'error'); return; }

  const { byDoc, byDept, byStatus, byDelivery, revenue } = res;
  const total = byStatus.reduce((s, d) => s + d.cnt, 0);

  document.getElementById('reports-content').innerHTML = `
    <div class="reports-grid">
      <div class="report-card"><div class="report-card-title">Requests by Document Type</div>${buildBarChart(byDoc,CHART_COLORS)}</div>
      <div class="report-card"><div class="report-card-title">Requests by Section</div>${buildBarChart(byDept,['#00b4d8','#f5a623','#e94560'])}</div>
      <div class="report-card"><div class="report-card-title">Requests by Status</div>${buildStatusChart(byStatus,total)}</div>
      <div class="report-card"><div class="report-card-title">Normal vs Urgent Delivery</div>${buildBarChart(byDelivery,['#00b4d8','#e94560'])}</div>
    </div>
    <div class="report-card" style="margin-bottom:16px">
      <div class="report-card-title">Revenue Summary</div>
      <div class="revenue-grid">
        <div class="rev-item" style="border-left:4px solid var(--gold)"><div class="rev-label">Total Fee</div><div class="rev-val">Rs. ${Number(revenue.total).toLocaleString()}</div></div>
        <div class="rev-item" style="border-left:4px solid var(--teal)"><div class="rev-label">Normal Delivery</div><div class="rev-val">Rs. ${Number(revenue.normal).toLocaleString()}</div></div>
        <div class="rev-item" style="border-left:4px solid var(--accent)"><div class="rev-label">Urgent Delivery</div><div class="rev-val">Rs. ${Number(revenue.urgent).toLocaleString()}</div></div>
        <div class="rev-item" style="border-left:4px solid var(--purple)"><div class="rev-label">Avg Fee / Request</div><div class="rev-val">Rs. ${Math.round(revenue.avg_fee).toLocaleString()}</div></div>
      </div>
    </div>`;
}

/* ══════════════════════════════════════════
   MODAL
══════════════════════════════════════════ */

function calcExpectedDate(datetimeStr, delivery) {
  if (!datetimeStr) return '—';
  const datePart = datetimeStr.split(' ')[0];
  const parts    = datePart.split('/');
  if (parts.length < 3) return '—';
  const [d, m, y] = parts.map(Number);
  const submitted  = new Date(y, m - 1, d);
  if (isNaN(submitted)) return '—';
  const workingDays = (delivery === 'Urgent') ? 10 : 20;
  let count = 0, current = new Date(submitted);
  while (count < workingDays) { current.setDate(current.getDate() + 1); const dow = current.getDay(); if (dow !== 0 && dow !== 6) count++; }
  return current.toLocaleDateString('en-PK', { day:'numeric', month:'long', year:'numeric' });
}

function buildVerificationTable(details) {
  if (!details?.length) return '';
  const rows = details.map(d => {
    const origCell  = d.original  > 0 ? `<span class="vtbl-badge orig">${d.original} Original</span>`   : '<span class="vtbl-none">—</span>';
    const photoCell = d.photocopy > 0 ? `<span class="vtbl-badge photo">${d.photocopy} Photocopy</span>` : '<span class="vtbl-none">—</span>';
    return `<tr><td class="vtbl-name">${d.name}</td><td class="vtbl-cell">${origCell}</td><td class="vtbl-cell">${photoCell}</td></tr>`;
  }).join('');
  return `<div class="vtbl-wrap"><table class="vtbl"><thead><tr><th class="vtbl-th">Document</th><th class="vtbl-th">Originals</th><th class="vtbl-th">Photocopies</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

async function openModal(id) {
  // Try cache first, then fetch
  let req = state.requests.find(r => r.id === id);
  if (!req) {
    const res = await API.get('requests.php?action=get', { id });
    if (!res.success) { showToast('Request not found', 'error'); return; }
    req = res.request;
    req.name     = req.student_name  || req.name;
    req.roll     = req.roll_number   || req.roll;
    req.docKey   = req.doc_key       || req.docKey;
    req.docLabel = req.doc_label     || req.docLabel;
    req.level    = req.programme_level || req.level;
    req.routedTo = req.routed_to     || req.routedTo;
    req.operator = req.operator;
    req.datetime = req.datetime_fmt  || req.datetime;
  }

  state.modalId = id;
  document.getElementById('modal-req-id').textContent  = req.id;
  document.getElementById('modal-student').textContent = req.name + ' · ' + req.dept;

  const isVerification   = req.docKey === 'verification';
  const expectedDate     = calcExpectedDate(req.datetime, req.delivery);
  const workingDaysLabel = req.delivery === 'Urgent' ? '10 Working Days (Urgent)' : '20 Working Days (Normal)';

  const fields = [
    ['Full Name',       req.name],
    ['Roll Number',     req.roll],
    ['Institution',     req.dept],
    ['Discipline',      req.discipline || '—'],
    ['CNIC',            req.cnic],
    ['Email',           req.email],
    ['Phone',           req.phone],
    ['Document Type',   req.docLabel],
    ['Programme Level', req.level ? (req.level === 'ug' ? 'Undergraduate' : 'Postgraduate') : '—'],
    ['Delivery Type',   `${req.delivery} <span style="font-size:0.76rem;color:var(--muted);font-weight:400">(${workingDaysLabel})</span>`],
    ['Fee Paid',        '<strong>Rs. ' + (req.fee || 0).toLocaleString() + '</strong>'],
    ['Submitted On',    req.datetime],
    ['Expected By',     `<span class="expected-date-val">${expectedDate}</span>`],
    ['Routed To',       req.routedTo],
    ['Operator',        req.operator || '—'],
    ['Current Status',  `<span class="badge ${STATUS_BADGE[req.status]||'badge-pending'}">${req.status}</span>`],
    ['Last Updated',    req.updatedAt || '<span style="color:var(--muted)">Not yet updated</span>'],
  ];

  if (!isVerification) fields.splice(9, 0, ['No. of Copies', req.copies || 1]);

  const logHTML = (req.transferLog && req.transferLog.length)
    ? `<div class="transfer-log">${req.transferLog.map(t => `
        <div class="transfer-log-item">
          <div class="tl-dot"></div>
          <div><div><span class="tl-arrow">${t.from}</span> → <span class="tl-arrow">${t.to}</span>${t.note ? ` — <em>${t.note}</em>` : ''}</div>
          <div class="tl-meta">By ${t.by} · ${t.at}</div></div>
        </div>`).join('')}</div>`
    : '<div style="color:var(--muted);font-size:0.82rem">No transfers yet</div>';

  const verifyBlock = isVerification && req.verificationDetails?.length
    ? `<div class="detail-item full-width"><div class="d-key">Verification Breakdown</div><div class="d-val">${buildVerificationTable(req.verificationDetails)}</div></div>` : '';

  document.getElementById('modal-detail-grid').innerHTML =
    fields.map(([k, v]) => `<div class="detail-item"><div class="d-key">${k}</div><div class="d-val">${v}</div></div>`).join('') +
    verifyBlock +
    `<div class="detail-item full-width"><div class="d-key">Transfer History</div><div class="d-val">${logHTML}</div></div>`;

  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() { document.getElementById('modal-overlay').classList.remove('open'); state.modalId = null; }
document.getElementById('modal-overlay').addEventListener('click', function(e) { if (e.target === this) closeModal(); });

/* ══════════════════════════════════════════
   TOAST
══════════════════════════════════════════ */

function showToast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast     = document.createElement('div');
  toast.className = 'toast' + (type==='error'?' toast-error':type==='warn'?' toast-warn':'');
  toast.textContent = msg;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 3500);
}

/* ══════════════════════════════════════════
   RIGHT-CLICK / DEVTOOLS DETERRENT
   (UX deterrent only — does not and cannot provide
   real protection against a determined technical user)
══════════════════════════════════════════ */

document.addEventListener('contextmenu', e => e.preventDefault());

document.addEventListener('keydown', e => {
  const k = e.key.toUpperCase();
  const blockCombo =
    k === 'F12' ||
    (e.ctrlKey && e.shiftKey && (k === 'I' || k === 'J' || k === 'C')) ||
    (e.ctrlKey && k === 'U');
  if (blockCombo) e.preventDefault();
});

/* ══════════════════════════════════════════
   AUTO-REFRESH (60s)
══════════════════════════════════════════ */

setInterval(() => {
  if (document.getElementById('app').style.display === 'none') return;
  updatePreviewStats();
  if (state.currentPage === 'page-counter-records') loadAndRenderCounterRecords();
  if (state.currentPage === 'page-dept')            loadAndRenderDept();
  if (state.currentPage === 'page-admin-dash')      loadAdminDash();
  if (state.currentPage === 'page-admin-requests')  loadAndRenderAdminTable();
  if (state.currentPage === 'page-admin-reports')   loadAndRenderReports();
}, 60000);

/* ═══════════════════════════════════════════════════════
   CALENDAR DATE FILTER  (unchanged from v3 — no backend dep)
═══════════════════════════════════════════════════════ */

const calState = {
  open: false, viewYear: new Date().getFullYear(), viewMonth: new Date().getMonth(),
  selectedStart: null, selectedEnd: null, hoveredDate: null, mode: 'day', context: null
};

function buildCalParams(ctx) {
  if (!calState.selectedStart || calState.context !== ctx) return {};
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const end = calState.selectedEnd || calState.selectedStart;
  return { date_from: fmt(calState.selectedStart), date_to: fmt(end) };
}

const CAL_MONTHS_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CAL_MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CAL_DAYS_SHORT   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function injectCalCSS() {
  if (document.getElementById('cal-css')) return;
  const s = document.createElement('style');
  s.id = 'cal-css';
  s.textContent = `
.cal-trigger-wrap{display:flex;align-items:center;gap:4px}
.cal-trigger-btn{display:inline-flex;align-items:center;gap:7px;height:38px;padding:0 14px;border-radius:var(--radius-sm);border:1.5px solid var(--border);background:var(--surface,#f5f4f9);color:var(--ink);font-family:'Jost',sans-serif;font-size:.82rem;font-weight:500;cursor:pointer;transition:border-color .18s,background .18s,color .18s;white-space:nowrap}
.cal-trigger-btn:hover{border-color:var(--mid);background:#eef0f7}
.cal-trigger-btn.cal-active{border-color:var(--teal);background:rgba(0,180,216,.08);color:var(--teal-dark,#0077a8);font-weight:600}
.cal-btn-icon{width:15px;height:15px;fill:var(--muted);flex-shrink:0;transition:fill .18s}
.cal-trigger-btn.cal-active .cal-btn-icon{fill:var(--teal)}
.cal-trigger-btn:hover .cal-btn-icon{fill:var(--mid)}
.cal-trigger-label{max-width:190px;overflow:hidden;text-overflow:ellipsis}
.cal-arrow-icon{font-size:.68rem;color:var(--muted);margin-left:1px}
.cal-clear-btn{width:26px;height:26px;border-radius:50%;border:1.5px solid var(--border);background:#fff1f2;color:#be123c;font-size:.75rem;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:background .15s,border-color .15s;padding:0;font-family:'Jost',sans-serif}
.cal-clear-btn:hover{background:#fecdd3;border-color:#fda4af}
.cal-popup{position:fixed;z-index:9999;width:320px;background:#fff;border:1.5px solid var(--border);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);opacity:0;transform:translateY(-6px) scale(.97);pointer-events:none;transition:opacity .2s cubic-bezier(.34,1.4,.64,1),transform .2s cubic-bezier(.34,1.4,.64,1);overflow:hidden}
.cal-popup.open{opacity:1;transform:translateY(0) scale(1);pointer-events:all}
.cal-popup-accent{height:4px;background:linear-gradient(90deg,var(--gold),var(--teal))}
.cal-popup-inner{padding:18px 18px 16px}
.cal-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.cal-header-center{display:flex;align-items:center;gap:4px}
.cal-month-btn{background:none;border:none;color:var(--ink);font-family:'Playfair Display',serif;font-size:.98rem;font-weight:700;cursor:pointer;padding:4px 7px;border-radius:var(--radius-sm);transition:background .14s,color .14s}
.cal-month-btn:hover{background:rgba(0,180,216,.1);color:var(--teal-dark)}
.cal-nav-btn{width:30px;height:30px;border-radius:var(--radius-sm);border:1.5px solid var(--border);background:var(--surface,#f5f4f9);color:var(--mid);font-size:1rem;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:border-color .14s,background .14s}
.cal-nav-btn:hover{border-color:var(--mid);background:#eef0f7}
.cal-year-wrap{display:flex;align-items:center;gap:3px}
.cal-year-arrow{width:22px;height:22px;border-radius:6px;border:1.5px solid var(--border);background:var(--surface,#f5f4f9);color:var(--mid);font-size:.95rem;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;transition:border-color .13s,background .13s,color .13s;flex-shrink:0}
.cal-year-arrow:hover{border-color:var(--mid);background:#eef0f7;color:var(--ink)}
.cal-select-wrap{position:relative;display:flex;align-items:center}
.cal-year-select{appearance:none;-webkit-appearance:none;height:28px;padding:0 22px 0 8px;border-radius:7px;border:1.5px solid var(--border);background:var(--surface,#f5f4f9);color:var(--ink);font-family:'Playfair Display',serif;font-size:.9rem;font-weight:700;cursor:pointer;outline:none;transition:border-color .15s,background .15s;min-width:68px}
.cal-year-select:focus,.cal-year-select:hover{border-color:var(--mid);background:#eef0f7}
.cal-select-chevron{position:absolute;right:4px;width:14px;height:14px;fill:var(--muted);pointer-events:none}
.cal-day-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
.cal-wkday{text-align:center;font-size:.67rem;font-weight:700;color:var(--muted);letter-spacing:.07em;text-transform:uppercase;padding:4px 0 7px}
.cal-day{aspect-ratio:1;border-radius:7px;border:none;background:transparent;color:var(--ink);font-family:'Jost',sans-serif;font-size:.82rem;font-weight:400;cursor:pointer;transition:background .12s,color .12s;position:relative;display:flex;align-items:center;justify-content:center;padding:0}
.cal-day:hover:not(.cal-selected){background:rgba(0,180,216,.12);color:var(--teal-dark)}
.cal-day.other-month{color:#c5c5d8}
.cal-day.cal-today{font-weight:700;color:var(--gold-dark)}
.cal-day.cal-today::after{content:'';position:absolute;bottom:3px;left:50%;transform:translateX(-50%);width:4px;height:4px;border-radius:50%;background:var(--gold)}
.cal-day.cal-selected{background:var(--mid)!important;color:#fff!important;font-weight:700;border-radius:7px;z-index:1;box-shadow:0 2px 8px rgba(15,52,96,.25)}
.cal-day.in-range{background:rgba(0,180,216,.13);color:var(--teal-dark);border-radius:0}
.cal-day.in-hover{background:rgba(0,180,216,.07);color:var(--teal-dark);border-radius:0}
.cal-month-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:6px 0}
.cal-month-item{padding:9px 4px;border-radius:var(--radius-sm);border:1.5px solid var(--border);background:var(--surface,#f5f4f9);color:var(--ink);font-family:'Jost',sans-serif;font-size:.81rem;font-weight:500;cursor:pointer;text-align:center;transition:border-color .13s,background .13s,color .13s}
.cal-month-item:hover{border-color:var(--mid);background:#eef0f7}
.cal-month-item.cal-selected{background:var(--mid)!important;border-color:var(--mid)!important;color:#fff!important;font-weight:700}
.cal-footer{margin-top:14px;padding-top:13px;border-top:1px solid var(--border)}
.cal-range-display{font-family:'Jost',sans-serif;font-size:.79rem;color:var(--muted);margin-bottom:11px;min-height:22px;display:flex;align-items:center;gap:5px;flex-wrap:wrap}
.cal-rpill{display:inline-flex;align-items:center;padding:2px 9px;border-radius:20px;font-weight:600;font-size:.76rem}
.cal-rpill.start{background:rgba(15,52,96,.1);color:var(--mid);border:1px solid rgba(15,52,96,.2)}
.cal-rpill.end{background:rgba(245,166,35,.12);color:var(--gold-dark);border:1px solid rgba(245,166,35,.3)}
.cal-rpill.ghost{background:#f5f4f9;color:var(--muted);border:1px dashed var(--border)}
.cal-rarrow{color:var(--muted);font-size:.75rem}
.cal-footer-actions{display:flex;justify-content:flex-end;gap:8px}
.cal-btn-ghost{padding:7px 14px;border-radius:var(--radius-sm);border:1.5px solid var(--border);background:transparent;color:var(--muted);font-family:'Jost',sans-serif;font-size:.8rem;font-weight:500;cursor:pointer;transition:border-color .14s,color .14s,background .14s}
.cal-btn-ghost:hover{border-color:#fda4af;color:#be123c;background:#fff1f2}
.cal-btn-apply{padding:7px 16px;border-radius:var(--radius-sm);border:none;background:linear-gradient(135deg,var(--mid),#1a3a6e);color:#fff;font-family:'Jost',sans-serif;font-size:.8rem;font-weight:600;cursor:pointer;transition:opacity .15s,transform .15s,box-shadow .15s;box-shadow:0 3px 12px rgba(15,52,96,.28);letter-spacing:.02em}
.cal-btn-apply:hover{opacity:.92;transform:translateY(-1px);box-shadow:0 5px 18px rgba(15,52,96,.35)}`;
  document.head.appendChild(s);
}

function injectCalPopup() {
  if (document.getElementById('cal-popup')) return;
  const el = document.createElement('div');
  el.id = 'cal-popup'; el.className = 'cal-popup';
  el.innerHTML = `<div class="cal-popup-accent"></div><div class="cal-popup-inner">
    <div class="cal-header">
      <button class="cal-nav-btn" onclick="calNav(-1)">&#8249;</button>
      <div class="cal-header-center">
        <button class="cal-month-btn" id="cal-month-lbl" onclick="setCalMode('month')"></button>
        <div class="cal-year-wrap">
          <button class="cal-year-arrow" onclick="calYearStep(-1)">&#8249;</button>
          <div class="cal-select-wrap">
            <select class="cal-year-select" id="cal-year-select" onchange="calYearDropdown(this.value)"></select>
            <svg class="cal-select-chevron" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
          </div>
          <button class="cal-year-arrow" onclick="calYearStep(1)">&#8250;</button>
        </div>
      </div>
      <button class="cal-nav-btn" onclick="calNav(1)">&#8250;</button>
    </div>
    <div id="cal-body"></div>
    <div class="cal-footer">
      <div class="cal-range-display" id="cal-range-disp">Select a start date</div>
      <div class="cal-footer-actions">
        <button class="cal-btn-ghost" onclick="clearCalendar(calState.context)">Clear</button>
        <button class="cal-btn-apply" onclick="applyCalFilter()">Apply Filter</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(el);
  document.addEventListener('mousedown', e => {
    if (!calState.open) return;
    if (!el.contains(e.target) && !e.target.closest('.cal-trigger-wrap')) closeCalendar();
  });
}

function injectCalButtons() {
  const pages = [
    { pageId: 'page-admin-requests', ctx: 'admin',   insertBefore: '.btn-primary.sm' },
    { pageId: 'page-dept',           ctx: 'dept',    insertBefore: '.filter-count'   },
    { pageId: 'page-counter-records',ctx: 'counter', insertBefore: '.filter-count'   },
  ];
  pages.forEach(({ pageId, ctx, insertBefore }) => {
    const bar = document.querySelector(`#${pageId} .filter-bar`);
    if (!bar || document.getElementById(`cal-wrap-${ctx}`)) return;
    const wrap = buildCalTrigger(ctx);
    const before = bar.querySelector(insertBefore);
    bar.insertBefore(wrap, before || null);
  });
}

function buildCalTrigger(ctx) {
  const wrap = document.createElement('div');
  wrap.className = 'cal-trigger-wrap'; wrap.id = `cal-wrap-${ctx}`;
  wrap.innerHTML = `
    <button class="cal-trigger-btn" id="cal-trig-${ctx}" onclick="openCalendar('${ctx}')">
      <svg class="cal-btn-icon" viewBox="0 0 24 24"><path d="M20 3h-1V1h-2v2H7V1H5v2H4C2.9 3 2 3.9 2 5v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 18H4V8h16v13z"/></svg>
      <span class="cal-trigger-label" id="cal-lbl-${ctx}">Date Filter</span>
      <span class="cal-arrow-icon">▾</span>
    </button>
    <button class="cal-clear-btn" id="cal-x-${ctx}" onclick="clearCalendar('${ctx}')" style="display:none">✕</button>`;
  return wrap;
}

function openCalendar(ctx) {
  calState.context = ctx; calState.open = true; calState.mode = 'day';
  if (calState.selectedStart) { calState.viewYear = calState.selectedStart.getFullYear(); calState.viewMonth = calState.selectedStart.getMonth(); }
  else { calState.viewYear = new Date().getFullYear(); calState.viewMonth = new Date().getMonth(); }
  const popup = document.getElementById('cal-popup');
  popup.style.top = '-9999px'; popup.style.left = '-9999px';
  popup.classList.add('open');
  renderCalBody();
  requestAnimationFrame(() => {
    const trigger  = document.getElementById(`cal-wrap-${ctx}`);
    if (!trigger) return;
    const trigRect = trigger.getBoundingClientRect();
    const popupW   = popup.offsetWidth || 320, popupH = popup.offsetHeight || 430;
    const vpW = window.innerWidth, vpH = window.innerHeight;
    let top  = trigRect.bottom + 6; if (top + popupH > vpH - 10) top = trigRect.top - popupH - 6; if (top < 10) top = 10;
    let left = trigRect.left;       if (left + popupW > vpW - 10) left = vpW - popupW - 10;      if (left < 10) left = 10;
    popup.style.top = top + 'px'; popup.style.left = left + 'px';
  });
}

function closeCalendar() { calState.open = false; document.getElementById('cal-popup')?.classList.remove('open'); }

function calNav(dir) {
  if (calState.mode === 'day') {
    calState.viewMonth += dir;
    if (calState.viewMonth > 11) { calState.viewMonth = 0; calState.viewYear++; }
    if (calState.viewMonth < 0)  { calState.viewMonth = 11; calState.viewYear--; }
  } else calState.viewYear += dir;
  renderCalBody();
}

function setCalMode(mode)       { calState.mode = mode; renderCalBody(); }
function calYearStep(dir)       { calState.viewYear += dir; renderCalBody(); }
function calYearDropdown(val)   { calState.viewYear = parseInt(val); renderCalBody(); }

const CAL_YEAR_MIN = 2020, CAL_YEAR_MAX = new Date().getFullYear() + 10;

function populateYearDropdown() {
  const sel = document.getElementById('cal-year-select');
  if (!sel) return;
  if (sel.dataset.built === `${CAL_YEAR_MIN}-${CAL_YEAR_MAX}`) { sel.value = calState.viewYear; return; }
  sel.innerHTML = '';
  for (let y = CAL_YEAR_MIN; y <= CAL_YEAR_MAX; y++) {
    const opt = document.createElement('option'); opt.value = y; opt.textContent = y;
    if (y === calState.viewYear) opt.selected = true;
    sel.appendChild(opt);
  }
  sel.dataset.built = `${CAL_YEAR_MIN}-${CAL_YEAR_MAX}`;
}

function renderCalBody() {
  const monthLbl = document.getElementById('cal-month-lbl'), body = document.getElementById('cal-body');
  if (!body) return;
  monthLbl.textContent = CAL_MONTHS_FULL[calState.viewMonth];
  monthLbl.style.opacity = calState.mode !== 'day' ? '0.4' : '1';
  if (calState.viewYear < CAL_YEAR_MIN) calState.viewYear = CAL_YEAR_MIN;
  if (calState.viewYear > CAL_YEAR_MAX) calState.viewYear = CAL_YEAR_MAX;
  populateYearDropdown();
  if (calState.mode === 'day') body.innerHTML = renderDayGrid();
  else body.innerHTML = renderMonthGrid();
  updateRangePills();
}

function renderDayGrid() {
  const y = calState.viewYear, m = calState.viewMonth;
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const prevTotal   = new Date(y, m, 0).getDate();
  const today = new Date(); today.setHours(0,0,0,0);
  let html = `<div class="cal-day-grid">`;
  CAL_DAYS_SHORT.forEach(d => { html += `<div class="cal-wkday">${d}</div>`; });
  for (let i = 0; i < firstDay; i++) { const d = prevTotal - firstDay + 1 + i; const date = new Date(y, m - 1, d); html += `<button class="cal-day other-month" onclick="calDayClick(${date.getTime()})">${d}</button>`; }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(y, m, d); date.setHours(0,0,0,0); const ts = date.getTime();
    const isToday = date.getTime() === today.getTime();
    const isStart = calState.selectedStart && date.getTime() === calState.selectedStart.getTime();
    const isEnd   = calState.selectedEnd   && date.getTime() === calState.selectedEnd.getTime();
    const inRange = calState.selectedStart && calState.selectedEnd && date > calState.selectedStart && date < calState.selectedEnd;
    const inHover = calState.selectedStart && !calState.selectedEnd && calState.hoveredDate && ((date > calState.selectedStart && date <= calState.hoveredDate) || (date < calState.selectedStart && date >= calState.hoveredDate));
    let cls = 'cal-day';
    if (isStart||isEnd) cls += ' cal-selected'; if (inRange) cls += ' in-range'; if (inHover) cls += ' in-hover'; if (isToday) cls += ' cal-today';
    html += `<button class="${cls}" onclick="calDayClick(${ts})" onmouseenter="calDayHover(${ts})" onmouseleave="calDayLeave()">${d}</button>`;
  }
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  for (let i = 1; i <= totalCells - firstDay - daysInMonth; i++) { const date = new Date(y, m + 1, i); html += `<button class="cal-day other-month" onclick="calDayClick(${date.getTime()})">${i}</button>`; }
  return html + `</div>`;
}

function renderMonthGrid() {
  const selM = calState.selectedStart ? calState.selectedStart.getMonth() : -1;
  const selY = calState.selectedStart ? calState.selectedStart.getFullYear() : -1;
  let html = `<div class="cal-month-grid">`;
  CAL_MONTHS_SHORT.forEach((m, i) => { html += `<button class="cal-month-item${(selY===calState.viewYear&&selM===i)?' cal-selected':''}" onclick="calMonthClick(${i})">${m}</button>`; });
  return html + `</div>`;
}

function calDayClick(ts) {
  const date = new Date(ts); date.setHours(0,0,0,0);
  if (!calState.selectedStart || (calState.selectedStart && calState.selectedEnd)) { calState.selectedStart = date; calState.selectedEnd = null; calState.hoveredDate = null; }
  else { if (date < calState.selectedStart) { calState.selectedEnd = calState.selectedStart; calState.selectedStart = date; } else { calState.selectedEnd = date; } calState.hoveredDate = null; }
  renderCalBody();
}

function calDayHover(ts) { if (calState.selectedStart && !calState.selectedEnd) { calState.hoveredDate = new Date(ts); calState.hoveredDate.setHours(0,0,0,0); renderCalBody(); } }
function calDayLeave()   { if (calState.selectedStart && !calState.selectedEnd) { calState.hoveredDate = null; renderCalBody(); } }
function calMonthClick(m){ calState.viewMonth = m; calState.mode = 'day'; renderCalBody(); }

function updateRangePills() {
  const el = document.getElementById('cal-range-disp'); if (!el) return;
  const fmt = d => d.toLocaleDateString('en-PK', { day:'numeric', month:'short', year:'numeric' });
  if (!calState.selectedStart) { el.textContent = 'Click a date to start selection'; return; }
  if (!calState.selectedEnd)   { el.innerHTML = `<span class="cal-rpill start">${fmt(calState.selectedStart)}</span><span class="cal-rarrow">→</span><span class="cal-rpill ghost">Pick end date</span>`; return; }
  el.innerHTML = `<span class="cal-rpill start">${fmt(calState.selectedStart)}</span><span class="cal-rarrow">→</span><span class="cal-rpill end">${fmt(calState.selectedEnd)}</span>`;
}

function applyCalFilter() {
  if (!calState.selectedStart) { showToast('Select at least one date', 'warn'); return; }
  if (!calState.selectedEnd) calState.selectedEnd = new Date(calState.selectedStart);
  const ctx = calState.context;
  const fmt = d => d.toLocaleDateString('en-PK', { day:'numeric', month:'short', year:'numeric' });
  const label = calState.selectedStart.getTime() === calState.selectedEnd.getTime() ? fmt(calState.selectedStart) : `${fmt(calState.selectedStart)} – ${fmt(calState.selectedEnd)}`;
  document.getElementById(`cal-lbl-${ctx}`).textContent = label;
  document.getElementById(`cal-x-${ctx}`).style.display = 'inline-flex';
  document.getElementById(`cal-trig-${ctx}`).classList.add('cal-active');
  closeCalendar();
  if (ctx === 'admin')   loadAndRenderAdminTable();
  if (ctx === 'dept')    loadAndRenderDept();
  if (ctx === 'counter') loadAndRenderCounterRecords();
}

function clearCalendar(ctx) {
  calState.selectedStart = null; calState.selectedEnd = null; calState.hoveredDate = null;
  if (!ctx) { closeCalendar(); return; }
  document.getElementById(`cal-lbl-${ctx}`).textContent = 'Date Filter';
  document.getElementById(`cal-x-${ctx}`).style.display = 'none';
  document.getElementById(`cal-trig-${ctx}`).classList.remove('cal-active');
  closeCalendar();
  if (ctx === 'admin')   loadAndRenderAdminTable();
  if (ctx === 'dept')    loadAndRenderDept();
  if (ctx === 'counter') loadAndRenderCounterRecords();
}

function initCalendar() { injectCalCSS(); injectCalPopup(); injectCalButtons(); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initCalendar);
else initCalendar();

/* ══════════════════════════════════════════
   USER MANAGEMENT & ARCHIVING
══════════════════════════════════════════ */

const userState = {
  activeTab: 'active', // 'active' or 'archived'
  users: [],
  visiblePasswords: new Set(),
};

function switchUserTab(tab) {
  userState.activeTab = tab;
  document.getElementById('user-tab-active')?.classList.toggle('active', tab === 'active');
  document.getElementById('user-tab-archived')?.classList.toggle('active', tab === 'archived');
  loadUsers();
}

async function loadUsers() {
  const res = await API.get('users.php', { action: 'list', status: userState.activeTab });
  if (!res.success) {
    showToast(res.error || 'Failed to load users', 'error');
    return;
  }
  userState.users = res.users || [];
  
  // Also fetch count for the other tab to populate tab counters
  const otherStatus = userState.activeTab === 'active' ? 'archived' : 'active';
  const otherRes = await API.get('users.php', { action: 'list', status: otherStatus });
  const otherCount = (otherRes.users || []).length;
  
  if (userState.activeTab === 'active') {
    if (document.getElementById('active-user-count')) document.getElementById('active-user-count').textContent = userState.users.length;
    if (document.getElementById('archived-user-count')) document.getElementById('archived-user-count').textContent = otherCount;
  } else {
    if (document.getElementById('archived-user-count')) document.getElementById('archived-user-count').textContent = userState.users.length;
    if (document.getElementById('active-user-count')) document.getElementById('active-user-count').textContent = otherCount;
  }

  renderUsersTable();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function toggleUserPasswordVisibility(userId) {
  if (userState.visiblePasswords.has(userId)) {
    userState.visiblePasswords.delete(userId);
  } else {
    userState.visiblePasswords.add(userId);
  }
  renderUsersTable();
}

function renderPasswordCell(u) {
  const visible = userState.visiblePasswords.has(u.id);
  const pw = u.plain_password || '••••••••';
  const display = visible ? escapeHtml(pw) : '••••••••';
  const title = visible ? 'Hide password' : 'Show password';
  const eyeIcon = visible
    ? '<path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>'
    : '<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>';
  return `
    <div class="password-cell">
      <code class="user-password-text">${display}</code>
      <button type="button" class="password-eye-btn" onclick="toggleUserPasswordVisibility(${u.id})" title="${title}" aria-label="${title}">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">${eyeIcon}</svg>
      </button>
    </div>
  `;
}

function renderUsersTable() {
  const query = (document.getElementById('user-search')?.value || '').toLowerCase().trim();
  const filtered = userState.users.filter(u => 
    (u.username || '').toLowerCase().includes(query) ||
    (u.full_name || '').toLowerCase().includes(query) ||
    (u.email || '').toLowerCase().includes(query) ||
    (u.role || '').toLowerCase().includes(query) ||
    (u.dept || '').toLowerCase().includes(query)
  );

  if (document.getElementById('user-filter-count')) {
    document.getElementById('user-filter-count').textContent = `${filtered.length} user${filtered.length === 1 ? '' : 's'}`;
  }

  const headEl = document.getElementById('users-table-head');
  const bodyEl = document.getElementById('users-tbody');
  if (!headEl || !bodyEl) return;

  if (userState.activeTab === 'active') {
    headEl.innerHTML = `
      <tr>
        <th>ID</th>
        <th>Full Name</th>
        <th>Username</th>
        <th>NEDUET Email</th>
        <th>Password</th>
        <th>Role</th>
        <th>Department</th>
        <th>Actions</th>
      </tr>
    `;

    if (filtered.length === 0) {
      bodyEl.innerHTML = `<tr><td colspan="8" class="empty-row">No active users found</td></tr>`;
      return;
    }

    bodyEl.innerHTML = filtered.map(u => `
      <tr>
        <td><strong>#${u.id}</strong></td>
        <td>${escapeHtml(u.full_name)}</td>
        <td><code>${escapeHtml(u.username)}</code></td>
        <td>${u.email ? `<a href="mailto:${escapeHtml(u.email)}" style="color:var(--accent,#0f766e);">${escapeHtml(u.email)}</a>` : '—'}</td>
        <td>${renderPasswordCell(u)}</td>
        <td><span class="badge ${u.role === 'admin' ? 'badge-approved' : u.role === 'department' ? 'badge-received' : 'badge-pending'}">${u.role}</span></td>
        <td>${escapeHtml(u.dept || '—')}</td>
        <td>
          <button class="btn-secondary sm" style="margin-right:4px;" onclick="promptResetUserPassword(${u.id}, '${escapeJs(u.username)}')">🔑 Password</button>
          <button class="btn-secondary sm" style="background:#fee2e2;color:#991b1b;border-color:#fca5a5;" onclick="promptArchiveUser(${u.id}, '${escapeJs(u.username)}')">🗑️ Delete / Archive</button>
        </td>
      </tr>
    `).join('');

  } else { // Archived Users
    headEl.innerHTML = `
      <tr>
        <th>ID</th>
        <th>Full Name</th>
        <th>Username</th>
        <th>NEDUET Email</th>
        <th>Password</th>
        <th>Role</th>
        <th>Archived Date</th>
        <th>Archived By</th>
        <th>Actions</th>
      </tr>
    `;

    if (filtered.length === 0) {
      bodyEl.innerHTML = `<tr><td colspan="9" class="empty-row">No archived users found</td></tr>`;
      return;
    }

    bodyEl.innerHTML = filtered.map(u => `
      <tr>
        <td><strong>#${u.id}</strong></td>
        <td>${escapeHtml(u.full_name)}</td>
        <td><code>${escapeHtml(u.username)}</code></td>
        <td>${u.email ? escapeHtml(u.email) : '—'}</td>
        <td>${renderPasswordCell(u)}</td>
        <td><span class="badge badge-pending">${u.role}</span></td>
        <td>${u.archived_at ? escapeHtml(u.archived_at) : '—'}</td>
        <td>${u.archived_by ? `<code>${escapeHtml(u.archived_by)}</code>` : '—'}</td>
        <td>
          <button class="btn-primary sm" style="background:#166534;" onclick="promptRestoreUser(${u.id}, '${escapeJs(u.username)}')">♻️ Restore Account</button>
        </td>
      </tr>
    `).join('');
  }
}

function escapeJs(str) {
  return String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function openCreateUserModal() {
  document.getElementById('new-user-fullname').value = '';
  document.getElementById('new-user-username').value = '';
  document.getElementById('new-user-email').value = '';
  document.getElementById('new-user-password').value = '';
  document.getElementById('new-user-role').value = 'data-entry';
  document.getElementById('new-user-dept').value = '';
  toggleNewUserDeptSelect();
  const modal = document.getElementById('create-user-modal-overlay');
  modal.classList.add('open');
  modal.classList.add('active');
}

function closeCreateUserModal() {
  const modal = document.getElementById('create-user-modal-overlay');
  modal.classList.remove('open');
  modal.classList.remove('active');
}

function toggleNewUserDeptSelect() {
  const role = document.getElementById('new-user-role').value;
  document.getElementById('new-user-dept-wrap').style.display = (role === 'department') ? 'block' : 'none';
}

async function submitCreateUser(e) {
  e.preventDefault();
  const full_name = document.getElementById('new-user-fullname').value.trim();
  const username  = document.getElementById('new-user-username').value.trim();
  const email     = document.getElementById('new-user-email').value.trim();
  const password  = document.getElementById('new-user-password').value.trim();
  const role      = document.getElementById('new-user-role').value;
  const dept      = document.getElementById('new-user-dept').value;

  if (!full_name || !username || !email || !password || !role) {
    showToast('Please fill all required fields', 'error');
    return;
  }

  if (!isValidNeduetEmail(email)) {
    showToast('Enter a valid @neduet.pk or @neduet.edu.pk email address', 'error');
    return;
  }

  const res = await API.post('users.php?action=create', { full_name, username, email, password, role, dept });
  if (!res.success) {
    showToast(res.error || 'Failed to create user', 'error');
    return;
  }

  showToast(`User account "${res.user.username}" created successfully`, 'success');
  closeCreateUserModal();
  loadUsers();
}

/* ══════════════════════════════════════════
   ADMIN PASSWORD CONFIRMATION MODAL
══════════════════════════════════════════ */

let pendingAdminAction = null;

function openAdminPassModal(title, msg, actionCallback) {
  document.getElementById('admin-pass-modal-title').textContent = title;
  document.getElementById('admin-pass-modal-msg').textContent   = msg;
  document.getElementById('admin-confirm-password').value      = '';
  pendingAdminAction = actionCallback;
  const modal = document.getElementById('admin-pass-modal-overlay');
  modal.classList.add('open');
  modal.classList.add('active');
  setTimeout(() => document.getElementById('admin-confirm-password').focus(), 100);
}

function closeAdminPassModal() {
  const modal = document.getElementById('admin-pass-modal-overlay');
  modal.classList.remove('open');
  modal.classList.remove('active');
  pendingAdminAction = null;
}

async function submitAdminPassConfirm(e) {
  e.preventDefault();
  const admin_password = document.getElementById('admin-confirm-password').value;
  if (!admin_password) {
    showToast('Please enter your password', 'error');
    return;
  }

  if (typeof pendingAdminAction === 'function') {
    const callback = pendingAdminAction;
    closeAdminPassModal();
    await callback(admin_password);
  }
}

function promptArchiveUser(userId, username) {
  openAdminPassModal(
    `Admin Verification: Delete/Archive "${username}"`,
    `Archiving will disable login access for user account "${username}" while preserving data records. Enter your Admin Password to verify:`,
    async (admin_password) => {
      const res = await API.post('users.php?action=archive', { id: userId, admin_password });
      if (!res.success) {
        showToast(res.error || 'Failed to archive user. Password incorrect.', 'error');
        return;
      }
      showToast(res.message || `User ${username} archived successfully`, 'success');
      loadUsers();
    }
  );
}

function promptRestoreUser(userId, username) {
  openAdminPassModal(
    `Admin Verification: Restore User "${username}"`,
    `Restoring will re-enable login access for user account "${username}". Enter your Admin Password to verify:`,
    async (admin_password) => {
      const res = await API.post('users.php?action=restore', { id: userId, admin_password });
      if (!res.success) {
        showToast(res.error || 'Failed to restore user. Password incorrect.', 'error');
        return;
      }
      showToast(res.message || `User ${username} restored successfully`, 'success');
      loadUsers();
    }
  );
}

function promptResetUserPassword(userId, username) {
  document.getElementById('set-user-password-user-id').value = userId;
  document.getElementById('set-user-password-sub').textContent = `For account "${username}"`;
  document.getElementById('set-user-password-input').value = '';
  const modal = document.getElementById('set-user-password-modal-overlay');
  modal.classList.add('open');
  modal.classList.add('active');
  setTimeout(() => document.getElementById('set-user-password-input').focus(), 100);
}

function closeSetUserPasswordModal() {
  const modal = document.getElementById('set-user-password-modal-overlay');
  modal.classList.remove('open');
  modal.classList.remove('active');
}

function submitSetUserPassword(e) {
  e.preventDefault();
  const userId = document.getElementById('set-user-password-user-id').value;
  const newPass = document.getElementById('set-user-password-input').value;
  if (!newPass || newPass.length < 6) {
    showToast('Password must be at least 6 characters', 'error');
    return;
  }
  closeSetUserPasswordModal();

  openAdminPassModal(
    'Confirm Password Reset',
    'Enter your Admin Password to confirm setting this new password:',
    async (admin_password) => {
      const res = await API.post('users.php?action=reset_password', { id: userId, new_password: newPass, admin_password });
      if (!res.success) {
        showToast(res.error || 'Failed to reset password', 'error');
        return;
      }
      showToast('Password updated successfully', 'success');
      loadUsers();
    }
  );
}

/* ══════════════════════════════════════════
   FORGOT & RESET PASSWORD FLOW
══════════════════════════════════════════ */

function openForgotPasswordModal(e) {
  if (e) e.preventDefault();
  document.getElementById('forgot-email-input').value = '';
  const modal = document.getElementById('forgot-password-modal-overlay');
  modal.classList.add('open');
  modal.classList.add('active');
  setTimeout(() => document.getElementById('forgot-email-input').focus(), 100);
}

function closeForgotPasswordModal() {
  const modal = document.getElementById('forgot-password-modal-overlay');
  modal.classList.remove('open');
  modal.classList.remove('active');
}

const NEDUET_EMAIL_RE = /^[a-zA-Z0-9._%+-]+@neduet(\.edu)?\.pk$/i;

function isValidNeduetEmail(email) {
  return NEDUET_EMAIL_RE.test(String(email || '').trim());
}

let _forgotPasswordEmail = '';
let _resendCountdownTimer = null;

async function submitForgotPassword(e) {
  e.preventDefault();
  const email = document.getElementById('forgot-email-input').value.trim();
  if (!email) { showToast('Enter your registered NED email or username', 'error'); return; }
  if (email.includes('@') && !isValidNeduetEmail(email)) {
    showToast('Enter a valid @neduet.pk or @neduet.edu.pk email address', 'error');
    return;
  }

  const res = await requestPasswordResetToken(email);
  if (!res) return; // error already shown

  closeForgotPasswordModal();
  _forgotPasswordEmail = email;
  showToast(res.message || 'Password reset link sent to email', 'success');
  openEnterTokenModal(res.devToken);
}

/** Calls the forgot_password endpoint; returns the response on success,
 *  or null after showing a toast on failure (including rate-limit). */
async function requestPasswordResetToken(email) {
  const res = await API.post('auth.php?action=forgot_password', { email });
  if (!res.success) {
    showToast(res.error || 'Failed to process request', 'error');
    return null;
  }
  return res;
}

function openEnterTokenModal(devToken) {
  document.getElementById('enter-token-input').value = '';
  document.getElementById('enter-token-modal-sub').textContent =
    `We've sent a verification token to ${_forgotPasswordEmail}.`;

  const devHint = document.getElementById('enter-token-dev-hint');
  if (devToken) {
    devHint.style.display = 'block';
    devHint.textContent = `Dev mode (email not configured) — your token: ${devToken}`;
  } else {
    devHint.style.display = 'none';
    devHint.textContent = '';
  }

  const modal = document.getElementById('enter-token-modal-overlay');
  modal.classList.add('open');
  modal.classList.add('active');
  setTimeout(() => document.getElementById('enter-token-input').focus(), 100);
  startResendCountdown();
}

function closeEnterTokenModal() {
  const modal = document.getElementById('enter-token-modal-overlay');
  modal.classList.remove('open');
  modal.classList.remove('active');
  if (_resendCountdownTimer) { clearInterval(_resendCountdownTimer); _resendCountdownTimer = null; }
}

function startResendCountdown(seconds = 30) {
  const btn = document.getElementById('resend-token-btn');
  const countEl = document.getElementById('resend-countdown');
  let remaining = seconds;
  btn.disabled = true;
  countEl.parentElement.style.display = '';
  countEl.textContent = remaining;

  if (_resendCountdownTimer) clearInterval(_resendCountdownTimer);
  _resendCountdownTimer = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(_resendCountdownTimer);
      _resendCountdownTimer = null;
      btn.disabled = false;
      btn.textContent = 'Resend Token';
    } else {
      countEl.textContent = remaining;
    }
  }, 1000);
}

async function resendResetToken() {
  if (!_forgotPasswordEmail) return;
  const res = await requestPasswordResetToken(_forgotPasswordEmail);
  if (!res) return;
  showToast(res.message || 'Reset token resent', 'success');
  document.getElementById('resend-token-btn').innerHTML = 'Resend in <span id="resend-countdown">30</span>s';
  const devHint = document.getElementById('enter-token-dev-hint');
  if (res.devToken) {
    devHint.style.display = 'block';
    devHint.textContent = `Dev mode (email not configured) — your token: ${res.devToken}`;
  }
  startResendCountdown();
}

async function submitEnterToken(e) {
  e.preventDefault();
  const token = document.getElementById('enter-token-input').value.trim();
  if (!token) { showToast('Enter your reset token', 'error'); return; }

  const res = await API.get('auth.php?action=verify_reset_token', { token });
  if (!res.success) {
    showToast(res.error || 'Invalid or expired token', 'error');
    return;
  }

  closeEnterTokenModal();
  document.getElementById('reset-password-modal-sub').textContent = `Resetting password for ${res.username} (${res.email})`;
  openResetPasswordWithToken(token);
}

function openResetPasswordWithToken(token) {
  document.getElementById('reset-password-token').value = token;
  document.getElementById('reset-new-password').value = '';
  document.getElementById('reset-confirm-password').value = '';
  const modal = document.getElementById('reset-password-modal-overlay');
  modal.classList.add('open');
  modal.classList.add('active');
  setTimeout(() => document.getElementById('reset-new-password').focus(), 100);
}

function closeResetPasswordModal() {
  const modal = document.getElementById('reset-password-modal-overlay');
  modal.classList.remove('open');
  modal.classList.remove('active');
}

async function submitResetPassword(e) {
  e.preventDefault();
  const token = document.getElementById('reset-password-token').value.trim();
  const new_password = document.getElementById('reset-new-password').value.trim();
  const confirm_pass = document.getElementById('reset-confirm-password').value.trim();

  if (!token) {
    showToast('Reset token is missing or invalid', 'error');
    return;
  }
  if (!new_password || new_password.length < 6) {
    showToast('Password must be at least 6 characters long', 'error');
    return;
  }
  if (new_password !== confirm_pass) {
    showToast('Passwords do not match', 'error');
    return;
  }

  const res = await API.post('auth.php?action=reset_password_with_token', { token, new_password });
  if (!res.success) {
    showToast(res.error || 'Failed to reset password', 'error');
    return;
  }

  showToast(res.message || 'Password reset successfully! You can now log in.', 'success');
  closeResetPasswordModal();
  window.location.hash = '';
}

/* Check if URL contains reset token parameter on boot */
(async () => {
  const hash = window.location.hash || '';
  if (hash.includes('token=')) {
    const token = hash.split('token=')[1]?.split('&')[0];
    if (token) {
      const res = await API.get('auth.php?action=verify_reset_token', { token });
      if (res.success) {
        document.getElementById('reset-password-modal-sub').textContent = `Resetting password for ${res.username} (${res.email})`;
        openResetPasswordWithToken(token);
      } else {
        showToast(res.error || 'Invalid reset token', 'error');
      }
    }
  }
})();

/* ══════════════════════════════════════════
   ADMIN EMERGENCY RECOVERY
══════════════════════════════════════════ */

function openAdminRecoveryModal(e) {
  if (e) e.preventDefault();
  document.getElementById('admin-recovery-key').value = '';
  document.getElementById('admin-recovery-username').value = '';
  document.getElementById('admin-recovery-new-password').value = '';
  document.getElementById('admin-recovery-confirm-password').value = '';
  const modal = document.getElementById('admin-recovery-modal-overlay');
  modal.classList.add('open');
  modal.classList.add('active');
  setTimeout(() => document.getElementById('admin-recovery-key').focus(), 100);
}

function closeAdminRecoveryModal() {
  const modal = document.getElementById('admin-recovery-modal-overlay');
  modal.classList.remove('open');
  modal.classList.remove('active');
}

async function submitAdminRecovery(e) {
  e.preventDefault();
  const recovery_key = document.getElementById('admin-recovery-key').value.trim();
  const username = document.getElementById('admin-recovery-username').value.trim();
  const new_password = document.getElementById('admin-recovery-new-password').value.trim();
  const confirm_pass = document.getElementById('admin-recovery-confirm-password').value.trim();

  if (!recovery_key || !new_password) {
    showToast('Recovery key and new password are required', 'error');
    return;
  }
  if (new_password.length < 6) {
    showToast('Password must be at least 6 characters long', 'error');
    return;
  }
  if (new_password !== confirm_pass) {
    showToast('Passwords do not match', 'error');
    return;
  }

  const body = { recovery_key, new_password };
  if (username) body.username = username;

  const res = await API.post('auth.php?action=admin_emergency_recovery', body);
  if (!res.success) {
    showToast(res.error || 'Recovery failed', 'error');
    return;
  }

  closeAdminRecoveryModal();
  showToast(res.message || 'Admin account recovered successfully', 'success');

  const u = res.user;
  state.user = u.username;
  state.role = u.role;
  state.dept = u.dept || '';

  document.getElementById('user-avatar').textContent    = u.username[0].toUpperCase();
  document.getElementById('user-name-disp').textContent = u.full_name || u.username;
  document.getElementById('user-role-disp').textContent =
    u.role === 'data-entry' ? 'Counter' :
    u.role === 'department' ? (u.dept || 'Section') : 'Super Admin';

  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display          = 'block';
  setupNavigation();
  initEntryForm();
  updatePreviewStats();
}

/* ══════════════════════════════════════════
   DATABASE BACKUP MANAGEMENT
══════════════════════════════════════════ */

async function loadBackups() {
  const res = await API.get('backups.php', { action: 'list' });
  if (!res.success) {
    showToast(res.error || 'Failed to load backups', 'error');
    return;
  }
  renderBackupsTable(res.backups || []);
}

function renderBackupsTable(backups) {
  const bodyEl = document.getElementById('backups-tbody');
  if (!bodyEl) return;

  if (backups.length === 0) {
    bodyEl.innerHTML = `<tr><td colspan="6" class="empty-row">No backups recorded yet</td></tr>`;
    return;
  }

  bodyEl.innerHTML = backups.map(b => {
    const sizeKb = Math.round(b.size_bytes / 1024);
    const sizeStr = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(2)} MB` : `${sizeKb} KB`;
    const isSuccess = b.status === 'success';

    return `
      <tr>
        <td><strong>#${b.id}</strong></td>
        <td><code>${escapeHtml(b.filename)}</code></td>
        <td>${sizeStr}</td>
        <td><span class="badge ${isSuccess ? 'badge-approved' : 'badge-pending'}">${b.status}</span></td>
        <td>${escapeHtml(b.created_at || '—')}</td>
        <td>
          ${isSuccess ? `<button class="btn-secondary sm" onclick="promptRestoreBackup(${b.id}, '${escapeJs(b.filename)}')">⚡ Restore</button>` : '—'}
        </td>
      </tr>
    `;
  }).join('');
}

async function triggerManualBackup() {
  showToast('Creating database backup...', 'info');
  const res = await API.post('backups.php?action=trigger', {});
  if (!res.success) {
    showToast(res.error || 'Backup failed', 'error');
    return;
  }
  showToast(`Backup "${res.backup.filename}" created successfully`, 'success');
  loadBackups();
}

function promptRestoreBackup(backupId, filename) {
  openAdminPassModal(
    `Restore Database from Backup?`,
    `WARNING: Restoring from backup "${filename}" will overwrite active records with data from that backup point. Confirm with Admin Password:`,
    async (admin_password) => {
      const res = await API.post('backups.php?action=restore', { backup_id: backupId, admin_password });
      if (!res.success) {
        showToast(res.error || 'Failed to restore database', 'error');
        return;
      }
      showToast(`Database restored successfully from ${filename}`, 'success');
      loadBackups();
    }
  );
}
