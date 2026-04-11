/**
 * Fleet Manager Client Application
 * @module App
 */

// Base API endpoint configuration
const API = "";

/**
 * Debounce utility to limit the rate at which a function can fire.
 * @param {Function} fn - The function to debounce.
 * @param {number} delay - The delay in milliseconds.
 * @returns {Function} A debounced version of the function.
 */
const debounce = (fn, delay) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
};

/**
 * Throttle utility to ensure a function is only called once per specified limit.
 * @param {Function} fn - The function to throttle.
 * @param {number} limit - The time limit in milliseconds.
 * @returns {Function} A throttled version of the function.
 */
const throttle = (fn, limit) => {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

const appState = {
  socket: null,
  currentUser: null,
  drivers: { sorts: [] },
  customers: { sorts: [] },
  trips: { page: 1, limit: 10, totalPages: 1, rows: [], sorts: [] },
  fuel: { page: 1, limit: 10, totalPages: 1, sorts: [] },
  maintenance: { page: 1, limit: 10, totalPages: 1, sorts: [] }
};

// Modal management: open, close, and switch modals
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
function switchModal(from, to) { closeModal(from); openModal(to); }

/**
 * Theme & Cosmetic Management:
 * Handles switching and persistence of light/dark modes.
 */
function applyTheme(theme) {
  const icon = document.getElementById('themeIcon');
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    if (icon) icon.className = 'fa-solid fa-sun';
  } else {
    document.documentElement.removeAttribute('data-theme');
    if (icon) icon.className = 'fa-solid fa-moon';
  }
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const newTheme = current === 'light' ? 'dark' : 'light';
  localStorage.setItem('tbTheme', newTheme);
  applyTheme(newTheme);
}
(function() {
  const savedTheme = localStorage.getItem('tbTheme');
  if (savedTheme) applyTheme(savedTheme);
  // Sync theme icon for landing page
  syncLandingThemeIcon();
})();

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll('select:not([data-plain])').forEach(sel => {
    if (!sel.id) sel.id = 'sel_' + Math.random().toString(36).substr(2, 9);
    initChoice(sel);
  });
  initDraggableTableScroll();
  
  // Add event listener for customer dropdown to toggle one-time customer name field
  const customerDropdown = document.getElementById('trpCustomer');
  if (customerDropdown) {
    customerDropdown.addEventListener('change', toggleOneTimeCustomerField);
  }
});

function initDraggableTableScroll() {
  const interactiveSelector = 'button, a, input, select, textarea, label, .btn-icon, .btn-primary, .btn-secondary, .choices, .choices__inner, .choices__list';
  const headerSelector = 'thead, th';

  document.querySelectorAll('.table-responsive').forEach((wrapper) => {
    if (wrapper.dataset.dragScrollReady === 'true') return;
    wrapper.dataset.dragScrollReady = 'true';
    wrapper.style.cursor = 'grab';

    wrapper.querySelectorAll('thead, th').forEach((el) => {
      el.style.cursor = 'default';
    });

    let isPointerDown = false;
    let isDragging = false;
    let startX = 0;
    let startScrollLeft = 0;
    let pointerId = null;

    wrapper.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (event.target.closest(interactiveSelector)) return;
      if (event.target.closest(headerSelector)) return;
      if (wrapper.scrollWidth <= wrapper.clientWidth) return;

      isPointerDown = true;
      isDragging = false;
      pointerId = event.pointerId;
      startX = event.clientX;
      startScrollLeft = wrapper.scrollLeft;
      wrapper.style.cursor = 'grabbing';
      wrapper.setPointerCapture(event.pointerId);
    });

    wrapper.addEventListener('pointermove', (event) => {
      if (!isPointerDown || pointerId !== event.pointerId) return;
      const deltaX = event.clientX - startX;
      if (Math.abs(deltaX) > 6) {
        isDragging = true;
        wrapper.dataset.dragSuppressClick = 'true';
      }
      if (!isDragging) return;

      wrapper.scrollLeft = startScrollLeft - deltaX;
      document.body.style.userSelect = 'none';
      event.preventDefault();
    });

    const stopDragging = (event) => {
      if (pointerId !== null && event.pointerId !== undefined && pointerId !== event.pointerId) return;
      isPointerDown = false;
      pointerId = null;
      wrapper.style.cursor = 'grab';
      document.body.style.userSelect = '';
      window.setTimeout(() => { delete wrapper.dataset.dragSuppressClick; }, 0);
    };

    wrapper.addEventListener('pointerup', stopDragging);
    wrapper.addEventListener('pointercancel', stopDragging);
    wrapper.addEventListener('pointerleave', stopDragging);

    wrapper.addEventListener('click', (event) => {
      if (wrapper.dataset.dragSuppressClick === 'true') {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);
  });
}

function togglePasswordVisibility(trigger) {
  const field = trigger?.closest('.password-field');
  const input = field?.querySelector('input');
  const icon = trigger?.querySelector('i');
  if (!input || !icon || !trigger) return;

  const willShow = input.type === 'password';
  input.type = willShow ? 'text' : 'password';
  icon.className = willShow ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
  trigger.setAttribute('aria-label', willShow ? 'Hide password' : 'Show password');
  trigger.setAttribute('aria-pressed', willShow ? 'true' : 'false');
}

// Display authentication card (login/register)
function showAuthCard(which) {
  document.getElementById('authLoginCard').style.display = which === 'login' ? 'block' : 'none';
  document.getElementById('authRegisterCard').style.display = which === 'register' ? 'block' : 'none';
}

// Global: close all dropdown menus on outside click
window.addEventListener('click', function(e) {
  if (!e.target.closest('.dropdown')) {
    document.querySelectorAll('.dropdown-menu.show').forEach(m => m.classList.remove('show'));
  }
});

// Toggle theme for landing page
function toggleLandingTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const newTheme = current === 'light' ? 'dark' : 'light';
  localStorage.setItem('tbTheme', newTheme);
  applyTheme(newTheme);
  syncLandingThemeIcon();
}

function syncLandingThemeIcon() {
  const icon = document.getElementById('landingThemeIcon');
  if (!icon) return;
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  icon.className = isLight ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}

// Login form: handle authentication and UI state
async function handleLogin(e) {
  e.preventDefault();
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const btn      = document.querySelector('#loginForm .auth-submit-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in…'; }
  try {
    const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    localStorage.setItem('tbToken', data.token);
    localStorage.setItem('tbUser', JSON.stringify(data.user));
    enterDashboard(data.user);
  } catch (err) {
    showToast(err.message || 'Login failed', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Sign In'; }
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const full_name = document.getElementById('regName')?.value.trim() || '';
  const email     = document.getElementById('regEmail').value.trim();
  const password  = document.getElementById('regPassword').value;
  const btn       = document.querySelector('#registerForm .auth-submit-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating…'; }
  try {
    const data = await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ full_name, email, password }) });
    localStorage.setItem('tbToken', data.token);
    localStorage.setItem('tbUser', JSON.stringify(data.user));
    enterDashboard(data.user);
  } catch (err) {
    showToast(err.message || 'Registration failed', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Create Account'; }
  }
}

// Display toast notification
function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast show ${type}`;
  t.innerText = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.className = `toast ${type}`; setTimeout(() => t.remove(), 300); }, 3000);
}

// Utility: show/hide loading indicators, error, or empty states
function showLoading(c, msg = 'Loading...') { if (!c) return; c.style.position = 'relative'; const d = document.createElement('div'); d.className = 'loading'; d.innerText = msg; c.appendChild(d); }
function hideLoading(c) { if (!c) return; c.querySelectorAll('.loading').forEach(e => e.remove()); }
function showError(c, m) { const el = typeof c === 'string' ? document.getElementById(c) : c; if (el) el.innerHTML = `<div class='error'>? ${m}</div>`; }
function emptyRow(cols, msg) { return `<tr><td colspan="${cols}" class="empty">${msg}</td></tr>`; }
function errorRow(cols) { return `<tr><td colspan="${cols}" class="error">? Failed to load data</td></tr>`; }

// Utility: toggle and cancel form visibility
function toggleForm(id) { const el = document.getElementById(id); el.style.display = el.style.display === 'none' ? 'block' : 'none'; }
function cancelForm(id) { document.getElementById(id).style.display = 'none'; }
function esc(v) { return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmtCurrency(v) { return `\u20B9${Number(v||0).toLocaleString('en-IN')}`; }
function fmtDate(v) { return v ? String(v).split('T')[0] : '—'; }
function countDigits(value) { return String(value || '').replace(/\D/g, '').length; }
function pluralize(value, singular, plural = `${singular}s`) { return `${value} ${value === 1 ? singular : plural}`; }
function applyMetricValueBehavior() {
  const cards = document.querySelectorAll('.metric-card .value-row p, .dashboard-kpi-value-row p');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const needsScroll = countDigits(el.textContent) > 8;
        el.classList.toggle('metric-value-scroll', needsScroll);
        el.classList.toggle('metric-value-fit', !needsScroll);
        el.scrollLeft = 0;
        el.title = needsScroll ? `${el.textContent} (drag or swipe left/right to view)` : el.textContent;

        if (needsScroll && el.dataset.dragScrollReady !== 'true') {
          el.dataset.dragScrollReady = 'true';

          let pointerId = null;
          let startX = 0;
          let startScrollLeft = 0;

          el.addEventListener('pointerdown', (event) => {
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            if (el.scrollWidth <= el.clientWidth) return;
            pointerId = event.pointerId;
            startX = event.clientX;
            startScrollLeft = el.scrollLeft;
            el.setPointerCapture(event.pointerId);
          });

          el.addEventListener('pointermove', (event) => {
            if (pointerId !== event.pointerId) return;
            const deltaX = event.clientX - startX;
            el.scrollLeft = startScrollLeft - deltaX;
            event.preventDefault();
          });

          const stop = (event) => {
            if (pointerId !== null && event.pointerId !== undefined && event.pointerId !== pointerId) return;
            pointerId = null;
          };

          el.addEventListener('pointerup', stop);
          el.addEventListener('pointercancel', stop);
          el.addEventListener('pointerleave', stop);
        }
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.1 });

  cards.forEach(card => observer.observe(card));
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function updateDashboardMetricNotes(metrics = {}, dueSoonCount = 0) {
  const totalTrucks = Number(metrics.totalTrucks || 0);
  const totalDrivers = Number(metrics.totalDrivers || 0);
  const totalTrips = Number(metrics.totalTrips || 0);
  const activeTrips = Number(metrics.activeTrips || 0);
  const idleTrucks = Number(metrics.idleTrucks || 0);
  const pendingDues = Number(metrics.pendingCustomerDues || 0);
  const todayCollection = Number(metrics.todayCollection || 0);
  const dailyRevenue = Number(metrics.dailyRevenue || 0);
  const yesterdayRevenue = Number(metrics.yesterdayRevenue || 0);
  const monthlyRevenue = Number(metrics.monthlyRevenue || 0);
  const totalRevenue = Number(metrics.totalRevenue || 0);
  const monthlyProfit = Number(metrics.monthlyProfit || 0);
  const totalProfit = Number(metrics.profit || 0);
  const monthlyFuel = Number(metrics.monthlyFuelExpenses || 0);
  const totalFuel = Number(metrics.fuelExpenses || 0);

  setText(
    'todayCollectionNote',
    todayCollection > 0 ? 'Customer payments posted to the ledger today' : 'No customer receipts posted yet today'
  );
  setText(
    'pendingDuesNote',
    pendingDues > 0 ? 'Net receivable after customer advances and posted receipts' : 'No open customer receivable right now'
  );
  setText(
    'activeTripsNote',
    activeTrips > 0 ? `${pluralize(activeTrips, 'trip')} currently pending or ongoing` : 'No trips are active at the moment'
  );
  setText(
    'idleTrucksNote',
    totalTrucks > 0 ? `${pluralize(idleTrucks, 'truck')} free out of ${totalTrucks}` : 'Add trucks to start tracking utilization'
  );
  setText(
    'totalTrucksNote',
    totalTrucks > 0 ? `${pluralize(totalTrucks, 'fleet unit')} in operations` : 'Fleet inventory has not been set up yet'
  );
  setText(
    'totalDriversNote',
    totalDrivers > 0 ? `${pluralize(totalDrivers, 'driver')} available in the roster` : 'No drivers added to the directory yet'
  );
  setText(
    'totalTripsNote',
    totalTrips > 0 ? `${pluralize(totalTrips, 'trip')} recorded across all customers` : 'Trip billing will appear here once loads are added'
  );
  setText(
    'dailyRevenueNote',
    window.currentRevenueView === 'today'
      ? `Today vs yesterday ${fmtCurrency(yesterdayRevenue)}`
      : `Yesterday booked against today ${fmtCurrency(dailyRevenue)}`
  );
  setText(
    'totalRevenueNote',
    window.currentRevTotalView === 'total'
      ? `This month has billed ${fmtCurrency(monthlyRevenue)} so far`
      : `Lifetime billing sits at ${fmtCurrency(totalRevenue)}`
  );
  setText(
    'profitNote',
    window.currentProfTotalView === 'total'
      ? `This month margin currently ${fmtCurrency(monthlyProfit)}`
      : `Lifetime profit currently ${fmtCurrency(totalProfit)}`
  );
  setText(
    'fuelNote',
    window.currentFuelTotalView === 'total'
      ? `This month fuel spend is ${fmtCurrency(monthlyFuel)}`
      : `Lifetime fuel spend is ${fmtCurrency(totalFuel)}`
  );
  setText(
    'mtnPendingNote',
    dueSoonCount > 0 ? `${pluralize(dueSoonCount, 'truck')} has crossed the service threshold` : 'No service alerts are pending right now'
  );
}

function getProofDocumentUrl(value) {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `/uploads/proofs/${encodeURIComponent(value)}`;
}

async function viewProofDocument(maintenanceId) {
  try {
    const token = localStorage.getItem('tbToken');
    const res = await fetch(`/api/maintenance/${maintenanceId}/proof`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      showToast('Could not load proof document', 'error');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  } catch (e) {
    showToast('Failed to open proof document', 'error');
  }
}

// API utility: perform authenticated HTTP requests
async function api(path, opts = {}) {
  const h = { ...opts.headers };
  const isFormData = typeof FormData !== 'undefined' && opts.body instanceof FormData;
  if (!isFormData && !h['Content-Type']) h['Content-Type'] = 'application/json';
  const tk = localStorage.getItem('tbToken');
  if (tk) h.Authorization = `Bearer ${tk}`;
    const method = (opts.method || 'GET').toUpperCase();
  const finalPath = method === 'GET' ? (path + (path.includes('?') ? '&' : '?') + '_t=' + Date.now()) : path;
  const r = await fetch(API + finalPath, { ...opts, headers: h });
  const raw = await r.text();
  let d = {};
  try {
    d = raw ? JSON.parse(raw) : {};
  } catch (e) {
    d = {};
  }

  const authMessage = d.error || d.message || '';
  const isAuthFailure = (r.status === 401 || r.status === 403)
    && /token|required|unauthorized|expired/i.test(authMessage);

  if (isAuthFailure && !/\/api\/auth\/(login|register)/.test(path)) {
    logout();
    showToast('Session expired. Please sign in again.', 'error');
    throw new Error('Session expired. Please sign in again.');
  }

  if (!r.ok) {
    const validationMessage = Array.isArray(d.errors) && d.errors.length
      ? (d.errors[0].msg || d.errors[0].message || JSON.stringify(d.errors[0]))
      : "";
    const fallbackText = raw && !raw.trim().startsWith("<") ? raw.trim() : "";
    throw new Error(d.error || d.message || validationMessage || fallbackText || `Request failed (${r.status})`);
  }

  return d;
}

// Initialize and update select dropdowns (Choices.js)
const choiceInstances = {};

function initChoice(sel) {
  if (choiceInstances[sel.id]) {
    choiceInstances[sel.id].destroy();
  }
  choiceInstances[sel.id] = new Choices(sel, {
    searchEnabled: true,
    itemSelectText: '',
    shouldSort: false,
    position: 'bottom',
    renderSelectedChoices: 'always'
  });
}

function setSelectOpts(selId, items) {
  const sel = document.getElementById(selId);
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">-- None --</option>' + items.map(i => `<option value="${i.value}">${esc(i.label)}</option>`).join('');
  sel.value = cur;
  initChoice(sel);
}


function logout() {
  localStorage.removeItem('tbToken');
  localStorage.removeItem('tbUser');
  appState.currentUser = null;
  document.getElementById('dashboardPage').style.display = 'none';
  document.getElementById('landingPage').style.display = 'flex';
  if (appState.socket) appState.socket.disconnect();
}

function enterDashboard(user) {
  appState.currentUser = user;
  document.getElementById('landingPage').style.display = 'none';


  // Render dashboard for authenticated user
  document.getElementById('dashboardPage').style.display = 'flex';
  const displayName = user.full_name || user.email.split('@')[0];
  document.getElementById('username').textContent = displayName;
  const sbUser = document.getElementById('sidebarUsername');
  const sbAvatar = document.getElementById('sidebarAvatar');
  if (sbUser) sbUser.textContent = displayName;
  if (sbAvatar) sbAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=3b82f6&color=fff`;
  document.getElementById('userAvatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=3b82f6&color=fff`;
  initRealtime();
  fetchNotifBadge();
  loadDashboard();
}

// Toggle settings dropdown menu visibility
function toggleSettingsMenu(e) {
  e.stopPropagation();
  const menu = document.getElementById('settingsMenu');
  if (document.getElementById('notifMenu')) document.getElementById('notifMenu').classList.remove('show');
  menu.classList.toggle('show');
}

// Toggle notifications dropdown menu and load notifications
async function toggleNotifMenu(e) {
  e.stopPropagation();
  const menu = document.getElementById('notifMenu');
  const isOpening = !menu.classList.contains('show');
  
  if (document.getElementById('settingsMenu')) {
    document.getElementById('settingsMenu').classList.remove('show');
  }
  
  if (isOpening) {
    menu.classList.add('show');
    await loadNotifications();
  } else {
    menu.classList.remove('show');
  }
}

async function loadNotifications() {
  const list = document.getElementById('notifList');
  if (!list) return;
  list.innerHTML = `<div style="padding:1rem;text-align:center;color:var(--text-muted);font-size:0.9rem;"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>`;
  
  try {
    const notifs = [];
    
    // Append truck maintenance notifications
    const trucksRes = await api('/api/trucks/needs-maintenance').catch(() => []);
    if (trucksRes && trucksRes.length) {
      trucksRes.forEach(t => {
        notifs.push(`
          <div style="padding:0.75rem 1rem;border-bottom:1px solid var(--border-color);display:flex;gap:0.75rem;align-items:flex-start;cursor:pointer;transition:background 0.2s;" onmouseover="this.style.background='var(--bg-dark)'" onmouseout="this.style.background='transparent'" onclick="focusNotificationTarget('maintenance-banner', '${t.truck_id}')">
            <div style="background:#fef3c7;color:#d97706;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <i class="fa-solid fa-wrench"></i>
            </div>
            <div>
              <div style="font-weight:600;font-size:0.85rem;margin-bottom:0.2rem;color:var(--text-main);">Maintenance Overdue</div>
              <div style="font-size:0.8rem;color:var(--text-muted);">Truck <span style="font-weight:600;color:var(--text-main);">${esc(t.truck_no)}</span> needs ${esc(t.maintenance)}.</div>
            </div>
          </div>
        `);
      });
    }

    // Append pending trip notifications
    const tripsRes = await api('/api/trips?limit=500').catch(() => ({data: []}));
    if (tripsRes && tripsRes.data) {
      const pendingTrips = tripsRes.data.filter(t => (t.status || '').toLowerCase() === 'pending');
      pendingTrips.forEach(t => {
        notifs.push(`
          <div style="padding:0.75rem 1rem;border-bottom:1px solid var(--border-color);display:flex;gap:0.75rem;align-items:flex-start;cursor:pointer;transition:background 0.2s;" onmouseover="this.style.background='var(--bg-dark)'" onmouseout="this.style.background='transparent'" onclick="focusNotificationTarget('trip', '${t.trip_id}')">
            <div style="background:#e0e7ff;color:#4f46e5;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <i class="fa-solid fa-route"></i>
            </div>
            <div>
              <div style="font-weight:600;font-size:0.85rem;margin-bottom:0.2rem;color:var(--text-main);">Pending Trip</div>
              <div style="font-size:0.8rem;color:var(--text-muted);">Trip #${t.trip_id} is awaiting completion.</div>
            </div>
          </div>
        `);
      });
    }

    if (notifs.length === 0) {
      list.innerHTML = `<div style="padding:1rem;text-align:center;color:var(--text-muted);font-size:0.9rem;">No new notifications</div>`;
      updateNotifBadge(0);
    } else {
      list.innerHTML = notifs.join('');
      updateNotifBadge(notifs.length);
    }
  } catch (err) {
    list.innerHTML = `<div style="padding:1rem;text-align:center;color:#ef4444;font-size:0.9rem;">Failed to load</div>`;
  }
}

async function fetchNotifBadge() {
  try {
    let count = 0;
    const [trucksRes, tripsRes] = await Promise.all([
      api('/api/trucks/needs-maintenance').catch(() => []),
      api('/api/trips?limit=100').catch(() => ({data: []}))
    ]);
    if (trucksRes && trucksRes.length) count += trucksRes.length;
    if (tripsRes && tripsRes.data) count += tripsRes.data.filter(t => (t.status || '').toLowerCase() === 'pending').length;
    updateNotifBadge(count);
  } catch (e) {}
}

function updateNotifBadge(count) {
  const badge = document.getElementById('alertBadge');
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }
}

// Display modal for adding a new user
function showAddUserModal() {
  document.getElementById('settingsMenu').classList.remove('show');
  document.getElementById('addUserModal')?.remove();
  const wrap = document.createElement('div');
  wrap.id = 'addUserModal';
  wrap.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;z-index:9000;backdrop-filter:blur(4px)';
  wrap.innerHTML = `
    <div style="background:var(--bg-panel);border:1px solid var(--border-color);border-radius:16px;padding:2rem;min-width:340px;max-width:420px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
      <h3 style="margin-bottom:0.4rem;font-size:1.1rem;display:flex;align-items:center;gap:0.5rem;">
        <i class="fa-solid fa-user-plus" style="color:var(--primary);"></i> Add New User
      </h3>
      <p style="color:var(--text-muted);font-size:0.82rem;margin-bottom:1.5rem;">Create a login for an admin or manager account.</p>
      <div style="display:flex;flex-direction:column;gap:0.85rem;margin-bottom:1.5rem;">
        <div>
          <label style="font-size:0.73rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;display:block;margin-bottom:0.3rem;">Full Name</label>
          <input id="newUserName" type="text" placeholder="Full name" style="width:100%;padding:0.6rem 0.85rem;background:var(--bg-dark);border:1px solid var(--border-color);border-radius:8px;color:var(--text-main);font-size:0.9rem;box-sizing:border-box;"/>
        </div>
        <div>
          <label style="font-size:0.73rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;display:block;margin-bottom:0.3rem;">Email</label>
          <input id="newUserEmail" type="email" placeholder="user@company.com" style="width:100%;padding:0.6rem 0.85rem;background:var(--bg-dark);border:1px solid var(--border-color);border-radius:8px;color:var(--text-main);font-size:0.9rem;box-sizing:border-box;"/>
        </div>
        <div>
          <label style="font-size:0.73rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;display:block;margin-bottom:0.3rem;">Role</label>
          <select id="newUserRole" style="width:100%;padding:0.6rem 0.85rem;background:var(--bg-dark);border:1px solid var(--border-color);border-radius:8px;color:var(--text-main);font-size:0.9rem;">
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
          </select>
        </div>
        <div>
          <label style="font-size:0.73rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;display:block;margin-bottom:0.3rem;">Password</label>
          <input id="newUserPassword" type="password" placeholder="Min 6 characters" style="width:100%;padding:0.6rem 0.85rem;background:var(--bg-dark);border:1px solid var(--border-color);border-radius:8px;color:var(--text-main);font-size:0.9rem;box-sizing:border-box;"/>
        </div>
      </div>
      <div style="display:flex;gap:0.75rem;">
        <button onclick="submitAddUser()" class="btn-primary" style="flex:1;padding:0.7rem;"><i class="fa-solid fa-check"></i> Create User</button>
        <button onclick="document.getElementById('addUserModal').remove()" class="btn-secondary" style="flex:1;padding:0.7rem;">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  setTimeout(() => document.getElementById('newUserName')?.focus(), 100);
}

async function submitAddUser() {
  const full_name = document.getElementById('newUserName')?.value?.trim();
  const email = document.getElementById('newUserEmail')?.value?.trim();
  const role = document.getElementById('newUserRole')?.value;
  const password = document.getElementById('newUserPassword')?.value;
  if (!email || !password) { showToast('Email and password are required', 'error'); return; }
  if (password.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }
  try {
    await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ full_name, email, password, role }) });
    document.getElementById('addUserModal')?.remove();
    showToast(`? User ${email} created as ${role}`, 'success');
  } catch (err) { showToast(err.message, 'error'); }
}


// Global: close settings dropdown on outside click
window.addEventListener('click', (e) => {
  const menu = document.getElementById('settingsMenu');
  if (menu && menu.classList.contains('show')) {
    if (!e.target.closest('.settings-dropdown')) {
      menu.classList.remove('show');
    }
  }
});

// Switch between main application views
function switchView(name) {
  document.querySelectorAll('.view-section').forEach(el => el.style.display = 'none');
  // Adjust layout for map view (flex height)
  document.getElementById(`view-${name}`).style.display = (name === 'map') ? 'flex' : 'block';
  document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
  document.getElementById(`menu-${name}`).classList.add('active');
  
  // Update mobile bottom navigation active state
  document.querySelectorAll('.mobile-bottom-nav .nav-item').forEach(el => el.classList.remove('active'));
  const botNav = document.getElementById(`botnav-${name}`);
  if (botNav) {
    botNav.classList.add('active');
  } else {
    // Highlight "Menu" if not a main navigation tab
    const menuNav = document.getElementById('botnav-menu');
    if (menuNav) menuNav.classList.add('active');
  }
  const titles = { dashboard: 'Dashboard', trucks: 'Fleet Directory', drivers: 'Drivers', customers: 'Customers', trips: 'Trips', map: 'Map View', fuel: 'Fuel Records', reports: 'Reports', performance: 'Driver Performance', maintenance: 'Maintenance Log', efficiency: 'Fuel Efficiency' };
  document.getElementById('pageTitle').textContent = titles[name] || name;
  // Reset or apply layout adjustments for map view
  const wrapper = document.getElementById('dynamicContentWrapper');
  const contentEl = document.querySelector('.content');
  if (name === 'map') {
    if (wrapper) { wrapper.style.padding = '0'; wrapper.style.overflow = 'hidden'; wrapper.style.height = '100%'; wrapper.style.display = 'flex'; wrapper.style.flexDirection = 'column'; }
    if (contentEl) { contentEl.style.overflow = 'hidden'; }
  } else {
    if (wrapper) { wrapper.style.padding = ''; wrapper.style.overflow = ''; wrapper.style.height = ''; wrapper.style.display = ''; wrapper.style.flexDirection = ''; }
    if (contentEl) { contentEl.style.overflow = ''; }
  }
  // Hide sidebar and overlay on mobile after navigation
  const mainSb = document.getElementById('mainSidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (mainSb && mainSb.classList.contains('open')) {
    mainSb.classList.remove('open');
  }
  if (overlay) {
    overlay.classList.remove('active');
    overlay.classList.remove('open');
  }
}

window.pendingViewHighlight = null;

function queueViewHighlight(view, selector) {
  window.pendingViewHighlight = { view, selector, attempts: 0 };
}

function pulseHighlightElement(el) {
  if (!el) return false;
  el.classList.remove('row-attention-highlight');
  void el.offsetWidth;
  el.classList.add('row-attention-highlight');
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => el.classList.remove('row-attention-highlight'), 2400);
  return true;
}

function applyPendingHighlight(view) {
  const target = window.pendingViewHighlight;
  if (!target || target.view !== view) return;
  const el = document.querySelector(target.selector);
  if (el) {
    pulseHighlightElement(el);
    window.pendingViewHighlight = null;
    return;
  }
  target.attempts = (target.attempts || 0) + 1;
  if (target.attempts >= 8) {
    window.pendingViewHighlight = null;
    return;
  }
  setTimeout(() => applyPendingHighlight(view), 180);
}

function focusNotificationTarget(type, id) {
  const notifMenu = document.getElementById('notifMenu');
  if (notifMenu) notifMenu.classList.remove('show');

  const normalizedId = String(id || '').trim();
  if (!normalizedId) return;

  if (type === 'trip') {
    appState.trips.page = 1;
    appState.trips.limit = 500;
    const tripCustomer = document.getElementById('tripFilterCustomer');
    const tripDriver = document.getElementById('tripFilterDriver');
    const tripTruck = document.getElementById('tripFilterTruck');
    const tripDate = document.getElementById('tripFilterDate');
    const tripStatus = document.getElementById('tripFilterStatus');
    if (tripCustomer) tripCustomer.value = '';
    if (tripDriver) tripDriver.value = '';
    if (tripTruck) tripTruck.value = '';
    if (tripDate) tripDate.value = '';
    if (tripStatus) tripStatus.value = '';
    queueViewHighlight('trips', `#trip-row-${normalizedId}`);
    loadTrips();
    return;
  }

  if (type === 'customer') {
    queueViewHighlight('customers', `#customer-row-${normalizedId}`);
    loadCustomers();
    return;
  }

  if (type === 'truck') {
    queueViewHighlight('trucks', `#truck-row-${normalizedId}`);
    loadTrucks();
    return;
  }

  if (type === 'maintenance-banner') {
    appState.maintenance.page = 1;
    queueViewHighlight('maintenance', `#pending-maintenance-chip-${normalizedId}, #maintenance-row-truck-${normalizedId}`);
    loadMaintenance();
  }
}

/* ==========================================================================
   Dashboard Section
   ========================================================================== */
let revenueChart = null, fuelTrendChart = null;

/**
 * Component: Generates a standardized alert/activity card for the dashboard.
 * @param {Object} props - Card properties.
 * @param {string} props.icon - FontAwesome icon class.
 * @param {string} props.title - Card title.
 * @param {string} [props.meta] - Metadata or subtitle text.
 * @param {string} [props.description] - Detailed description or secondary text.
 * @param {string} [props.tone] - Visual tone (warning, danger, etc.).
 * @param {string} [props.onClick] - Inline click handler string.
 * @returns {string} HTML string for the component.
 */
function buildDashboardAlertCard({ icon, title, meta = '', description = '', tone = 'warning', onClick = '' }) {
  const toneClass = tone === 'danger' ? 'alert-warning-danger' : '';
  const metaHtml = meta ? `<div class="alert-warning-meta">${meta}</div>` : '';
  const descHtml = description ? `<div class="alert-warning-desc">${description}</div>` : '';
  const clickAttr = onClick ? ` role="button" tabindex="0" onclick="${onClick}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${onClick}}"` : '';

  return `
    <div class="alert-warning ${toneClass}"${clickAttr}>
      <i class="${icon}"></i>
      <div class="alert-warning-copy">
        <div class="alert-warning-title">${title}</div>
        ${metaHtml}
        ${descHtml}
      </div>
    </div>
  `;
}

function buildPendingTripAlertCard(trip) {
  const manualCustomerName = getTripManualCustomerName(trip);
  const customerName = manualCustomerName || trip.customer_name || 'Unknown customer';
  const truckNo = trip.truck_no || 'Truck not assigned';
  const material = trip.material_type || 'Material not set';
  const qty = Number(trip.quantity || 0);
  const qtyText = qty > 0 ? `${qty.toLocaleString('en-IN')} Tons` : 'Qty not set';
  const destination = trip.destination || 'Destination not set';
  const tripDate = trip.trip_date ? fmtDate(trip.trip_date) : 'Date not set';

  return buildDashboardAlertCard({
    icon: 'fa-solid fa-route',
    title: `Pending Trip #${trip.trip_id}`,
    meta: `Truck ${esc(truckNo)} | ${esc(customerName)}`,
    description: `${esc(material)} | ${esc(qtyText)} | ${esc(destination)} | ${esc(tripDate)}`,
    onClick: `focusNotificationTarget('trip', '${trip.trip_id}')`
  });
}

function buildRecentActivityAlertCard(item) {
  const iconMap = {
    trip: 'fa-solid fa-route',
    customer: 'fa-solid fa-user-group',
    payment: 'fa-solid fa-money-bill-wave',
    fuel: 'fa-solid fa-gas-pump',
    maintenance: 'fa-solid fa-screwdriver-wrench',
    driver: 'fa-solid fa-id-card',
    truck: 'fa-solid fa-truck'
  };
  const activityType = String(item.activity_type || '').toLowerCase();
  const icon = iconMap[activityType] || 'fa-solid fa-clock-rotate-left';
  const metaBits = [item.activity_type, item.meta].filter(Boolean).map((part) => esc(part)).join(' | ');
  const activityDate = item.activity_at ? fmtDate(item.activity_at) : '';

  return buildDashboardAlertCard({
    icon,
    title: esc(item.title || 'Recent activity'),
    meta: [activityDate, metaBits].filter(Boolean).join(' | '),
    description: 'Recent operational update',
    tone: 'warning'
  });
}

/**
 * Orchestrator: Fetches and updates the dashboard with the latest fleet metrics,
 * financial analytics, and operational alerts.
 */
async function loadDashboard() {
  switchView('dashboard');
  const c = document.getElementById('view-dashboard');
  showLoading(c, 'Loading dashboard metrics...');
  try {
    const [metricsRes, analyticsRes, trucksRes, forecastRes, tripsRes] = await Promise.allSettled([
      api('/api/dashboard/metrics'), 
      api('/api/dashboard/analytics'), 
      api('/api/trucks'),
      api('/api/dashboard/maintenance-forecast'),
      api('/api/trips?limit=500')
    ]);
    const m = metricsRes.status === 'fulfilled' ? metricsRes.value : {};
    const a = analyticsRes.status === 'fulfilled' ? analyticsRes.value : {};
    const trucks = trucksRes.status === 'fulfilled' ? trucksRes.value : [];
    const forecast = forecastRes.status === 'fulfilled' ? forecastRes.value : [];
    const trips = tripsRes.status === 'fulfilled' ? (tripsRes.value.data || []) : [];

    if (metricsRes.status !== 'fulfilled') {
      throw metricsRes.reason || new Error('Dashboard metrics request failed');
    }

    document.getElementById('totalTrucks').textContent = m.totalTrucks || 0;
    window.dashboardMetrics = m;
    document.getElementById('totalDriversVal').textContent = m.totalDrivers || 0;
    document.getElementById('totalTripsVal').textContent = m.totalTrips || 0;
    const todayCollectionEl = document.getElementById('todayCollectionVal');
    const pendingDuesEl = document.getElementById('pendingDuesVal');
    const activeTripsEl = document.getElementById('activeTripsVal');
    const idleTrucksEl = document.getElementById('idleTrucksVal');
    if (todayCollectionEl) todayCollectionEl.textContent = fmtCurrency(m.todayCollection || 0);
    if (pendingDuesEl) pendingDuesEl.textContent = fmtCurrency(m.pendingCustomerDues || 0);
    if (activeTripsEl) activeTripsEl.textContent = m.activeTrips || 0;
    if (idleTrucksEl) idleTrucksEl.textContent = m.idleTrucks || 0;
    document.getElementById('totalRevenueVal').textContent = fmtCurrency(m.totalRevenue);
    window.todayRevenueAmt = m.dailyRevenue || 0;
    window.yesterdayRevenueAmt = m.yesterdayRevenue || 0;
    window.totalRevenueAmt = m.totalRevenue || 0;
    window.thisMonthRevenueAmt = m.monthlyRevenue || 0;
    window.totalProfitAmt = m.profit || 0;
    window.thisMonthProfitAmt = m.monthlyProfit || 0;
    window.totalFuelAmt = m.fuelExpenses || 0;
    window.thisMonthFuelAmt = m.monthlyFuelExpenses || 0;

    if (!window.currentRevenueView) window.currentRevenueView = 'today';
    if (!window.currentRevTotalView) window.currentRevTotalView = 'total';
    if (!window.currentProfTotalView) window.currentProfTotalView = 'total';
    if (!window.currentFuelTotalView) window.currentFuelTotalView = 'total';

    // Revenue: toggle between today and yesterday
    if (window.currentRevenueView === 'today') {
      document.getElementById('dailyRevenueVal').textContent = fmtCurrency(window.todayRevenueAmt);
    } else {
      document.getElementById('dailyRevenueVal').textContent = fmtCurrency(window.yesterdayRevenueAmt);
    }

    // Revenue: toggle between total and monthly
    const trv = document.getElementById('totalRevenueVal');
    const trt = document.getElementById('revenueTotalTitle');
    const tri = document.getElementById('revenueTotalIcon');
    if (window.currentRevTotalView === 'total') {
      trv.textContent = fmtCurrency(window.totalRevenueAmt);
      trt.textContent = 'Total Revenue';
      tri.className = 'fa-solid fa-sack-dollar icon-green';
    } else {
      trv.textContent = fmtCurrency(window.thisMonthRevenueAmt);
      trt.textContent = 'This Month Revenue';
      tri.className = 'fa-solid fa-calendar-check icon-purple';
    }

    // Profit: toggle between total and monthly
    const tpv = document.getElementById('profitVal');
    const tpt = document.getElementById('profitLabelText');
    const tpi = document.getElementById('profitTotalIcon');
    if (window.currentProfTotalView === 'total') {
      tpv.textContent = fmtCurrency(window.totalProfitAmt);
      if (tpt) tpt.textContent = 'Total Profit';
      tpi.className = 'fa-solid fa-money-bill-trend-up icon-green';
    } else {
      tpv.textContent = fmtCurrency(window.thisMonthProfitAmt);
      if (tpt) tpt.textContent = 'This Month Profit';
      tpi.className = 'fa-solid fa-chart-line icon-purple';
    }

    // Fuel: toggle between total and monthly
    const tfv = document.getElementById('fuelExpensesVal');
    const tft = document.getElementById('fuelTotalTitle');
    const tfi = document.getElementById('fuelTotalIcon');
    if (window.currentFuelTotalView === 'total') {
      tfv.textContent = fmtCurrency(window.totalFuelAmt);
      tft.textContent = 'Total Fuel Cost';
      tfi.className = 'fa-solid fa-gas-pump icon-red';
    } else {
      tfv.textContent = fmtCurrency(window.thisMonthFuelAmt);
      tft.textContent = 'This Month Fuel';
      tfi.className = 'fa-solid fa-bottle-droplet icon-orange';
    }
    applyMetricValueBehavior();

    // Maintenance: process and display alerts and forecast
    const thresholdTrips = 15;
    const dueSoon = forecast.filter(f => f.trips_since_service >= thresholdTrips);
    
    // Update dashboard counter for pending maintenance
    const pnd = document.getElementById('mtnStatPendingDashboard');
    if (pnd) pnd.textContent = dueSoon.length;
    updateDashboardMetricNotes(m, dueSoon.length);

    const alertsBox = document.getElementById('dashboardAlerts');
    const alertItems = [];
    if (m.notifications && m.notifications.length) {
      const dashboardNotifications = m.notifications.filter(n => n.notification_type !== 'pending_trip_completion');
      alertItems.push(...dashboardNotifications.slice(0, 6).map(n => buildDashboardAlertCard({
        icon: 'fa-solid fa-bell',
        title: esc(n.message),
        onClick:
          n.notification_type === 'overdue_payment' || n.notification_type === 'payment_due_today'
            ? `focusNotificationTarget('customer', '${String(n.notification_id).split('-').pop()}')`
            : `focusNotificationTarget('truck', '${String(n.notification_id).split('-').pop()}')`
      })));
    }

    const pendingTrips = trips.filter(t => (t.status || '').toLowerCase() === 'pending');
    if (pendingTrips.length > 0) {
      alertItems.push(...pendingTrips.map(buildPendingTripAlertCard));
    }
    
    // Maintenance: show alerts for trucks due by date
    const dueTrucks = trucks.filter(t => t.maintenance && t.maintenance.toLowerCase() !== 'not required' && t.maintenance.toLowerCase() !== 'none' && t.maintenance.toLowerCase() !== '');
    if (dueTrucks.length > 0) {
      alertItems.push(...dueTrucks.map(t => buildDashboardAlertCard({
        icon: 'fa-solid fa-triangle-exclamation',
        title: `Truck ${esc(t.truck_no)} needs manual service`,
        description: esc(t.maintenance),
        onClick: `focusNotificationTarget('truck', '${t.truck_id}')`
      })));
    }
    
    // Maintenance: show alerts for trucks due by usage
    if (dueSoon.length > 0) {
      alertItems.push(...dueSoon.map(f => buildDashboardAlertCard({
        icon: 'fa-solid fa-wrench',
        title: `Truck ${esc(f.truck_no)} requires maintenance`,
        description: `${f.trips_since_service} trips since last service`,
        tone: 'danger',
        onClick: `focusNotificationTarget('maintenance-banner', '${f.truck_id}')`
      })));
    }

    const recentActivityItems = (m.recentActivity || []).slice(0, 8).map(buildRecentActivityAlertCard);
    if (recentActivityItems.length > 0) {
      alertItems.push(...recentActivityItems);
    }

    // Decision widgets: Process data for charts and trend cards.
    if (alertItems.length) {
      const summaryText = alertItems.length > 5
        ? 'Scroll to view alerts and recent operational updates'
        : 'Latest alerts and recent operational updates';
      alertsBox.innerHTML = `
        <div class="dashboard-alerts-panel">
          <div class="dashboard-alerts-head">
            <div>
              <h4>Attention Needed</h4>
              <p>${summaryText}</p>
            </div>
            <div class="dashboard-alerts-badge">
              <i class="fa-solid fa-bell"></i>
              ${alertItems.length}
            </div>
          </div>
          <div class="dashboard-alerts-scroll">${alertItems.join('')}</div>
        </div>
      `;
      alertsBox.style.display = 'block';
    } else {
      alertsBox.style.display = 'none';
      alertsBox.innerHTML = '';
    }

    renderCharts(a.monthlyRevenue || [], a.monthlyFuelCost || []);
    renderDecisionWidgets(m, a);
    
    // Render maintenance forecast table rows
    const forecastTbody = document.getElementById('forecastTableBody');
    if (forecastTbody) {
      forecastTbody.innerHTML = forecast.map(f => {
        let badgeClass = 'status-available'; // status: green (available)
        if (f.trips_since_service >= 15) badgeClass = 'status-inactive'; // status: red (inactive/warning)
        else if (f.trips_since_service >= 10) badgeClass = 'status-pending'; // status: yellow (pending)
        return `<tr>
          <td><strong>${esc(f.truck_no)}</strong></td>
          <td>${f.last_service === 'No Record' ? 'Never' : fmtDate(f.last_service)}</td>
          <td>${f.trips_since_service}</td>
          <td><span class="status-badge ${badgeClass}">${f.trips_since_service}/15 Limit</span></td>
        </tr>`;
      }).join('');
    }
  } catch (err) {
    console.error('Dashboard load failed:', err);
    showError(c, err.message || 'Failed to load dashboard');
  } finally {
    hideLoading(c);
  }

  setTimeout(() => {
    try {
      if (typeof renderDashboardMap === 'function') renderDashboardMap();
    } catch (err) {
      console.warn('Dashboard map render skipped:', err.message);
    }
  }, 500);
}

function toggleRevenueView() {
  const title = document.getElementById('revenueDailyTitle');
  const val = document.getElementById('dailyRevenueVal');
  const icon = document.getElementById('revenueDailyIcon');
  
  if (window.currentRevenueView === 'today') {
    window.currentRevenueView = 'yesterday';
    title.textContent = 'Yesterday Revenue';
    val.textContent = fmtCurrency(window.yesterdayRevenueAmt || 0);
    icon.className = 'fa-solid fa-clock-rotate-left icon-orange';
  } else {
    window.currentRevenueView = 'today';
    title.textContent = 'Today Revenue';
    val.textContent = fmtCurrency(window.todayRevenueAmt || 0);
    icon.className = 'fa-solid fa-calendar-day icon-cyan';
  }
  updateDashboardMetricNotes(window.dashboardMetrics || {}, Number(document.getElementById('mtnStatPendingDashboard')?.textContent || 0));
  applyMetricValueBehavior();
}

function toggleRevenueTotalView() {
  const title = document.getElementById('revenueTotalTitle');
  const val = document.getElementById('totalRevenueVal');
  const icon = document.getElementById('revenueTotalIcon');
  
  if (window.currentRevTotalView === 'total') {
    window.currentRevTotalView = 'monthly';
    title.textContent = 'This Month Revenue';
    val.textContent = fmtCurrency(window.thisMonthRevenueAmt || 0);
    icon.className = 'fa-solid fa-calendar-check icon-purple';
  } else {
    window.currentRevTotalView = 'total';
    title.textContent = 'Total Revenue';
    val.textContent = fmtCurrency(window.totalRevenueAmt || 0);
    icon.className = 'fa-solid fa-sack-dollar icon-green';
  }
  updateDashboardMetricNotes(window.dashboardMetrics || {}, Number(document.getElementById('mtnStatPendingDashboard')?.textContent || 0));
  applyMetricValueBehavior();
}

function toggleProfitTotalView() {
  const titleText = document.getElementById('profitLabelText');
  const val = document.getElementById('profitVal');
  const icon = document.getElementById('profitTotalIcon');
  
  if (window.currentProfTotalView === 'total') {
    window.currentProfTotalView = 'monthly';
    if (titleText) titleText.textContent = 'This Month Profit';
    val.textContent = fmtCurrency(window.thisMonthProfitAmt || 0);
    icon.className = 'fa-solid fa-chart-line icon-purple';
  } else {
    window.currentProfTotalView = 'total';
    if (titleText) titleText.textContent = 'Total Profit';
    val.textContent = fmtCurrency(window.totalProfitAmt || 0);
    icon.className = 'fa-solid fa-money-bill-trend-up icon-green';
  }
  updateDashboardMetricNotes(window.dashboardMetrics || {}, Number(document.getElementById('mtnStatPendingDashboard')?.textContent || 0));
  applyMetricValueBehavior();
}

function toggleFuelTotalView() {
  const title = document.getElementById('fuelTotalTitle');
  const val = document.getElementById('fuelExpensesVal');
  const icon = document.getElementById('fuelTotalIcon');
  
  if (window.currentFuelTotalView === 'total') {
    window.currentFuelTotalView = 'monthly';
    title.textContent = 'This Month Fuel';
    val.textContent = fmtCurrency(window.thisMonthFuelAmt || 0);
    icon.className = 'fa-solid fa-bottle-droplet icon-orange';
  } else {
    window.currentFuelTotalView = 'total';
    title.textContent = 'Total Fuel Cost';
    val.textContent = fmtCurrency(window.totalFuelAmt || 0);
    icon.className = 'fa-solid fa-gas-pump icon-red';
  }
  updateDashboardMetricNotes(window.dashboardMetrics || {}, Number(document.getElementById('mtnStatPendingDashboard')?.textContent || 0));
  applyMetricValueBehavior();
}

function renderCharts(rev, fuel) {
  Chart.defaults.color = '#9ca3af';
  Chart.defaults.font.family = 'Inter';
  if (revenueChart) revenueChart.destroy();
  revenueChart = new Chart(document.getElementById('revenueChart').getContext('2d'), {
    type: 'bar',
    data: { labels: rev.map(d => d.month), datasets: [{ label: 'Revenue (?)', data: rev.map(d => d.revenue), backgroundColor: '#3b82f6', borderRadius: 4 }] },
    options: { responsive: true, maintainAspectRatio: false }
  });
  if (fuelTrendChart) fuelTrendChart.destroy();
  
  const fuelCtx = document.getElementById('fuelTrendChart').getContext('2d');
  const fuelGradient = fuelCtx.createLinearGradient(0, 0, 0, 400);
  fuelGradient.addColorStop(0, 'rgba(239, 68, 68, 0.85)'); // Red solid
  fuelGradient.addColorStop(1, 'rgba(239, 68, 68, 0.15)'); // Red transparent

  fuelTrendChart = new Chart(fuelCtx, {
    type: 'bar',
    data: {
      labels: fuel.map(d => d.month),
      datasets: [{
        label: 'Total Cost (?)',
        data: fuel.map(d => d.fuelCost),
        backgroundColor: fuelGradient,
        borderRadius: 6,
        borderWidth: 0,
        barPercentage: 0.5,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          titleFont: { size: 13, family: 'Inter', weight: 'normal', color: '#9ca3af' },
          bodyFont: { size: 14, family: 'Inter', weight: 'bold' },
          padding: 12,
          cornerRadius: 8,
          displayColors: false,
          callbacks: {
            label: function(context) {
              const cost = context.raw;
              const liters = fuel[context.dataIndex].fuelLiters;
              return [
                ` Cost: \u20B9${cost.toLocaleString('en-IN')}`,
                ` Volume: ${liters.toLocaleString('en-IN')} L`
              ];
            }
          }
        }
      },
      scales: {
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
          ticks: { color: '#9ca3af', font: { family: 'Inter' } }
        },
        x: {
          grid: { display: false, drawBorder: false },
          ticks: { color: '#9ca3af', font: { family: 'Inter' } }
        }
      }
    }
  });
}

/* ==============================
  TRUCKS CRUD SECTION
  ============================== */
/**
 * Service: Retrieves and renders the full fleet directory with real-time status updates.
 */
async function loadTrucks() {
  switchView('trucks');
  const tbody = document.getElementById('trucksTableBody');
  const tc = tbody.closest('.table-responsive');
  showLoading(tc, 'Loading fleet...');
  try {
    const [trucks, trips, fuelAll, mtnAll] = await Promise.all([
      api('/api/trucks'),
      api('/api/trips?page=1&limit=50').catch(() => ({ data: [] })),
      api('/api/fuel?page=1&limit=50').catch(() => ({ data: [] })),
      api('/api/maintenance?page=1&limit=50').catch(() => ({ data: [] }))
    ]);
    await populateTruckDriverSelect();

    // Stat cards
    const total = trucks.length;
    const avail = trucks.filter(t => (t.status || '').toLowerCase() === 'available').length;
    const inUse = trucks.filter(t => (t.status || '').toLowerCase() === 'in use').length;
    const maint = trucks.filter(t => (t.status || '').toLowerCase() === 'maintenance').length;
    const s = id => document.getElementById(id);
    if (s('fleetStatTotal')) s('fleetStatTotal').textContent = total;
    if (s('fleetStatAvail')) s('fleetStatAvail').textContent = avail;
    if (s('fleetStatInUse')) s('fleetStatInUse').textContent = inUse;
    if (s('fleetStatMaint')) s('fleetStatMaint').textContent = maint;

    if (!trucks.length) { tbody.innerHTML = emptyRow(9, 'No trucks in the fleet yet'); return; }

    // Build lookup maps
    const tripRows  = (trips.data  || trips  || []);
    const fuelRows  = (fuelAll.data || fuelAll || []);
    const mtnRows   = (mtnAll.data  || mtnAll  || []);

    const tripCount = {}, fuelCount = {}, lastMtn = {};
    tripRows.forEach(r => { if (r.truck_id) tripCount[r.truck_id] = (tripCount[r.truck_id] || 0) + 1; });
    fuelRows.forEach(r => { if (r.truck_id) fuelCount[r.truck_id] = (fuelCount[r.truck_id] || 0) + 1; });
    mtnRows.forEach(r => {
      if (!r.truck_id) return;
      const d = new Date(r.service_date);
      if (!lastMtn[r.truck_id] || d > lastMtn[r.truck_id]) lastMtn[r.truck_id] = d;
    });

    tbody.innerHTML = trucks.map((t, i) => {
      // Status badge for truck
      const statusKey = (t.status || 'available').toLowerCase().replace(/\s+/g, '-');
      const statusBadge = `<span class="status-badge status-${statusKey}">${esc(t.status)}</span>`;

      // Driver badge for assigned driver
      const driverBadge = t.driver_name
        ? `<span style="display:inline-flex;align-items:center;gap:5px;background:rgba(16,185,129,0.1);color:#10b981;border:1px solid rgba(16,185,129,0.3);padding:3px 10px;border-radius:20px;font-size:0.8rem;font-weight:500;">
            <i class="fa-solid fa-user" style="font-size:0.65rem;"></i>${esc(t.driver_name)}
           </span>`
        : `<span style="color:var(--text-muted);font-size:0.82rem;">— Unassigned</span>`;

      // Badge for number of trips
      const tc2 = tripCount[t.truck_id] || 0;
      const tripsBadge = `<span style="display:inline-flex;align-items:center;gap:5px;background:rgba(59,130,246,0.1);color:#3b82f6;border:1px solid rgba(59,130,246,0.2);padding:3px 10px;border-radius:20px;font-size:0.82rem;font-weight:600;">
        <i class="fa-solid fa-route" style="font-size:0.65rem;"></i>${tc2}
      </span>`;

      // Badge for number of fuel records
      const fc = fuelCount[t.truck_id] || 0;
      const fuelBadge = `<span style="display:inline-flex;align-items:center;gap:5px;background:rgba(245,158,11,0.1);color:#f59e0b;border:1px solid rgba(245,158,11,0.2);padding:3px 10px;border-radius:20px;font-size:0.82rem;font-weight:600;">
        <i class="fa-solid fa-gas-pump" style="font-size:0.65rem;"></i>${fc}
      </span>`;

      // Last maintenance date badge
      const lastSvc = lastMtn[t.truck_id]
        ? `<span style="font-size:0.82rem;color:var(--text-muted);">${lastMtn[t.truck_id].toLocaleDateString('en-IN')}</span>`
        : `<span style="font-size:0.8rem;color:var(--text-muted);">No record</span>`;

      // Maintenance note badge (required/not required)
      const note = t.maintenance || 'Not Required';
      const needsMaint = note.toLowerCase() !== 'not required';
      const noteBadge = needsMaint
        ? `<span style="display:inline-flex;align-items:center;gap:5px;background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.3);padding:3px 10px;border-radius:20px;font-size:0.8rem;font-weight:500;cursor:pointer;" title="Click to log maintenance" onclick="loadMaintenance()">
            <i class="fa-solid fa-triangle-exclamation" style="font-size:0.65rem;"></i>${esc(note)}
           </span>`
        : `<span style="display:inline-flex;align-items:center;gap:5px;background:rgba(16,185,129,0.08);color:#10b981;border:1px solid rgba(16,185,129,0.25);padding:3px 10px;border-radius:20px;font-size:0.8rem;">
            <i class="fa-solid fa-circle-check" style="font-size:0.65rem;"></i>OK
           </span>`;

      return `<tr id="truck-row-${t.truck_id}" data-truck-id="${t.truck_id}">
        <td style="font-weight:600;color:var(--text-muted);">${i + 1}</td>
        <td><strong style="font-size:0.95rem;letter-spacing:0.02em;">${esc(t.truck_no)}</strong></td>
        <td>${driverBadge}</td>
        <td>${statusBadge}</td>
        <td>${tripsBadge}</td>
        <td>${fuelBadge}</td>
        <td>${lastSvc}</td>
        <td>${noteBadge}</td>
        <td class="actions-cell">
          <button class="btn-icon" title="Edit truck" onclick="editTruck(${t.truck_id})"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-icon btn-icon-danger" title="Delete truck" onclick="deleteTruck(${t.truck_id})"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>`;
    }).join('');
    applyPendingHighlight('trucks');
  } catch (err) { tbody.innerHTML = errorRow(9); } finally { hideLoading(tc); }
}

async function populateTruckDriverSelect() {
  try { const d = await api('/api/drivers'); setSelectOpts('trkDriver', d.map(x => ({ value: x.driver_id, label: x.name }))); } catch (e) {}
}

async function submitTruck(e) {
  e.preventDefault();
  const id = document.getElementById('trkId').value;
  const driverId = (document.getElementById('trkDriver').value === "" || document.getElementById('trkDriver').value === "null") ? null : document.getElementById('trkDriver').value;
  const body = { 
    truck_no: document.getElementById('trkNo').value, 
    driver_id: driverId, 
    status: document.getElementById('trkStatus').value, 
    maintenance: document.getElementById('trkMaintenance').value 
  };
  try {
    if (id) { await api(`/api/trucks/${id}`, { method: 'PUT', body: JSON.stringify(body) }); showToast('Truck updated', 'success'); }
    else { await api('/api/trucks', { method: 'POST', body: JSON.stringify(body) }); showToast('Truck added', 'success'); }
    cancelForm('truckForm'); resetTruckForm(); loadTrucks();
  } catch (err) { showToast(err.message, 'error'); }
}

async function editTruck(id) {
  try {
    const t = await api(`/api/trucks/${id}`);
    await populateTruckDriverSelect();
    document.getElementById('trkId').value = t.truck_id;
    document.getElementById('trkNo').value = t.truck_no;
    document.getElementById('trkStatus').value = t.status;
    document.getElementById('trkMaintenance').value = t.maintenance;
    const title = document.getElementById('truckFormTitle');
    if (title) title.textContent = `Edit Truck — ${t.truck_no}`;
    // Set driver via Choices.js or fallback
    setTimeout(() => {
      const ci = window.choiceInstances && window.choiceInstances['trkDriver'];
      if (ci) ci.setChoiceByValue(String(t.driver_id || ''));
      else { const sel = document.getElementById('trkDriver'); if (sel) sel.value = t.driver_id || ''; }
    }, 80);
    document.getElementById('truckForm').style.display = 'block';
    document.getElementById('truckForm').scrollIntoView({ behavior: 'smooth' });
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteTruck(id) {
  if (!confirm('Delete this truck?')) return;
  try { await api(`/api/trucks/${id}`, { method: 'DELETE' }); showToast('Truck deleted', 'success'); loadTrucks(); } catch (err) { showToast(err.message, 'error'); }
}

function resetTruckForm() {
  document.getElementById('trkId').value = '';
  document.getElementById('trkNo').value = '';
  document.getElementById('trkDriver').value = '';
  document.getElementById('trkStatus').value = 'Available';
  document.getElementById('trkMaintenance').value = 'Not Required';
  const ci = window.choiceInstances && window.choiceInstances['trkDriver'];
  if (ci) ci.setChoiceByValue('');
  const title = document.getElementById('truckFormTitle');
  if (title) title.textContent = 'Add New Truck';
}

/* ==============================
  DRIVERS CRUD SECTION
  ============================== */
async function loadDrivers() {
  switchView('drivers');
  const tbody = document.getElementById('driversTableBody');
  const tc = tbody.closest('.table-responsive');
  showLoading(tc, 'Loading drivers...');
  try {
    const [drivers, trucks] = await Promise.all([
      api('/api/drivers'),
      api('/api/trucks').catch(() => [])
    ]);

    // Update driver statistics cards
    const active   = drivers.filter(d => (d.status || 'active').toLowerCase() === 'active').length;
    const assigned = trucks.filter(t => t.driver_id).length;
    const salary   = drivers.reduce((s, d) => s + Number(d.salary || 0), 0);
    const g = id => document.getElementById(id);
    if (g('drvStatTotal'))    g('drvStatTotal').textContent    = drivers.length;
    if (g('drvStatActive'))   g('drvStatActive').textContent   = active;
    if (g('drvStatAssigned')) g('drvStatAssigned').textContent = assigned;
    if (g('drvStatSalary'))   g('drvStatSalary').textContent   = fmtCurrency(salary);

    if (!drivers.length) { tbody.innerHTML = emptyRow(9, 'No drivers yet'); return; }

    // Map driver_id to assigned truck number
    const truckMap = {};
    trucks.forEach(t => { if (t.driver_id) truckMap[t.driver_id] = t.truck_no; });

    const rows = [...drivers];
    if (appState.drivers.sorts.length) {
      rows.sort((a, b) => {
        for (const sort of appState.drivers.sorts) {
          let valueA = 0;
          let valueB = 0;
          if (sort.key === 'salary') {
            valueA = Number(a.salary || 0);
            valueB = Number(b.salary || 0);
          }
          const comparison = valueA - valueB;
          if (comparison !== 0) return sort.dir === 'asc' ? comparison : -comparison;
        }
        return 0;
      });
    }

    const driverSalarySortIcon = document.getElementById('drvSortSalary');
    if (driverSalarySortIcon) {
      driverSalarySortIcon.className = `fa-solid ${getDriverSortIcon('salary')}`;
      const btn = driverSalarySortIcon.closest('button');
      if (btn) btn.title = getNextSortTitle(appState.drivers.sorts, 'salary');
    }

    tbody.innerHTML = rows.map((d, i) => {
      const initials = d.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
      const assignedTruck = truckMap[d.driver_id]
        ? `<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(59,130,246,0.1);color:#3b82f6;border:1px solid rgba(59,130,246,0.25);padding:3px 10px;border-radius:20px;font-size:0.8rem;font-weight:600;">
            <i class="fa-solid fa-truck" style="font-size:0.65rem;"></i>${esc(truckMap[d.driver_id])}
           </span>`
        : `<span style="color:var(--text-muted);font-size:0.8rem;">— None</span>`;

      const statusKey = (d.status || 'active').toLowerCase();
      const statusBadge = `<span class="status-badge status-${statusKey}">${esc(d.status || 'Active')}</span>`;

      return `<tr>
        <td style="font-weight:600;color:var(--text-muted);">${i + 1}</td>
        <td>
          <div style="display:flex;align-items:center;gap:0.6rem;">
            <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--primary),#7c3aed);display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:700;color:#fff;flex-shrink:0;">${initials}</div>
            <strong style="font-size:0.9rem;">${esc(d.name)}</strong>
          </div>
        </td>
        <td>${d.phone_no ? `<span style="display:inline-flex;align-items:center;gap:4px;font-size:0.83rem;"><i class="fa-solid fa-phone" style="color:var(--text-muted);font-size:0.7rem;"></i>${esc(d.phone_no)}</span>` : '<span style="color:var(--text-muted);">—</span>'}</td>
        <td style="font-size:0.82rem;color:var(--text-muted);">${esc(d.address || '—')}</td>
        <td><strong style="color:var(--success);">${fmtCurrency(d.salary)}</strong></td>
        <td>${assignedTruck}</td>
        <td>${statusBadge}</td>
        <td class="actions-cell">
          <button class="btn-icon" title="Edit" onclick="editDriver(${d.driver_id})"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-icon btn-icon-danger" title="Delete" onclick="deleteDriver(${d.driver_id})"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>`;
    }).join('');
  } catch (err) { tbody.innerHTML = errorRow(9); } finally { hideLoading(tc); }
}

async function submitDriver(e) {
  e.preventDefault();
  const id = document.getElementById('drvId').value;
  const body = { name: document.getElementById('drvName').value, phone_no: document.getElementById('drvPhone').value, address: document.getElementById('drvAddress').value, salary: document.getElementById('drvSalary').value, status: 'active' };
  try {
    if (id) { await api(`/api/drivers/${id}`, { method: 'PUT', body: JSON.stringify(body) }); showToast('Driver updated', 'success'); }
    else { await api('/api/drivers', { method: 'POST', body: JSON.stringify(body) }); showToast('Driver added', 'success'); }
    cancelForm('driverForm'); resetDriverForm(); loadDrivers();
  } catch (err) { showToast(err.message, 'error'); }
}

async function editDriver(id) {
  try {
    const d = await api(`/api/drivers/${id}`);
    document.getElementById('drvId').value = d.driver_id;
    document.getElementById('drvName').value = d.name;
    document.getElementById('drvPhone').value = d.phone_no || '';
    document.getElementById('drvAddress').value = d.address || '';
    document.getElementById('drvSalary').value = d.salary;
    const title = document.getElementById('driverFormTitle');
    if (title) title.textContent = `Edit Driver — ${d.name}`;
    document.getElementById('driverForm').style.display = 'block';
    document.getElementById('driverForm').scrollIntoView({ behavior: 'smooth' });
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteDriver(id) {
  if (!confirm('Delete this driver?')) return;
  try { await api(`/api/drivers/${id}`, { method: 'DELETE' }); showToast('Driver deleted', 'success'); loadDrivers(); } catch (err) { showToast(err.message, 'error'); }
}

function resetDriverForm() {
  ['drvId', 'drvName', 'drvPhone', 'drvAddress'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('drvSalary').value = 0;
  const title = document.getElementById('driverFormTitle');
  if (title) title.textContent = 'Add New Driver';
}

/* ==============================
  CUSTOMERS CRUD SECTION
  ============================== */

function paymentStatusBadge(status) {
  const map = {
    Paid: { bg: 'rgba(16,185,129,0.12)', color: '#10b981', border: 'rgba(16,185,129,0.35)', icon: 'circle-check' },
    Partial: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: 'rgba(245,158,11,0.35)', icon: 'clock' },
    Overdue: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', border: 'rgba(239,68,68,0.35)', icon: 'triangle-exclamation' },
    Advance: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6', border: 'rgba(59,130,246,0.35)', icon: 'arrow-trend-up' }
  };
  const cfg = map[status] || map.Partial;
  return `<span style="display:inline-flex;align-items:center;gap:6px;background:${cfg.bg};color:${cfg.color};border:1px solid ${cfg.border};padding:4px 10px;border-radius:999px;font-size:0.8rem;font-weight:600;"><i class="fa-solid fa-${cfg.icon}" style="font-size:0.7rem;"></i>${esc(status || 'Partial')}</span>`;
}

function renderDecisionWidgets(metrics, analytics) {
  const box = document.getElementById('decisionWidgets');
  if (!box) return;
  const revDelta = Number(metrics.monthlyRevenue || 0) - Number(metrics.previousMonthRevenue || 0);
  const collectionDelta = Number(metrics.monthlyCollection || 0) - Number(metrics.previousMonthCollection || 0);
  const fuelDelta = Number(metrics.monthlyFuelExpenses || 0) - Number(metrics.previousMonthFuelExpenses || 0);
  const maintenanceDelta = Number(metrics.monthlyMaintenanceCost || 0) - Number(metrics.previousMonthMaintenanceCost || 0);
  const topCustomers = (metrics.topCustomersThisMonth || []).slice(0, 3).map(row => `${row.name}: ${fmtCurrency(row.billed_amount)}`).join(' | ') || 'No customer billing this month';
  const profitableTruck = metrics.mostProfitableTruck ? `${metrics.mostProfitableTruck.truck_no}: ${fmtCurrency(metrics.mostProfitableTruck.net_profit)}` : 'No truck data this month';
  const fuelTrend = (analytics.monthlyFuelCost || []).slice(-3).map(row => `${row.month}: ${fmtCurrency(row.fuelCost)}`).join(' | ') || 'No fuel trend';
  const maintenanceTrend = (analytics.monthlyMaintenanceCost || []).slice(-3).map(row => `${row.month}: ${fmtCurrency(row.maintenanceCost)}`).join(' | ') || 'No maintenance trend';

  const formatDelta = (delta) => `${delta >= 0 ? '+' : '-'}${fmtCurrency(Math.abs(delta))}`;
  const deltaTone = (delta) => delta > 0 ? 'is-positive' : delta < 0 ? 'is-negative' : 'is-neutral';
  const deltaLabel = (delta, positiveWord = 'Up', negativeWord = 'Down') => delta > 0 ? positiveWord : delta < 0 ? negativeWord : 'Flat';

  const cards = [
    {
      kicker: 'Revenue',
      title: 'Revenue vs Previous Month',
      value: formatDelta(revDelta),
      sub: `Current ${fmtCurrency(metrics.monthlyRevenue || 0)} | Previous ${fmtCurrency(metrics.previousMonthRevenue || 0)}`,
      icon: 'fa-chart-column',
      tone: deltaTone(revDelta),
      chipText: `${deltaLabel(revDelta)} this month`,
      chipTone: deltaTone(revDelta)
    },
    {
      kicker: 'Collections',
      title: 'Collection vs Previous Month',
      value: formatDelta(collectionDelta),
      sub: `Current ${fmtCurrency(metrics.monthlyCollection || 0)} | Previous ${fmtCurrency(metrics.previousMonthCollection || 0)}`,
      icon: 'fa-money-bill-trend-up',
      tone: deltaTone(collectionDelta),
      chipText: `${deltaLabel(collectionDelta)} in cash flow`,
      chipTone: deltaTone(collectionDelta)
    },
    {
      kicker: 'Customers',
      title: 'Top Customers This Month',
      value: topCustomers,
      sub: 'Billed customer ranking based on this month activity',
      icon: 'fa-users',
      tone: 'is-insight',
      chipText: `${pluralize((metrics.topCustomersThisMonth || []).slice(0, 3).length, 'leader')}`,
      chipTone: 'is-neutral'
    },
    {
      kicker: 'Fleet Margin',
      title: 'Most Profitable Truck',
      value: profitableTruck,
      sub: 'Best net-profit performer in the current month',
      icon: 'fa-truck-fast',
      tone: 'is-positive',
      chipText: 'Operational winner',
      chipTone: 'is-positive'
    },
    {
      kicker: 'Fuel',
      title: 'Fuel Cost Trend',
      value: fuelTrend,
      sub: `${deltaLabel(fuelDelta, 'Higher', 'Lower')} by ${fmtCurrency(Math.abs(fuelDelta))} compared with the previous month`,
      icon: 'fa-gas-pump',
      tone: fuelDelta > 0 ? 'is-negative' : fuelDelta < 0 ? 'is-positive' : 'is-neutral',
      chipText: fuelDelta > 0 ? 'Cost pressure up' : fuelDelta < 0 ? 'Efficiency improved' : 'No change',
      chipTone: fuelDelta > 0 ? 'is-negative' : fuelDelta < 0 ? 'is-positive' : 'is-neutral'
    },
    {
      kicker: 'Maintenance',
      title: 'Maintenance Cost Trend',
      value: maintenanceTrend,
      sub: `${deltaLabel(maintenanceDelta, 'Higher', 'Lower')} by ${fmtCurrency(Math.abs(maintenanceDelta))} compared with the previous month`,
      icon: 'fa-screwdriver-wrench',
      tone: maintenanceDelta > 0 ? 'is-negative' : maintenanceDelta < 0 ? 'is-positive' : 'is-neutral',
      chipText: maintenanceDelta > 0 ? 'Workshop spend up' : maintenanceDelta < 0 ? 'Workshop spend down' : 'Stable spend',
      chipTone: maintenanceDelta > 0 ? 'is-negative' : maintenanceDelta < 0 ? 'is-positive' : 'is-neutral'
    }
  ];

  box.innerHTML = cards.map((item) => `
    <article class="dashboard-widget-card ${item.tone}">
      <div class="dashboard-widget-head">
        <div>
          <span class="dashboard-widget-kicker">${esc(item.kicker)}</span>
          <h5>${esc(item.title)}</h5>
        </div>
        <span class="dashboard-widget-icon"><i class="fa-solid ${item.icon}"></i></span>
      </div>
      <div class="dashboard-widget-value">${esc(item.value)}</div>
      <div class="dashboard-widget-sub">${esc(item.sub)}</div>
      <div class="dashboard-widget-footer">
        <span class="dashboard-widget-chip ${item.chipTone}"><i class="fa-solid fa-signal"></i>${esc(item.chipText)}</span>
      </div>
    </article>
  `).join('');
}

function renderRecentActivity(items) {
  const box = document.getElementById('recentActivityFeed');
  if (!box) return;
  if (!items.length) {
    box.innerHTML = `<div class="empty">No recent activity</div>`;
    return;
  }
  const iconMap = {
    trip: 'fa-route',
    customer: 'fa-user-group',
    payment: 'fa-money-bill-wave',
    fuel: 'fa-gas-pump',
    maintenance: 'fa-screwdriver-wrench',
    driver: 'fa-id-card',
    truck: 'fa-truck'
  };
  box.innerHTML = items.map(item => {
    const typeKey = String(item.activity_type || '').toLowerCase();
    const icon = iconMap[typeKey] || 'fa-bolt';
    const metaBits = [item.activity_type, item.meta].filter(Boolean);
    return `
      <article class="dashboard-activity-card">
        <div class="dashboard-activity-row">
          <span class="dashboard-activity-marker"><i class="fa-solid ${icon}"></i></span>
          <div class="dashboard-activity-content">
            <div class="dashboard-activity-top">
              <h5 class="dashboard-activity-title">${esc(item.title || 'Activity')}</h5>
              <span class="dashboard-activity-date">${fmtDate(item.activity_at)}</span>
            </div>
            <div class="dashboard-activity-detail">${esc(metaBits.join(' | ') || 'System activity update')}</div>
            <div class="dashboard-activity-meta">
              ${item.activity_type ? `<span class="dashboard-activity-badge"><i class="fa-solid fa-layer-group"></i>${esc(item.activity_type)}</span>` : ''}
              ${item.meta ? `<span class="dashboard-activity-badge"><i class="fa-solid fa-circle-info"></i>${esc(item.meta)}</span>` : ''}
            </div>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function ageBucketBadge(bucket) {
  if (!bucket || bucket === 'Settled') return `<span style="color:var(--text-muted);">Settled</span>`;
  const isOld = bucket === '30+ days';
  const isMid = bucket === '8-30 days';
  const color = isOld ? '#ef4444' : isMid ? '#f59e0b' : '#3b82f6';
  const bg = isOld ? 'rgba(239,68,68,0.10)' : isMid ? 'rgba(245,158,11,0.10)' : 'rgba(59,130,246,0.10)';
  return `<span style="display:inline-flex;align-items:center;gap:6px;background:${bg};color:${color};padding:4px 10px;border-radius:999px;font-size:0.78rem;font-weight:600;">${esc(bucket)}</span>`;
}

function renderInsightList(containerId, items, renderItem, emptyMessage) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = items && items.length ? items.map(renderItem).join('') : `<div class="empty">${emptyMessage}</div>`;
}

function renderBillingTrend(groups) {
  const el = document.getElementById('custBillingTrendList');
  if (!el) return;
  const names = Object.keys(groups || {});
  if (!names.length) {
    el.innerHTML = `<div class="empty">No recent billing trend available.</div>`;
    return;
  }
  el.innerHTML = names.slice(0, 6).map((name) => {
    const points = groups[name].map((row) => `${row.month}: ${fmtCurrency(row.billed_amount)}`).join(' | ');
    return `<div style="padding:0.85rem 1rem;border:1px solid var(--border-color);border-radius:12px;background:rgba(255,255,255,0.02);"><div style="display:flex;justify-content:space-between;gap:1rem;align-items:center;margin-bottom:0.35rem;"><strong>${esc(name)}</strong><span style="color:var(--text-muted);font-size:0.8rem;">${groups[name].length} months</span></div><div style="color:var(--text-muted);font-size:0.82rem;line-height:1.5;">${esc(points)}</div></div>`;
  }).join('');
}

/**
 * Orchestrator: Renders deep customer financial insights and activity trends.
 * @param {Object} insights - The insight data retrieved from the server.
 */
function renderCustomerInsights(insights) {
  const summary = insights && insights.summary ? insights.summary : {};
  const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  setText('custInsightPaidCount', Number(summary.paidCustomers || 0));
  setText('custInsightOverdueCount', Number(summary.overdueCustomers || 0));
  setText('custInsightCurrentDue', fmtCurrency(summary.totalCurrentDue || 0));

  renderInsightList('custTopPayingList', insights.topPayingCustomers, (row) => `<div style="display:flex;justify-content:space-between;gap:0.75rem;align-items:center;padding:0.75rem 0.85rem;border:1px solid var(--border-color);border-radius:12px;"><div><div style="font-weight:600;">${esc(row.name)}</div><div style="color:var(--text-muted);font-size:0.8rem;">Collected so far</div></div><strong style="color:#10b981;">${fmtCurrency(row.amount_paid)}</strong></div>`, 'No paying customers yet.');
  renderInsightList('custHighestDueList', insights.highestPendingDues, (row) => `<div style="display:flex;justify-content:space-between;gap:0.75rem;align-items:center;padding:0.75rem 0.85rem;border:1px solid var(--border-color);border-radius:12px;"><div><div style="font-weight:600;">${esc(row.name)}</div><div style="color:var(--text-muted);font-size:0.8rem;">${esc(row.outstanding_age_bucket || 'Open')} | ${esc(row.payment_status || 'Partial')}</div></div><strong style="color:#ef4444;">${fmtCurrency(row.current_due)}</strong></div>`, 'No pending dues.');
  renderInsightList('custInactiveList', insights.inactiveCustomers, (row) => `<div style="display:flex;justify-content:space-between;gap:0.75rem;align-items:center;padding:0.75rem 0.85rem;border:1px solid var(--border-color);border-radius:12px;"><div><div style="font-weight:600;">${esc(row.name)}</div><div style="color:var(--text-muted);font-size:0.8rem;">Last trip: ${fmtDate(row.last_trip_date)}</div></div><strong style="color:var(--text-muted);">${Number(row.inactive_days || 0)} days</strong></div>`, 'No inactive customers right now.');

  const grouped = (insights.monthlyBillingTrend || []).reduce((acc, row) => {
    if (!acc[row.name]) acc[row.name] = [];
    acc[row.name].push(row);
    return acc;
  }, {});
  renderBillingTrend(grouped);
  applyMetricValueBehavior();
}


function showCustomerTab(tab) {
  const isHistory = tab === 'history';
  document.getElementById('custPanelActive').style.display  = isHistory ? 'none' : 'block';
  document.getElementById('custPanelHistory').style.display = isHistory ? 'block' : 'none';
  document.getElementById('custAddBtn').style.display       = isHistory ? 'none' : '';
  // Highlight active tab button
  const btnActive  = document.getElementById('custTabActive');
  const btnHistory = document.getElementById('custTabHistory');
  btnActive.style.borderColor  = isHistory ? '' : 'var(--primary)';
  btnActive.style.color        = isHistory ? '' : 'var(--primary)';
  btnHistory.style.borderColor = isHistory ? 'var(--primary)' : '';
  btnHistory.style.color       = isHistory ? 'var(--primary)' : '';
  if (isHistory) loadCustomerHistoryTab();
}

async function loadCustomerHistoryTab() {
  const tbody = document.getElementById('customerHistoryTableBody');
  const sortBy = document.getElementById('customerHistorySort')?.value || 'date_desc';
  tbody.innerHTML = `<tr><td colspan="9" class="empty">Loading history...</td></tr>`;

  try {
    const rows = await api('/api/customers/history');
    if (!rows.length) { tbody.innerHTML = `<tr><td colspan="9" class="empty">No customer trip history found</td></tr>`; return; }

    const sortedRows = [...rows].sort((a, b) => {
      if (sortBy === 'name_asc' || sortBy === 'name_desc') {
        const nameA = String(a.name || `Unknown Customer #${a.customer_id}`).toLowerCase();
        const nameB = String(b.name || `Unknown Customer #${b.customer_id}`).toLowerCase();
        return sortBy === 'name_asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      }

      const dateA = a.last_trip ? new Date(a.last_trip).getTime() : 0;
      const dateB = b.last_trip ? new Date(b.last_trip).getTime() : 0;
      return sortBy === 'date_asc' ? dateA - dateB : dateB - dateA;
    });

    tbody.innerHTML = sortedRows.map((c, i) => {
      const statusBadge = c.is_deleted
        ? `<span class="status-badge status-maintenance">Deleted</span>`
        : `<span class="status-badge status-active">Active</span>`;
      const lastDate = c.last_trip ? new Date(c.last_trip).toLocaleDateString('en-IN') : '—';
      const displayName = c.name || `Deleted Customer #${c.customer_id}`;
      const displayPhone = c.phone_no || '—';
      return `<tr>
        <td>${i + 1}</td>
        <td><strong>${esc(displayName)}</strong></td>
        <td>${esc(displayPhone)}</td>
        <td>${lastDate}</td>
        <td><strong>${c.total_trips}</strong></td>
        <td><strong>${Number(c.total_quantity || 0).toLocaleString('en-IN')}</strong></td>
        <td>${fmtCurrency(c.total_revenue)}</td>
        <td>${statusBadge}</td>
        <td><button class="btn-icon" title="View Trips" onclick="showCustomerTripHistory(${c.customer_id}, '${esc(displayName)}')"><i class="fa-solid fa-list"></i></button></td>
      </tr>`;

    }).join('');
  } catch (err) {
    console.error('History Error:', err);
    tbody.innerHTML = `<tr><td colspan="9" class="empty error">Failed to load history</td></tr>`;
  }

}

async function showCustomerTripHistory(customerId, name, isOneTime = false) {
  document.getElementById('custHistModalTitle').textContent = `${name} — Trip History${isOneTime ? ' (One-time Customer)' : ''}`;
  const tbody = document.getElementById('custHistModalBody');
  tbody.innerHTML = `<tr><td colspan="8" class="empty">Loading...</td></tr>`;
  openModal('customerTripHistoryModal');
  try {
    let trips = [];
    let stats = [];
    
    if (isOneTime) {
      // For one-time customers, get all trips and filter by manual_customer_name
      const allTrips = await api('/api/analytics/trip-profitability?limit=1000&page=1');
      trips = (allTrips.data || []).filter(t => t.customer_name === name);
      stats = [];
    } else {
      // For regular customers
      [trips, stats] = await Promise.all([
        api(`/api/customers/${customerId}/trips`),
        api(`/api/customers/${customerId}/material-stats`)
      ]);
    }

    const totalBilled   = trips.reduce((s, t) => s + Number(t.amount||0), 0);
    const totalTripsCount = trips.length;
    const totalQty      = trips.reduce((s, t) => s + Number(t.quantity||0), 0);

    // Fetch customer's amount_received from the customers API (only for regular customers)
    let amtReceived = 0;
    if (!isOneTime) {
      try { const cust = await api(`/api/customers/${customerId}`); amtReceived = Number(cust.amount_paid || 0); } catch(e) {}
    }
    const net = amtReceived - totalBilled;

    const netColor = net >= 0 ? '#10b981' : '#ef4444';
    const netLabel = net > 0 ? `Extra Paid +${fmtCurrency(net)}` : net < 0 ? `Still Owes ${fmtCurrency(Math.abs(net))}` : 'Settled';
    const netIcon  = net > 0 ? 'arrow-up' : net < 0 ? 'arrow-down' : 'circle-check';

    // Material badges
    let materialHtml = '';
    if (stats.length > 0) {
      materialHtml = `<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.75rem;">` +
        stats.map(s => `<span class="status-badge" style="background:var(--primary);color:white;border:none;font-size:0.75rem;">${esc(s.material_type)}: ${s.trip_count} trips · ${Number(s.total_quantity).toLocaleString('en-IN')} Tons</span>`).join('') +
        `</div>`;
    }

    document.getElementById('custHistModalSub').innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:0.75rem;margin:0.75rem 0;">
        <div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:10px;padding:0.75rem;">
          <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;font-weight:600;margin-bottom:0.25rem;"><i class="fa-solid fa-file-invoice" style="margin-right:4px;"></i>Total Billed</div>
          <div style="font-size:1.1rem;font-weight:700;color:#3b82f6;">${fmtCurrency(totalBilled)}</div>
        </div>
        <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:10px;padding:0.75rem;">
          <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;font-weight:600;margin-bottom:0.25rem;"><i class="fa-solid fa-circle-check" style="margin-right:4px;"></i>${isOneTime ? 'Total Trips' : 'Amount Received'}</div>
          <div style="font-size:1.1rem;font-weight:700;color:#10b981;">${isOneTime ? totalTripsCount : fmtCurrency(amtReceived)}</div>
        </div>
        <div style="background:rgba(${net>=0?'16,185,129':'239,68,68'},0.08);border:1px solid rgba(${net>=0?'16,185,129':'239,68,68'},0.2);border-radius:10px;padding:0.75rem;">
          <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;font-weight:600;margin-bottom:0.25rem;"><i class="fa-solid fa-scale-balanced" style="margin-right:4px;"></i>Net Balance</div>
          <div style="font-size:1rem;font-weight:700;color:${netColor};display:flex;align-items:center;gap:5px;"><i class="fa-solid fa-${netIcon}" style="font-size:0.8rem;"></i>${netLabel}</div>
        </div>
        <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:10px;padding:0.75rem;">
          <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;font-weight:600;margin-bottom:0.25rem;"><i class="fa-solid fa-route" style="margin-right:4px;"></i>Trips · Quantity</div>
          <div style="font-size:1rem;font-weight:700;color:#f59e0b;">${totalTripsCount} trips · ${Number(totalQty).toLocaleString('en-IN')} Tons</div>
        </div>
      </div>
      ${materialHtml}
      ${net < 0
        ? `<div style="margin-top:0.75rem;padding:0.9rem 1.1rem;background:rgba(239,68,68,0.12);border:1.5px solid rgba(239,68,68,0.4);border-radius:10px;display:flex;align-items:center;gap:0.75rem;">
            <i class="fa-solid fa-circle-exclamation" style="color:#ef4444;font-size:1.3rem;"></i>
            <div>
              <div style="font-weight:700;color:#ef4444;font-size:1rem;">Balance Due: ${fmtCurrency(Math.abs(net))}</div>
              <div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px;">Customer has been billed ${fmtCurrency(totalBilled)} but paid only ${fmtCurrency(amtReceived)}. Please collect the remaining amount.</div>
            </div>
          </div>`
        : net === 0
          ? `<div style="margin-top:0.75rem;padding:0.75rem 1rem;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.3);border-radius:10px;display:flex;align-items:center;gap:0.6rem;">
              <i class="fa-solid fa-circle-check" style="color:#10b981;"></i>
              <span style="color:#10b981;font-weight:600;">Fully Settled — No balance due</span>
             </div>`
          : `<div style="margin-top:0.75rem;padding:0.75rem 1rem;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.3);border-radius:10px;display:flex;align-items:center;gap:0.6rem;">
              <i class="fa-solid fa-arrow-up" style="color:#10b981;"></i>
              <span style="color:#10b981;font-weight:600;">Customer has paid ${fmtCurrency(net)} extra beyond billed amount.</span>
             </div>`
      }
    `;

    if (!trips.length) { tbody.innerHTML = `<tr><td colspan="8" class="empty">No trips found for this customer</td></tr>`; return; }

    tbody.innerHTML = trips.map((t, i) => {
      const d = t.trip_date ? new Date(t.trip_date).toLocaleDateString('en-IN') : '—';
      const badge = `<span class="status-badge status-${t.status}">${t.status}</span>`;
      const totalBilled = Number(t.amount || 0);
      return `<tr>
        <td>${i + 1}</td>
        <td>${d}</td>
        <td>${esc(`Trip Bill ${t.trip_id}`)}</td>
        <td>${esc(t.material_type || '—')}</td>
        <td>${t.quantity || 0} Tons</td>
        <td>${esc(t.truck_no || '—')}</td>

        <td>${esc(t.driver_name || '—')}</td>
        <td><strong>${fmtCurrency(totalBilled)}</strong></td>
        <td>${badge}</td>
      </tr>`;

    }).join('');
  } catch (err) { tbody.innerHTML = `<tr><td colspan="8" class="empty error">Failed to load trips</td></tr>`; }
}


async function loadCustomers() {
  switchView('customers');
  const tbody = document.getElementById('customersTableBody');
  const tc = tbody.closest('.table-responsive');
  showLoading(tc, 'Loading customers...');
  try {
    const [rows, insights] = await Promise.all([
      api('/api/customers'),
      api('/api/customers/insights').catch(() => ({ topPayingCustomers: [], highestPendingDues: [], inactiveCustomers: [], monthlyBillingTrend: [], summary: {} }))
    ]);

    const totalBilled = rows.reduce((s, c) => s + Number(c.total_billed || 0), 0);
    const totalPaid = rows.reduce((s, c) => s + Number(c.amount_paid || 0), 0);
    const totalNet = totalPaid - totalBilled;
    const totalTrips = rows.reduce((s, c) => s + Number(c.total_trips || 0), 0);
    const g = id => document.getElementById(id);
    if (g('custStatTotal')) g('custStatTotal').textContent = rows.length;
    if (g('custStatBilled')) g('custStatBilled').textContent = fmtCurrency(totalBilled);
    if (g('custStatPaid')) g('custStatPaid').textContent = fmtCurrency(totalPaid);
    if (g('custStatNet')) {
      g('custStatNet').textContent = `${totalNet >= 0 ? '+' : '-'}${fmtCurrency(Math.abs(totalNet))}`;
      g('custStatNet').style.color = totalNet >= 0 ? '#10b981' : '#ef4444';
    }
    if (g('custStatTrips')) g('custStatTrips').textContent = totalTrips;

    renderCustomerInsights(insights);

    if (!rows.length) {
      tbody.innerHTML = emptyRow(11, 'No customers yet');
      return;
    }

    const sortedRows = [...rows];
    if (appState.customers.sorts.length) {
      sortedRows.sort((a, b) => {
        for (const sort of appState.customers.sorts) {
          let valueA = 0;
          let valueB = 0;

          switch (sort.key) {
            case 'total_billed':
              valueA = Number(a.total_billed || 0);
              valueB = Number(b.total_billed || 0);
              break;
            case 'amount_paid':
              valueA = Number(a.amount_paid || 0);
              valueB = Number(b.amount_paid || 0);
              break;
            case 'due_date':
              valueA = a.due_date ? new Date(a.due_date).getTime() : 0;
              valueB = b.due_date ? new Date(b.due_date).getTime() : 0;
              break;
            case 'total_trips':
              valueA = Number(a.total_trips || 0);
              valueB = Number(b.total_trips || 0);
              break;
            default:
              continue;
          }

          const comparison = valueA - valueB;
          if (comparison !== 0) return sort.dir === 'asc' ? comparison : -comparison;
        }
        return 0;
      });
    }

    const setCustomerSortIcon = (id, key) => {
      const el = document.getElementById(id);
      if (el) {
        el.className = `fa-solid ${getCustomerSortIcon(key)}`;
        const btn = el.closest('button');
        if (btn) btn.title = getNextSortTitle(appState.customers.sorts, key);
      }
    };
    setCustomerSortIcon('custSortBilled', 'total_billed');
    setCustomerSortIcon('custSortReceived', 'amount_paid');
    setCustomerSortIcon('custSortDueDate', 'due_date');
    setCustomerSortIcon('custSortTrips', 'total_trips');

    tbody.innerHTML = sortedRows.map((c, i) => {
      const initials = c.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
      const billed = Number(c.total_billed || 0);
      const received = Number(c.amount_paid || 0);
      const currentDue = Number(c.current_due || 0);
      const advance = Number(c.advance_amount || 0);
      const dueDisplay = currentDue > 0
        ? `<strong style="color:#ef4444;white-space:nowrap;">Due ${fmtCurrency(currentDue)}</strong>`
        : `<strong style="color:#10b981;white-space:nowrap;">Advance ${fmtCurrency(advance)}</strong>`;
      const dueDateLabel = c.due_date ? fmtDate(c.due_date) : '';
      const dueDateDisplay = currentDue > 0
        ? `<span style="display:inline-flex;align-items:center;gap:6px;white-space:nowrap;color:#ef4444;font-weight:600;"><i class="fa-solid fa-clock" style="font-size:0.72rem;"></i>Pending${dueDateLabel ? ` • ${esc(dueDateLabel)}` : ''}</span>`
        : (dueDateLabel || '<span style="color:var(--text-muted);">-</span>');
      const followUp = c.follow_up_notes ? esc(c.follow_up_notes) : '<span style="color:var(--text-muted);">-</span>';
      const tripsBadge = `<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(59,130,246,0.1);color:#3b82f6;border:1px solid rgba(59,130,246,0.2);padding:3px 10px;border-radius:20px;font-size:0.82rem;font-weight:600;"><i class="fa-solid fa-route" style="font-size:0.65rem;"></i>${c.total_trips || 0}</span>`;

      return `<tr id="customer-row-${c.customer_id}" data-customer-id="${c.customer_id}">
        <td style="font-weight:600;color:var(--text-muted);">${i + 1}</td>
        <td>
          <div style="display:flex;align-items:flex-start;gap:0.75rem;">
            <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#f59e0b,#ef4444);display:flex;align-items:center;justify-content:center;font-size:0.74rem;font-weight:700;color:#fff;flex-shrink:0;">${initials}</div>
            <div>
              <strong style="display:block;font-size:0.92rem;">${esc(c.name)}</strong>
              <div style="color:var(--text-muted);font-size:0.8rem;">${esc(c.phone_no || 'No phone')} | ${esc(c.address || 'No address')}</div>
            </div>
          </div>
        </td>
        <td><strong style="color:#3b82f6;">${fmtCurrency(billed)}</strong></td>
        <td><strong style="color:#10b981;">${fmtCurrency(received)}</strong></td>
        <td>${dueDisplay}</td>
        <td>${paymentStatusBadge(c.payment_status)}</td>
        <td style="white-space:nowrap;">${dueDateDisplay}</td>
        <td style="max-width:220px;font-size:0.82rem;color:var(--text-muted);">${followUp}</td>
        <td>${ageBucketBadge(c.outstanding_age_bucket)}</td>
        <td>${tripsBadge}</td>
        <td class="actions-cell">
          <button class="btn-icon btn-icon-success" title="Add Payment" onclick='openCustomerPaymentModal(${c.customer_id}, ${JSON.stringify(c.name)}, ${received}, ${billed}, ${JSON.stringify(c.due_date || "")}, ${JSON.stringify(c.payment_status || "")})'><i class="fa-solid fa-indian-rupee-sign"></i></button>
          <button class="btn-icon" title="Ledger" onclick='showCustomerTransactions(${c.customer_id}, ${JSON.stringify(c.name)})'><i class="fa-solid fa-book"></i></button>
          <button class="btn-icon btn-icon-success" title="View Trips" onclick='showCustomerTripHistory(${c.customer_id}, ${JSON.stringify(c.name)})'><i class="fa-solid fa-clock-rotate-left"></i></button>
          <button class="btn-icon" title="Edit" onclick="editCustomer(${c.customer_id})"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-icon btn-icon-danger" title="Delete" onclick="deleteCustomer(${c.customer_id})"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>`;
    }).join('');
    applyPendingHighlight('customers');
  } catch (err) {
    tbody.innerHTML = errorRow(11);
  } finally {
    hideLoading(tc);
  }
}

async function submitCustomer(e) {
  e.preventDefault();
  const id = document.getElementById('custId').value;
  const body = {
    name: document.getElementById('custName').value,
    phone_no: document.getElementById('custPhone').value,
    address: document.getElementById('custAddress').value,
    due_date: document.getElementById('custDueDate')?.value || null,
    follow_up_notes: document.getElementById('custFollowUpNotes')?.value.trim() || ''
  };
  if (!id) body.amount_paid = document.getElementById('custAmountPaid').value;
  try {
    if (id) {
      await api(`/api/customers/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      showToast('Customer updated', 'success');
    } else {
      await api('/api/customers', { method: 'POST', body: JSON.stringify(body) });
      showToast('Customer added', 'success');
    }
    cancelForm('customerForm');
    resetCustomerForm();
    loadCustomers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function editCustomer(id) {
  try {
    const c = await api(`/api/customers/${id}`);
    document.getElementById('custId').value = c.customer_id;
    document.getElementById('custName').value = c.name;
    document.getElementById('custPhone').value = c.phone_no || '';
    document.getElementById('custAddress').value = c.address || '';
    document.getElementById('custAmountPaid').value = c.amount_paid || 0;
    if (document.getElementById('custDueDate')) document.getElementById('custDueDate').value = c.due_date ? String(c.due_date).split('T')[0] : '';
    if (document.getElementById('custFollowUpNotes')) document.getElementById('custFollowUpNotes').value = c.follow_up_notes || '';
    const amountInput = document.getElementById('custAmountPaid');
    const amountWrap = document.getElementById('custAmountPaidWrap');
    const amountHint = document.getElementById('custAmountPaidHint');
    if (amountInput) amountInput.disabled = true;
    if (amountWrap) amountWrap.style.opacity = '0.7';
    if (amountHint) amountHint.textContent = 'Use "Add Payment" from the customer row to record more money later.';
    const title = document.getElementById('customerFormTitle');
    if (title) title.textContent = `Edit Customer - ${c.name}`;
    document.getElementById('customerForm').style.display = 'block';
    document.getElementById('customerForm').scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteCustomer(id) {
  if (!confirm('Delete this customer? Historical trip bills will be kept in reports.')) return;
  try {
    await api(`/api/customers/${id}`, { method: 'DELETE' });
    showToast('Customer deleted', 'success');
    await loadCustomers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openCustomerPaymentModal(customerId, name, amountPaid = 0, totalBilled = 0, dueDate = '', paymentStatus = '') {
  document.getElementById('custPaymentCustomerId').value = customerId;
  document.getElementById('custPaymentTitle').textContent = `Add Payment - ${name}`;
  document.getElementById('custPaymentSummary').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:0.75rem;margin-top:0.75rem;">
      <div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:10px;padding:0.75rem;">
        <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:0.25rem;">Total Billed</div>
        <div style="font-weight:700;color:#3b82f6;">${fmtCurrency(totalBilled)}</div>
      </div>
      <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:10px;padding:0.75rem;">
        <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:0.25rem;">Received So Far</div>
        <div style="font-weight:700;color:#10b981;">${fmtCurrency(amountPaid)}</div>
      </div>
      <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:10px;padding:0.75rem;">
        <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:0.25rem;">Current Due</div>
        <div style="font-weight:700;color:${amountPaid >= totalBilled ? '#10b981' : '#ef4444'};">${amountPaid >= totalBilled ? 'Advance ' : 'Due '}${fmtCurrency(Math.abs(totalBilled - amountPaid))}</div>
      </div>
      <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-color);border-radius:10px;padding:0.75rem;">
        <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:0.25rem;">Status / Due Date</div>
        <div style="font-weight:700;">${esc(paymentStatus || 'Partial')}</div>
        <div style="font-size:0.8rem;color:var(--text-muted);">${dueDate ? fmtDate(dueDate) : 'No due date set'}</div>
      </div>
    </div>
  `;
  document.getElementById('custPaymentAmount').value = '';
  if (document.getElementById('custPaymentMethod')) document.getElementById('custPaymentMethod').value = 'Cash';
  document.getElementById('custPaymentNotes').value = '';
  document.getElementById('custPaymentDate').value = new Date().toISOString().split('T')[0];
  openModal('customerPaymentModal');
}

async function submitCustomerPayment(e) {
  e.preventDefault();
  const customerId = document.getElementById('custPaymentCustomerId').value;
  const body = {
    amount: document.getElementById('custPaymentAmount').value,
    payment_method: document.getElementById('custPaymentMethod')?.value || 'Cash',
    notes: document.getElementById('custPaymentNotes').value.trim(),
    payment_date: document.getElementById('custPaymentDate').value
  };
  try {
    await api(`/api/customers/${customerId}/payments`, { method: 'POST', body: JSON.stringify(body) });
    closeModal('customerPaymentModal');
    showToast('Payment added', 'success');
    await loadCustomers();
    await showCustomerTransactions(customerId);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function showCustomerTransactions(customerId, name = '') {
  const tbody = document.getElementById('custTxnModalBody');
  const sub = document.getElementById('custTxnModalSub');
  const trend = document.getElementById('custLedgerTrend');
  const title = document.getElementById('custTxnModalTitle');
  if (title) title.textContent = name ? `${name} - Customer Ledger` : 'Customer Ledger';
  if (trend) trend.innerHTML = '';
  tbody.innerHTML = `<tr><td colspan="7" class="empty">Loading ledger...</td></tr>`;
  openModal('customerTransactionsModal');

  try {
    const ledgerData = await api(`/api/customers/${customerId}/ledger`);
    const customer = ledgerData.customer || {};
    const customerName = name || customer.name || 'Customer';
    const due = Number(customer.current_due || 0);
    const advance = Number(customer.advance_amount || 0);

    if (title) title.textContent = `${customerName} - Customer Ledger`;
    if (sub) {
      sub.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:0.75rem;margin:0.75rem 0;">
          <div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:10px;padding:0.75rem;">
            <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:0.25rem;">Total Billed</div>
            <div style="font-size:1.05rem;font-weight:700;color:#3b82f6;">${fmtCurrency(customer.total_billed || 0)}</div>
          </div>
          <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:10px;padding:0.75rem;">
            <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:0.25rem;">Total Received</div>
            <div style="font-size:1.05rem;font-weight:700;color:#10b981;">${fmtCurrency(customer.amount_paid || 0)}</div>
          </div>
          <div style="background:rgba(${due > 0 ? '239,68,68' : '16,185,129'},0.08);border:1px solid rgba(${due > 0 ? '239,68,68' : '16,185,129'},0.2);border-radius:10px;padding:0.75rem;">
            <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:0.25rem;">Current Position</div>
            <div style="font-size:1.05rem;font-weight:700;color:${due > 0 ? '#ef4444' : '#10b981'};">${due > 0 ? `Due ${fmtCurrency(due)}` : `Advance ${fmtCurrency(advance)}`}</div>
          </div>
          <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-color);border-radius:10px;padding:0.75rem;">
            <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:0.25rem;">Status / Follow-up</div>
            <div style="font-size:0.95rem;font-weight:700;">${esc(customer.payment_status || 'Partial')}</div>
            <div style="font-size:0.78rem;color:var(--text-muted);margin-top:0.2rem;">${esc(customer.follow_up_notes || 'No follow-up notes')}</div>
          </div>
        </div>
      `;
    }

    if (trend) {
      trend.innerHTML = !ledgerData.monthlyTrend || !ledgerData.monthlyTrend.length
        ? `<div style="padding:0.85rem 1rem;border:1px dashed var(--border-color);border-radius:12px;color:var(--text-muted);">No recent monthly billing trend for this customer.</div>`
        : `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:0.75rem;">${ledgerData.monthlyTrend.map((row) => `<div style="padding:0.85rem 1rem;border:1px solid var(--border-color);border-radius:12px;background:rgba(255,255,255,0.02);"><div style="font-weight:700;margin-bottom:0.3rem;">${esc(row.month)}</div><div style="font-size:0.82rem;color:#3b82f6;">Billed: ${fmtCurrency(row.billed_amount)}</div><div style="font-size:0.82rem;color:#10b981;">Received: ${fmtCurrency(row.received_amount)}</div></div>`).join('')}</div>`;
    }

    if (!ledgerData.ledger || !ledgerData.ledger.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty">No bills or payments yet</td></tr>`;
      return;
    }

    const rows = [...ledgerData.ledger].reverse();
    tbody.innerHTML = rows.map((entry, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${fmtDate(entry.entry_date)}</td>
        <td>${entry.entry_type === 'bill' ? '<span style="color:#3b82f6;font-weight:700;">Bill</span>' : '<span style="color:#10b981;font-weight:700;">Payment</span>'}</td>
        <td><strong>${esc(entry.title || '-')}</strong><div style="color:var(--text-muted);font-size:0.8rem;">${esc(entry.payment_method || entry.notes || '-')}</div></td>
        <td>${entry.debit_amount ? `<strong style="color:#3b82f6;">${fmtCurrency(entry.debit_amount)}</strong>` : '-'}</td>
        <td>${entry.credit_amount ? `<strong style="color:#10b981;">${fmtCurrency(entry.credit_amount)}</strong>` : '-'}</td>
        <td><strong style="color:${Number(entry.running_balance || 0) > 0 ? '#ef4444' : '#10b981'};">${fmtCurrency(Math.abs(entry.running_balance || 0))}</strong><div style="font-size:0.78rem;color:var(--text-muted);">${Number(entry.running_balance || 0) > 0 ? 'due' : 'advance / settled'}</div></td>
      </tr>
    `).join('');
  } catch (err) {
    if (sub) sub.innerHTML = '';
    if (trend) trend.innerHTML = '';
    tbody.innerHTML = `<tr><td colspan="7" class="empty error">Failed to load ledger</td></tr>`;
  }
}

function resetCustomerForm() {
  ['custId', 'custName', 'custPhone', 'custAddress', 'custDueDate', 'custFollowUpNotes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const amountInput = document.getElementById('custAmountPaid');
  const amountWrap = document.getElementById('custAmountPaidWrap');
  const amountHint = document.getElementById('custAmountPaidHint');
  if (amountInput) {
    amountInput.value = 0;
    amountInput.disabled = false;
  }
  if (amountWrap) amountWrap.style.opacity = '';
  if (amountHint) amountHint.textContent = 'Only for first entry. Later payments can be added from the customer row.';
  const title = document.getElementById('customerFormTitle');
  if (title) title.textContent = 'Add New Customer';
}

/* ------------------------------------------
   TRIPS CRUD
   ------------------------------------------ */
function applyTripFilters() {
  appState.trips.page = 1;
  const ps = document.getElementById('tripPageSize');
  if (ps) appState.trips.limit = parseInt(ps.value) || 10;
  fetchTrips();
}

function changeTripPage(dir) {
  const np = appState.trips.page + dir;
  if (np >= 1 && np <= appState.trips.totalPages) { appState.trips.page = np; fetchTrips(); }
}

function getSortEntry(sorts, sortBy) {
  return sorts.find(sort => sort.key === sortBy) || null;
}

function getNextSortTitle(sorts, sortBy) {
  const activeSort = getSortEntry(sorts, sortBy);
  if (!activeSort) return 'Sort ascending';
  return activeSort.dir === 'asc' ? 'Sort descending' : 'Clear sort (default)';
}

function getStackedSorts(nextSorts, sortBy) {
  const sorts = [...nextSorts];
  const existingIndex = sorts.findIndex(sort => sort.key === sortBy);

  if (existingIndex >= 0) {
    if (sorts[existingIndex].dir === 'asc') {
      sorts[existingIndex] = { key: sortBy, dir: 'desc' };
    } else {
      sorts.splice(existingIndex, 1);
    }
    return sorts;
  }

  const appended = [...sorts, { key: sortBy, dir: 'asc' }];
  return appended.slice(-3);
}

function getTripSortIcon(sortBy) {
  const activeSort = getSortEntry(appState.trips.sorts, sortBy);
  if (!activeSort) return 'fa-sort';
  return activeSort.dir === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
}

function getDriverSortIcon(sortBy) {
  const activeSort = getSortEntry(appState.drivers.sorts, sortBy);
  if (!activeSort) return 'fa-sort';
  return activeSort.dir === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
}

function getCustomerSortIcon(sortBy) {
  const activeSort = getSortEntry(appState.customers.sorts, sortBy);
  if (!activeSort) return 'fa-sort';
  return activeSort.dir === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
}

function getFuelSortIcon(sortBy) {
  const activeSort = getSortEntry(appState.fuel.sorts, sortBy);
  if (!activeSort) return 'fa-sort';
  return activeSort.dir === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
}

function toggleTripSort(sortBy) {
  appState.trips.sorts = getStackedSorts(appState.trips.sorts, sortBy);
  fetchTrips();
}

function toggleDriverSort(sortBy) {
  appState.drivers.sorts = getStackedSorts(appState.drivers.sorts, sortBy);
  loadDrivers();
}

function toggleCustomerSort(sortBy) {
  appState.customers.sorts = getStackedSorts(appState.customers.sorts, sortBy);
  loadCustomers();
}

function toggleFuelSort(sortBy) {
  appState.fuel.sorts = getStackedSorts(appState.fuel.sorts, sortBy);
  fetchFuelData();
}

async function loadTrips() {
  switchView('trips');
  fetchTrips();
}

/**
 * Service: Core data fetching logic for trips.
 * Handles pagination, complex multi-field filtering, and client-side sorting.
 */
/**
 * Service: Retrieves and renders the trip ledger.
 * Implements server-side pagination, sorting, and multi-criteria filtering.
 */
async function fetchTrips() {
  const tbody = document.getElementById('tripsTableBody');
  const tc = tbody.closest('.table-responsive');
  showLoading(tc, 'Loading trips...');
  const params = new URLSearchParams();
  params.set('page', appState.trips.page);
  params.set('limit', appState.trips.limit);
  const f = { customer: document.getElementById('tripFilterCustomer').value, driver: document.getElementById('tripFilterDriver').value.trim(), truck: document.getElementById('tripFilterTruck').value.trim(), date: document.getElementById('tripFilterDate').value, status: document.getElementById('tripFilterStatus').value };
  for (const [k, v] of Object.entries(f)) if (v) params.set(k, v);
  try {
    const [res, trucks, drivers, customers] = await Promise.all([
      api('/api/analytics/trip-profitability?' + params.toString()),
      api('/api/trucks'), api('/api/drivers'), api('/api/customers')
    ]);
    setSelectOpts('trpTruck', trucks.map(t => ({ value: t.truck_id, label: t.truck_no })));
    setSelectOpts('trpDriver', drivers.map(d => ({ value: d.driver_id, label: d.name })));
    setSelectOpts('trpCustomer', [
      ...customers.map(c => ({ value: c.customer_id, label: `${c.name} (${c.phone_no || 'N/A'})` })),
      { value: 'OTHER', label: 'Other Customer' }
    ]);
    const currentCustomerFilter = document.getElementById('tripFilterCustomer').value;
    const currentDriverFilter = document.getElementById('tripFilterDriver').value;
    setSelectOpts('tripFilterCustomer', [{value: '', label: 'All'}, ...customers.map(c => ({ value: c.customer_id, label: `${c.name} (${c.phone_no || 'N/A'})` }))]);
    setSelectOpts('tripFilterDriver', [{value: '', label: 'All Drivers'}, ...drivers.map(d => ({ value: d.driver_id, label: d.name }))]);
    if (currentCustomerFilter) document.getElementById('tripFilterCustomer').value = currentCustomerFilter;
    if (currentDriverFilter) document.getElementById('tripFilterDriver').value = currentDriverFilter;
    appState.trips.rows = [...(res.data || [])];
    if (appState.trips.sorts.length) {
      const getTripSortValue = (row, key) => {
        switch (key) {
          case 'quantity':
            return Number(row.quantity || 0);
          case 'trip_date':
            return row.trip_date ? new Date(row.trip_date).getTime() : 0;
          default:
            return '';
        }
      };

      appState.trips.rows.sort((a, b) => {
        for (const sort of appState.trips.sorts) {
          const valueA = getTripSortValue(a, sort.key);
          const valueB = getTripSortValue(b, sort.key);

          if (typeof valueA === 'string') {
            const comparison = valueA.localeCompare(valueB);
            if (comparison !== 0) return sort.dir === 'asc' ? comparison : -comparison;
            continue;
          }

          const comparison = valueA - valueB;
          if (comparison !== 0) return sort.dir === 'asc' ? comparison : -comparison;
        }
        return 0;
      });
    }
    appState.trips.totalPages = Math.max(res.totalPages, 1);
    document.getElementById('tripPageInfo').textContent = `Page ${appState.trips.page} of ${appState.trips.totalPages} • ${res.totalRecords || 0} trips`;
    document.getElementById('tripPrevBtn').disabled = appState.trips.page <= 1;
    document.getElementById('tripNextBtn').disabled = appState.trips.page >= appState.trips.totalPages;
    const setTripSortIcon = (id, sortKey) => {
      const el = document.getElementById(id);
      if (el) {
        el.className = `fa-solid ${getTripSortIcon(sortKey)}`;
        const btn = el.closest('button');
        if (btn) btn.title = getNextSortTitle(appState.trips.sorts, sortKey);
      }
    };
    setTripSortIcon('tripSortQty', 'quantity');
    setTripSortIcon('tripSortDate', 'trip_date');
    if (!appState.trips.rows.length) { tbody.innerHTML = emptyRow(9, 'No trips found'); return; }

    const offset = (appState.trips.page - 1) * appState.trips.limit;
    tbody.innerHTML = appState.trips.rows.map((t, i) => {
      const manualCustomerName = getTripManualCustomerName(t);
      const isOneTimeCustomer = !t.customer_id && manualCustomerName;
      const displayName = isOneTimeCustomer
        ? esc(manualCustomerName)
        : esc(t.customer_name || '—');
      
      return `<tr id="trip-row-${t.trip_id}" data-trip-id="${t.trip_id}">
        <td>${offset + i + 1}</td>
        <td>${esc(t.material_type || '—')}</td>
        <td>${t.quantity || 0} Tons</td>
        <td>${esc(t.truck_no || '—')}</td><td>${esc(t.driver_name || '—')}</td><td>${displayName}</td>
        <td>${t.destination ? `<span style="display:inline-flex;align-items:center;gap:4px;font-size:0.85rem;"><i class="fa-solid fa-location-dot" style="color:var(--danger);font-size:0.75rem;"></i>${esc(t.destination)}</span>` : '<span style="color:var(--text-muted);">—</span>'}</td>
        <td>${fmtDate(t.trip_date)}</td>
        <td><strong>${fmtCurrency(t.amount || 0)}</strong></td>
        <td class="actions-cell">
          <button class="btn-icon" onclick="editTrip(${t.trip_id})"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-icon btn-icon-danger" onclick="deleteTrip(${t.trip_id})"><i class="fa-solid fa-trash"></i></button>
        </td></tr>`;
    }).join('');
  } catch (err) { tbody.innerHTML = errorRow(9); } finally { hideLoading(tc); }
}

/**
 * Controller: Handles the submission of trip records.
 * Manages one-time customer logic and triggers driver credential generation for new drivers.
 * @param {Event} e - Form submission event.
 */
async function submitTrip(e) {
  e.preventDefault();
  const id = document.getElementById('trpId').value;
  const customerValue = document.getElementById('trpCustomer').value;
  const isOneTime = customerValue === 'OTHER';
  
  // Validate one-time customer has a name
  if (isOneTime) {
    const manualName = document.getElementById('trpManualCustomerName').value.trim();
    if (!manualName) {
      showToast('Please enter a customer name for one-time customer', 'error');
      return;
    }
  }
  
  const body = {
    truck_id: document.getElementById('trpTruck').value || null,
    driver_id: document.getElementById('trpDriver').value || null,
    amount: document.getElementById('trpAmount').value,
    material_type: document.getElementById('trpMaterial').value,
    quantity: document.getElementById('trpQuantity').value,
    status: document.getElementById('trpStatus').value,
    trip_date: document.getElementById('trpDate').value,
    destination: document.getElementById('trpDestination').value || null
  };

  // Handle customer logic: if other, send manual_customer_name; otherwise send customer_id
  if (isOneTime) {
    body.customer_id = null;
    body.manual_customer_name = document.getElementById('trpManualCustomerName').value.trim();
  } else {
    body.customer_id = customerValue || null;
    body.manual_customer_name = null;
  }

  try {
    if (id) {
      await api(`/api/trips/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      showToast('Trip updated', 'success');
    } else {
      const res = await api('/api/trips', { method: 'POST', body: JSON.stringify(body) });
      // Show auto-generated driver credentials if newly created
      if (res.driverCredentials?.isNew) {
        showDriverCredentialCard(res.driverCredentials.email, res.driverCredentials.password);
      } else {
        showToast('Trip added', 'success');
      }
    }
    cancelForm('tripForm'); resetTripForm(); if(document.getElementById('tripFilterDate')) document.getElementById('tripFilterDate').value = ''; if(document.getElementById('tripFilterStatus')) document.getElementById('tripFilterStatus').value = ''; appState.trips.page = 1; fetchTrips();
  } catch (err) { showToast(err.message, 'error'); }
}

function editTrip(id) {
  const t = appState.trips.rows.find(r => r.trip_id === id);
  if (!t) { showToast('Trip not found on this page', 'info'); return; }
  const manualCustomerName = getTripManualCustomerName(t);
  document.getElementById('trpId').value = t.trip_id;
  document.getElementById('trpAmount').value = t.amount !== undefined ? t.amount : 0;
  document.getElementById('trpMaterial').value = t.material_type || '';
  document.getElementById('trpQuantity').value = t.quantity || 0;
  document.getElementById('trpStatus').value   = t.status || 'completed';
  document.getElementById('trpDate').value = t.trip_date ? t.trip_date.split('T')[0] : '';
  document.getElementById('trpDestination').value = t.destination || '';

  // Determine if this is a one-time customer trip
  const isOneTime = !t.customer_id && manualCustomerName;

  if (isOneTime) {
    document.getElementById('trpManualCustomerName').value = manualCustomerName || '';
  } else {
    document.getElementById('trpManualCustomerName').value = '';
  }

  // Choices.js requires setChoiceByValue() — direct .value assignment doesn't update the custom UI
  const setChoice = (id, val) => {
    const inst = choiceInstances[id];
    const el = document.getElementById(id);
    if (el) el.value = val || '';
    if (inst && val) { inst.setChoiceByValue(String(val)); }
  };
  setChoice('trpTruck',    t.truck_id    || '');
  setChoice('trpDriver',   t.driver_id   || '');
  // Set customer dropdown - if no customer_id, set to 'OTHER' for one-time customer
  if (t.customer_id) {
    setChoice('trpCustomer', t.customer_id);
    setTripCustomerFieldVisibility(false);
  } else if (manualCustomerName) {
    setChoice('trpCustomer', 'OTHER');
    setTripCustomerFieldVisibility(true);
  } else {
    setChoice('trpCustomer', '');
    setTripCustomerFieldVisibility(false);
  }

  document.getElementById('tripForm').style.display = 'block';
  document.getElementById('tripForm').scrollIntoView({ behavior: 'smooth' });
}

function setTripCustomerFieldVisibility(show) {
  const field = document.getElementById('trpManualCustomerNameGroup');
  if (!field) return;
  field.style.display = show ? 'block' : 'none';
}

function getTripManualCustomerName(t) {
  const manual = String(t?.manual_customer_name || '').trim();
  if (manual) return manual;
  if (!t?.customer_id) {
    const fallback = String(t?.customer_name || '').trim();
    if (fallback && fallback.toLowerCase() !== 'unknown' && fallback !== '—') return fallback;
  }
  return '';
}

// Toggle the one-time customer name field visibility
function toggleOneTimeCustomerField() {
  const dropdown = document.getElementById('trpCustomer');
  setTripCustomerFieldVisibility(dropdown && dropdown.value === 'OTHER');
}

async function deleteTrip(id) {
  if (!confirm('Delete this trip?')) return;
  try { await api(`/api/trips/${id}`, { method: 'DELETE' }); showToast('Trip deleted', 'success'); fetchTrips(); } catch (err) { showToast(err.message, 'error'); }
}

function resetTripForm() {
  ['trpId', 'trpAmount', 'trpDate', 'trpDestination', 'trpManualCustomerName'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('trpTruck').value = '';
  document.getElementById('trpDriver').value = '';
  document.getElementById('trpCustomer').value = '';
  document.getElementById('trpMaterial').value = '';
  document.getElementById('trpQuantity').value = '0';
  document.getElementById('trpStatus').value = 'pending';

  ['trpTruck', 'trpDriver', 'trpCustomer'].forEach((id) => {
    const inst = choiceInstances[id];
    if (inst) inst.setChoiceByValue('');
  });

  toggleOneTimeCustomerField();
}

/* ------------------------------------------
   FUEL CRUD
   ------------------------------------------ */
function changeFuelPage(dir) {
  const np = appState.fuel.page + dir;
  if (np >= 1 && np <= appState.fuel.totalPages) { appState.fuel.page = np; fetchFuelData(); }
}

function applyFuelFilters() {
  appState.fuel.page = 1;
  const ps = document.getElementById('fuelPageSize');
  if (ps) appState.fuel.limit = parseInt(ps.value) || 10;
  fetchFuelData();
}

function clearFuelFilters() {
  const ft = document.getElementById('fuelFilterTruck');
  const fd = document.getElementById('fuelFilterDate');
  if (ft) ft.value = '';
  if (fd) fd.value = '';
  applyFuelFilters();
}

window.switchFuelTab = function(tab) {
  const btnRecords = document.getElementById('tabFuelRecordsBtn');
  const btnEff = document.getElementById('tabFuelEfficiencyBtn');
  const secRecords = document.getElementById('fuelTabRecords');
  const secEff = document.getElementById('fuelTabEfficiency');

  // Reset styles
  [btnRecords, btnEff].forEach(b => {
    if(!b) return;
    b.style.color = 'var(--text-muted)';
    b.style.borderBottomColor = 'transparent';
  });

  // Hide sections
  if(secRecords) secRecords.style.display = 'none';
  if(secEff) secEff.style.display = 'none';

  // Activate selected
  if (tab === 'records') {
    if(btnRecords) { btnRecords.style.color = 'var(--primary)'; btnRecords.style.borderBottomColor = 'var(--primary)'; }
    if(secRecords) secRecords.style.display = 'block';
  } else {
    if(btnEff) { btnEff.style.color = 'var(--primary)'; btnEff.style.borderBottomColor = 'var(--primary)'; }
    if(secEff) secEff.style.display = 'block';
  }
};

async function loadFuel() {
  switchView('fuel');
  switchFuelTab('records'); // Always default to records tab
  await Promise.all([
    fetchFuelData(),
    fetchEfficiencyData()
  ]);
}

async function fetchFuelData() {
  const tbody = document.getElementById('fuelTableBody');
  const tc = tbody.closest('.table-responsive');
  showLoading(tc, 'Loading fuel records...');
  try {
    const params = new URLSearchParams();
    params.set('page', appState.fuel.page);
    params.set('limit', appState.fuel.limit);

    // Directly read truck_id from the new select element
    const fTruck = document.getElementById('fuelFilterTruck')?.value;
    if (fTruck) params.set('truck_id', fTruck);

    const filterDate = document.getElementById('fuelFilterDate')?.value || '';
    if (filterDate) params.set('date', filterDate);

    const drvFilter = document.getElementById('fuelFilterDriver')?.value;
    if (drvFilter) params.set('driver_id', drvFilter);

    const [res, trucks, drivers] = await Promise.all([
      api('/api/fuel?' + params.toString()),
      api('/api/trucks'),
      api('/api/drivers')
    ]);

    // Store trucks for search lookup
    appState._fuelTrucks = trucks;

    // Populate form selects
    setSelectOpts('fuelTruck', trucks.map(t => ({ value: t.truck_id, label: t.truck_no })));
    setSelectOpts('fuelDriver', drivers.map(d => ({ value: d.driver_id, label: d.name })));

    // Populate filters
    const currentDrFilter = document.getElementById('fuelFilterDriver') ? document.getElementById('fuelFilterDriver').value : '';
    setSelectOpts('fuelFilterDriver', [{value: '', label: 'All Drivers'}, ...drivers.map(d => ({ value: d.driver_id, label: d.name }))]);
    if (currentDrFilter && document.getElementById('fuelFilterDriver')) document.getElementById('fuelFilterDriver').value = currentDrFilter;

    const currentTrFilter = document.getElementById('fuelFilterTruck') ? document.getElementById('fuelFilterTruck').value : '';
    setSelectOpts('fuelFilterTruck', [{value: '', label: 'All Trucks'}, ...trucks.map(t => ({ value: t.truck_id, label: t.truck_no }))]);
    if (currentTrFilter && document.getElementById('fuelFilterTruck')) document.getElementById('fuelFilterTruck').value = currentTrFilter;

    const rows = res.data || [];
    appState.fuel.rows = rows;
    appState.fuel.totalPages = Math.max(Math.ceil(res.totalRecords / appState.fuel.limit), 1);
    document.getElementById('fuelPageInfo').textContent =
      `Page ${appState.fuel.page} of ${appState.fuel.totalPages} • ${res.totalRecords || 0} records`;
    document.getElementById('fuelPrevBtn').disabled = appState.fuel.page <= 1;
    document.getElementById('fuelNextBtn').disabled = appState.fuel.page >= appState.fuel.totalPages;

    // Compute stats from all records (fetch all for stats if on page 1 with no filter)
    const allRes = await api('/api/fuel?page=1&limit=50');
    const allRows = allRes.data || [];
    const totalLiters = allRows.reduce((s, r) => s + Number(r.liters || 0), 0);
    const totalCost   = allRows.reduce((s, r) => s + Number(r.price  || 0), 0);
    const now = new Date();
    const monthCost   = allRows.filter(r => {
      const d = new Date(r.fuel_date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).reduce((s, r) => s + Number(r.price || 0), 0);

    const sl = document.getElementById('fuelStatLiters');
    const sc = document.getElementById('fuelStatCost');
    const sm = document.getElementById('fuelStatMonth');
    const sr = document.getElementById('fuelStatRecords');
    if (sl) sl.textContent = `${Number(totalLiters.toFixed(1)).toLocaleString('en-IN')} L`;
    if (sc) sc.textContent = fmtCurrency(totalCost);
    if (sm) sm.textContent = fmtCurrency(monthCost);
    if (sr) sr.textContent = res.totalRecords || allRows.length;

    const sortedRows = [...rows];
    if (appState.fuel.sorts.length) {
      sortedRows.sort((a, b) => {
        for (const sort of appState.fuel.sorts) {
          let valueA = 0;
          let valueB = 0;

          switch (sort.key) {
            case 'liters':
              valueA = Number(a.liters || 0);
              valueB = Number(b.liters || 0);
              break;
            case 'rate':
              valueA = Number(a.liters || 0) > 0 ? Number(a.price || 0) / Number(a.liters || 0) : 0;
              valueB = Number(b.liters || 0) > 0 ? Number(b.price || 0) / Number(b.liters || 0) : 0;
              break;
            case 'price':
              valueA = Number(a.price || 0);
              valueB = Number(b.price || 0);
              break;
            case 'fuel_date':
              valueA = a.fuel_date ? new Date(a.fuel_date).getTime() : 0;
              valueB = b.fuel_date ? new Date(b.fuel_date).getTime() : 0;
              break;
            default:
              continue;
          }

          const comparison = valueA - valueB;
          if (comparison !== 0) return sort.dir === 'asc' ? comparison : -comparison;
        }
        return 0;
      });
    }

    const setFuelSortIcon = (id, key) => {
      const el = document.getElementById(id);
      if (el) {
        el.className = `fa-solid ${getFuelSortIcon(key)}`;
        const btn = el.closest('button');
        if (btn) btn.title = getNextSortTitle(appState.fuel.sorts, key);
      }
    };
    setFuelSortIcon('fuelSortVolume', 'liters');
    setFuelSortIcon('fuelSortRate', 'rate');
    setFuelSortIcon('fuelSortCost', 'price');
    setFuelSortIcon('fuelSortDate', 'fuel_date');

    if (!sortedRows.length) { tbody.innerHTML = emptyRow(8, 'No fuel records found'); return; }

    const offset = (appState.fuel.page - 1) * appState.fuel.limit;
    tbody.innerHTML = sortedRows.map((f, i) => {
      const liters = Number(f.liters || 0);
      const price  = Number(f.price  || 0);
      const rate   = liters > 0 ? (price / liters).toFixed(2) : '—';
      return `<tr>
        <td class="fuel-col-serial">${offset + i + 1}</td>
        <td class="fuel-col-truck"><span class="status-badge" style="background:rgba(59,130,246,0.12);color:#3b82f6;border:1px solid rgba(59,130,246,0.3);font-weight:600;">
          <i class="fa-solid fa-truck" style="margin-right:4px;font-size:0.7rem;"></i>${esc(f.truck_no || '—')}
        </span></td>
        <td>${esc(f.driver_name || '—')}</td>
        <td><span class="status-badge" style="background:rgba(16,185,129,0.1);color:#10b981;border:1px solid rgba(16,185,129,0.3);">
          <i class="fa-solid fa-droplet" style="margin-right:4px;font-size:0.7rem;"></i>${liters.toLocaleString('en-IN')} L
        </span></td>
        <td style="color:var(--text-muted);font-size:0.88rem;">\u20B9${rate}/L</td>
        <td><strong style="color:var(--danger);">${fmtCurrency(price)}</strong></td>
        <td><span style="display:inline-flex;align-items:center;gap:4px;font-size:0.85rem;color:var(--text-muted);">
          <i class="fa-regular fa-calendar" style="font-size:0.75rem;"></i>${fmtDate(f.fuel_date)}
        </span></td>
        <td class="actions-cell">
          <button class="btn-icon" title="Edit" onclick="editFuel(${f.fuel_id})"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-icon btn-icon-danger" title="Delete" onclick="deleteFuel(${f.fuel_id})"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>`;
    }).join('');
    applyPendingHighlight('maintenance');
  } catch (err) { tbody.innerHTML = errorRow(8); } finally { hideLoading(tc); }
}

async function submitFuel(e) {
  e.preventDefault();
  const id = document.getElementById('fuelId').value;
  const body = { truck_id: document.getElementById('fuelTruck').value || null, driver_id: document.getElementById('fuelDriver').value || null, liters: document.getElementById('fuelLiters').value, price: document.getElementById('fuelPrice').value, fuel_date: document.getElementById('fuelDate').value };
  try {
    if (id) {
      await api(`/api/fuel/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      showToast('Fuel record updated', 'success');
    } else {
      await api('/api/fuel', { method: 'POST', body: JSON.stringify(body) });
      showToast('Fuel record added', 'success');
    }
    cancelForm('fuelForm'); resetFuelForm(); 
    // Clear filters to ensure the new record is visible
    if (document.getElementById('fuelFilterDate')) document.getElementById('fuelFilterDate').value = '';
    const ftSel = document.getElementById('fuelFilterTruck');
    if (ftSel) ftSel.value = '';
    appState.fuel.page = 1; // Reset to page 1 to show new record
    loadFuel();
  } catch (err) { showToast(err.message, 'error'); }
}

function editFuel(id) {
  const f = appState.fuel.rows.find(r => r.fuel_id === id);
  if (!f) { showToast('Fuel record not found on this page', 'info'); return; }

  document.getElementById('fuelId').value = f.fuel_id;
  document.getElementById('fuelLiters').value = f.liters || 0;
  document.getElementById('fuelPrice').value = f.price || 0;
  document.getElementById('fuelDate').value = f.fuel_date ? String(f.fuel_date).split('T')[0] : '';

  ['fuelTruck', 'fuelDriver'].forEach((fieldId) => {
    const inst = choiceInstances[fieldId];
    const value = fieldId === 'fuelTruck' ? f.truck_id : f.driver_id;
    if (inst && value) inst.setChoiceByValue(String(value));
    else {
      const el = document.getElementById(fieldId);
      if (el) el.value = value || '';
    }
  });

  const title = document.getElementById('fuelFormTitle');
  if (title) title.textContent = `Edit Fuel Entry - ${f.truck_no || 'Record'}`;
  document.getElementById('fuelForm').style.display = 'block';
  document.getElementById('fuelForm').scrollIntoView({ behavior: 'smooth' });
}

async function deleteFuel(id) {
  if (!confirm('Delete this fuel record?')) return;
  try { await api(`/api/fuel/${id}`, { method: 'DELETE' }); showToast('Fuel deleted', 'success'); loadFuel(); } catch (err) { showToast(err.message, 'error'); }
}

function resetFuelForm() {
  ['fuelId', 'fuelLiters', 'fuelPrice', 'fuelDate'].forEach(id => document.getElementById(id).value = '');
  const ciT = window.choiceInstances && window.choiceInstances['fuelTruck'];
  if (ciT) ciT.setChoiceByValue(''); else document.getElementById('fuelTruck').value = '';
  const ciD = window.choiceInstances && window.choiceInstances['fuelDriver'];
  if (ciD) ciD.setChoiceByValue(''); else document.getElementById('fuelDriver').value = '';
  const title = document.getElementById('fuelFormTitle');
  if (title) title.textContent = 'Log Fuel Entry';
}

/* -- Export Handlers -- */
async function downloadReport(path, filename) {
  try {
    const tk = localStorage.getItem('tbToken');
    const r = await fetch(API + path, { headers: { Authorization: `Bearer ${tk}` } });
    if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Download failed'); }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  } catch (err) { showToast(err.message, 'error'); }
}
function getTripFiltersQS() {
  const c = document.getElementById('tripFilterCustomer') ? document.getElementById('tripFilterCustomer').value : '';
  const d = document.getElementById('tripFilterDriver') ? document.getElementById('tripFilterDriver').value : '';
  const t = document.getElementById('tripFilterTruck') ? document.getElementById('tripFilterTruck').value : '';
  const dt = document.getElementById('tripFilterDate') ? document.getElementById('tripFilterDate').value : '';
  const s = document.getElementById('tripFilterStatus') ? document.getElementById('tripFilterStatus').value : '';
  return `&customer=${encodeURIComponent(c)}&driver=${encodeURIComponent(d)}&truck=${encodeURIComponent(t)}&date=${encodeURIComponent(dt)}&status=${encodeURIComponent(s)}`;
}

function exportTripsPDF() { downloadReport(`/api/reports/trips/pdf?t=${Date.now()}${getTripFiltersQS()}`, 'Bhilal-Trucks-trips-report.pdf'); }
function exportTripsExcel() { downloadReport(`/api/reports/trips/excel?t=${Date.now()}${getTripFiltersQS()}`, 'Bhilal-Trucks-trips-report.xlsx'); }
function getFuelFiltersQS() {
  const t = document.getElementById('fuelFilterTruck') ? document.getElementById('fuelFilterTruck').value.trim() : '';
  const drv = document.getElementById('fuelFilterDriver') ? document.getElementById('fuelFilterDriver').value : '';
  const d = document.getElementById('fuelFilterDate') ? document.getElementById('fuelFilterDate').value : '';
  return `&truckStr=${encodeURIComponent(t)}&driver=${encodeURIComponent(drv)}&date=${encodeURIComponent(d)}`;
}

function exportFuelExcel() { downloadReport(`/api/reports/fuel/excel?t=${Date.now()}${getFuelFiltersQS()}`, 'Bhilal-Trucks-fuel-report.xlsx'); }
function exportMonthlyRevenuePdf() { downloadReport(`/api/reports/revenue/monthly/pdf?t=${Date.now()}`, 'Bhilal-Trucks-monthly-revenue.pdf'); }
function exportMonthlyRevenueExcel() { downloadReport(`/api/reports/revenue/monthly/excel?t=${Date.now()}`, 'Bhilal-Trucks-monthly-revenue.xlsx'); }
function exportDailyRevenuePdf() { downloadReport(`/api/reports/revenue/daily/pdf?t=${Date.now()}`, 'Bhilal-Trucks-daily-revenue.pdf'); }
function exportDailyRevenueExcel() { downloadReport(`/api/reports/revenue/daily/excel?t=${Date.now()}`, 'Bhilal-Trucks-daily-revenue.xlsx'); }
function exportDailyRevenuePDF() { exportDailyRevenuePdf(); }
function exportRevenuePDF() { exportMonthlyRevenuePdf(); }
async function openJsonReport(path, title) {
  try {
    const data = await api(path);
    document.getElementById('jsonReportTitle').textContent = title;
    document.getElementById('jsonReportBody').textContent = JSON.stringify(data, null, 2);
    openModal('jsonReportModal');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ------------------------------------------
   ADVANCED MODULES (Performance, Maintenance, Efficiency)
   ------------------------------------------ */

/* Driver Performance */
async function loadPerformance() {
  switchView('performance');
  const tbody = document.getElementById('performanceTableBody');
  const tc = tbody.closest('.table-responsive');
  showLoading(tc, 'Loading performance data...');
  try {
    const rows = await api('/api/drivers/performance');
    if (!rows.length) { tbody.innerHTML = emptyRow(6, 'No performance data yet'); return; }
    tbody.innerHTML = rows.map((r, i) => {
      let medal = '';
      if (i === 0) medal = '<i class="fa-solid fa-medal" style="color:#fbbf24; font-size:1.2rem;"></i>';
      else if (i === 1) medal = '<i class="fa-solid fa-medal" style="color:#9ca3af; font-size:1.2rem;"></i>';
      else if (i === 2) medal = '<i class="fa-solid fa-medal" style="color:#b45309; font-size:1.2rem;"></i>';
      
      return `<tr>
      <td>${medal || i + 1}</td>
      <td><strong>${esc(r.name)}</strong></td>
      <td>${r.total_trips}</td>
      <td>${Number(r.total_fuel).toLocaleString('en-IN')} L</td>
      <td>${fmtCurrency(r.revenue)}</td>
      <td><span class="status-badge" style="background:var(--primary); color:white;">${Number(r.score).toLocaleString('en-IN')}</span></td>
    </tr>`;
    }).join('');
  } catch (err) { tbody.innerHTML = errorRow(6); } finally { hideLoading(tc); }
}

/* Truck Maintenance */
function getMaintenanceSortIcon(sortBy) {
  const activeSort = getSortEntry(appState.maintenance.sorts, sortBy);
  if (!activeSort) {
    return 'fa-solid fa-sort';
  }
  return activeSort.dir === 'asc'
    ? 'fa-solid fa-sort-up'
    : 'fa-solid fa-sort-down';
}

function toggleMaintenanceSort(sortBy) {
  appState.maintenance.sorts = getStackedSorts(appState.maintenance.sorts, sortBy);
  loadMaintenance();
}

function changeMaintenancePage(dir) {
  const np = appState.maintenance.page + dir;
  if (np >= 1 && np <= appState.maintenance.totalPages) { appState.maintenance.page = np; loadMaintenance(); }
}

async function loadMaintenance() {
  switchView('maintenance');
  const tbody = document.getElementById('maintenanceTableBody');
  const tc = tbody.closest('.table-responsive');
  showLoading(tc, 'Loading maintenance logs...');
  try {
    const params = new URLSearchParams();
    params.set('page', appState.maintenance.page);
    params.set('limit', appState.maintenance.limit);
    const [res, trucks, apiPending] = await Promise.all([
      api('/api/maintenance?' + params.toString()),
      api('/api/trucks'),
      api('/api/trucks/needs-maintenance').catch(() => [])
    ]);

    // Client-side merge: also include trucks with status='Maintenance'
    // that aren't already in the pending list from the API
    const pendingIds = new Set((apiPending || []).map(p => p.truck_id));
    const extraPending = trucks
      .filter(t => (t.status || '').toLowerCase() === 'maintenance' && !pendingIds.has(t.truck_id))
      .map(t => ({ truck_id: t.truck_id, truck_no: t.truck_no, maintenance: t.maintenance && t.maintenance.toLowerCase() !== 'not required' ? t.maintenance : 'Under Maintenance' }));
    const pending = [...(apiPending || []), ...extraPending];

    // --- Pending maintenance banner ---
    const banner = document.getElementById('pendingMaintenanceBanner');
    if (banner) {
      if (pending.length > 0) {
        banner.style.display = 'block';
        banner.innerHTML = `
          <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;">
            <i class="fa-solid fa-triangle-exclamation" style="color:#f59e0b;font-size:1.1rem;"></i>
            <strong style="color:#f59e0b;">${pending.length} truck${pending.length > 1 ? 's' : ''} pending maintenance</strong>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:0.5rem;">
            ${pending.map(t => `
              <div id="pending-maintenance-chip-${t.truck_id}" data-truck-id="${t.truck_id}" style="display:inline-flex;align-items:center;gap:0.5rem;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.4);padding:0.4rem 0.75rem;border-radius:8px;">
                <i class="fa-solid fa-truck" style="color:#f59e0b;font-size:0.75rem;"></i>
                <span style="font-weight:600;font-size:0.88rem;">${esc(t.truck_no)}</span>
                <span style="color:var(--text-muted);font-size:0.8rem;">· ${esc(t.maintenance)}</span>
                <button class="btn-primary" style="padding:0.2rem 0.6rem;font-size:0.78rem;border-radius:6px;"
                  onclick="logMaintenanceForTruck(${t.truck_id}, '${esc(t.truck_no)}', '${esc(t.maintenance)}')">
                  <i class="fa-solid fa-wrench"></i> Log
                </button>
              </div>`).join('')}
          </div>`;
      } else {
        banner.style.display = 'none';
        banner.innerHTML = '';
      }
    }

    appState.maintenance.totalPages = Math.max(Math.ceil(res.totalRecords / appState.maintenance.limit), 1);
    document.getElementById('mtnPageInfo').textContent = `Page ${appState.maintenance.page} of ${appState.maintenance.totalPages} • ${res.totalRecords || 0} records`;
    document.getElementById('mtnPrevBtn').disabled = appState.maintenance.page <= 1;
    document.getElementById('mtnNextBtn').disabled = appState.maintenance.page >= appState.maintenance.totalPages;

    // Populate stat cards
    const allMtn = await api('/api/maintenance?page=1&limit=50').catch(() => ({ data: [] }));
    const allRows2 = allMtn.data || [];
    const totalCostAll = allRows2.reduce((s, r) => s + Number(r.cost || 0), 0);
    const now2 = new Date();
    const monthCost = allRows2.filter(r => {
      const d = new Date(r.service_date); return d.getFullYear() === now2.getFullYear() && d.getMonth() === now2.getMonth();
    }).reduce((s, r) => s + Number(r.cost || 0), 0);
    const st = document.getElementById('mtnStatTotal');  if (st) st.textContent = res.totalRecords || 0;
    const sc = document.getElementById('mtnStatCost');   if (sc) sc.textContent = fmtCurrency(totalCostAll);
    const sm = document.getElementById('mtnStatMonth');  if (sm) sm.textContent = fmtCurrency(monthCost);
    const sp = document.getElementById('mtnStatPending');if (sp) sp.textContent = pending.length;

    const setSortIcon = (id, sortKey) => {
      const el = document.getElementById(id);
      if (el) {
        el.className = getMaintenanceSortIcon(sortKey);
        const btn = el.closest('button');
        if (btn) btn.title = getNextSortTitle(appState.maintenance.sorts, sortKey);
      }
    };
    setSortIcon('mtnSortTruck', 'truck_no');
    setSortIcon('mtnSortServiceDate', 'service_date');

    const rows = [...(res.data || [])];
    setSelectOpts('mtnTruck', trucks.map(t => ({ value: t.truck_id, label: t.truck_no })));
    if (!rows.length) { tbody.innerHTML = emptyRow(7, 'No maintenance records yet'); return; }

    if (appState.maintenance.sorts.length) {
      rows.sort((a, b) => {
        const getServiceType = (row) => row.description && row.description.includes('|')
          ? row.description.split('|')[0].trim()
          : (row.description || '');
        const getNotes = (row) => row.description && row.description.includes('|')
          ? row.description.split('|')[1].trim()
          : '';

        const getMaintenanceSortValue = (row, key) => {
          switch (key) {
            case 'truck_no':
              return String(row.truck_no || '').toLowerCase();
            case 'service_date':
              return new Date(row.service_date || 0).getTime();
            default:
              return '';
          }
        };

        for (const sort of appState.maintenance.sorts) {
          const valueA = getMaintenanceSortValue(a, sort.key);
          const valueB = getMaintenanceSortValue(b, sort.key);

          if (typeof valueA === 'string') {
            const comparison = valueA.localeCompare(valueB);
            if (comparison !== 0) return sort.dir === 'asc' ? comparison : -comparison;
            continue;
          }

          const comparison = valueA - valueB;
          if (comparison !== 0) return sort.dir === 'asc' ? comparison : -comparison;
        }

        return 0;
      });
    }

    const offset = (appState.maintenance.page - 1) * appState.maintenance.limit;
    tbody.innerHTML = rows.map((m, i) => {
      const serviceType = m.description && m.description.includes('|')
        ? m.description.split('|')[0].trim()
        : (m.description || '—');
      const notes = m.description && m.description.includes('|')
        ? m.description.split('|')[1].trim()
        : '—';
      const serviceLabel = m.service_type || serviceType;
      const notesLabel   = m.notes || notes;
      return `<tr id="maintenance-row-truck-${m.truck_id || ''}" data-truck-id="${m.truck_id || ''}">
        <td>${offset + i + 1}</td>
        <td><span class="status-badge" style="background:rgba(59,130,246,0.12);color:#3b82f6;border:1px solid rgba(59,130,246,0.3);font-weight:600;">
          <i class="fa-solid fa-truck" style="margin-right:4px;font-size:0.7rem;"></i>${esc(m.truck_no || '—')}
        </span></td>
        <td><span class="status-badge" style="background:rgba(139,92,246,0.1);color:#8b5cf6;border:1px solid rgba(139,92,246,0.3);">
          <i class="fa-solid fa-screwdriver-wrench" style="margin-right:4px;font-size:0.7rem;"></i>${esc(serviceLabel)}
        </span></td>
        <td style="color:var(--text-muted);font-size:0.85rem;">${esc(notesLabel)}</td>
        <td><span style="display:inline-flex;align-items:center;gap:4px;font-size:0.85rem;color:var(--text-muted);">
          <i class="fa-regular fa-calendar" style="font-size:0.75rem;"></i>${fmtDate(m.service_date)}
        </span></td>
        <td><strong style="color:var(--danger);">${fmtCurrency(m.cost)}</strong></td>
        <td>${
          m.proof_document
            ? `<button onclick="viewProofDocument(${m.maintenance_id})" class="btn-secondary" style="padding:0.35rem 0.65rem;font-size:0.8rem;"><i class="fa-solid fa-paperclip"></i> View</button>`
            : '<span style="color:var(--text-muted);">—</span>'
        }</td>
        <td class="actions-cell">
          <button class="btn-icon btn-icon-danger" title="Delete" onclick="deleteMaintenance(${m.maintenance_id})"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>`;
    }).join('');
    applyPendingHighlight('maintenance');
  } catch (err) { tbody.innerHTML = errorRow(8); } finally { hideLoading(tc); }
}

async function logMaintenanceForTruck(truckId, truckNo, note) {
  // Pre-fill description and date
  document.getElementById('mtnDesc').value = '';
  document.getElementById('mtnDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('mtnCost').value = '';
  document.getElementById('mtnId').value = '';

  // Try to match the pending note to a known service type
  const knownServices = [
    'Oil Change','Tyre Replacement','Tyre Puncture Fix','Brake Service','Engine Repair',
    'Battery Replacement','Clutch Repair','Gear Box Repair','Suspension Repair',
    'AC Repair','Electrical Work','Body Work / Denting','Full Service'
  ];
  const matched = knownServices.find(s => note.toLowerCase().includes(s.toLowerCase()));
  const st = document.getElementById('mtnServiceType');
  if (st) {
    st.value = matched || 'Other';
    if (!matched) document.getElementById('mtnDesc').value = note; // put unmatched note in additional notes
  }

  // Reload truck options then set selected truck
  try {
    const trucks = await api('/api/trucks');
    setSelectOpts('mtnTruck', trucks.map(t => ({ value: t.truck_id, label: t.truck_no })));
  } catch (e) {}

  // Set selected truck value (after Choices.js reinit)
  setTimeout(() => {
    const ci = window.choiceInstances && window.choiceInstances['mtnTruck'];
    if (ci) {
      ci.setChoiceByValue(String(truckId));
    } else {
      const sel = document.getElementById('mtnTruck');
      if (sel) sel.value = truckId;
    }
  }, 80);

  // Show and scroll to form
  const form = document.getElementById('maintenanceForm');
  form.style.display = 'block';
  form.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Controller: Handles the submission of maintenance records, including multipart/form-data
 * for physical document proof (Cloudinary/Local).
 * @param {Event} e - Form submission event.
 */
async function submitMaintenance(e) {
  e.preventDefault();
  const id = document.getElementById('mtnId').value;
  const serviceType = document.getElementById('mtnServiceType')?.value || '';
  const notes       = document.getElementById('mtnDesc').value;
  // Store as "ServiceType | Notes" in description for backward compat
  const description = serviceType && notes ? `${serviceType} | ${notes}` : (serviceType || notes);
  const body = new FormData();
  body.append('truck_id', document.getElementById('mtnTruck').value);
  body.append('service_date', document.getElementById('mtnDate').value);
  body.append('cost', document.getElementById('mtnCost').value);
  body.append('description', description);
  const btn = e.target.querySelector('button[type="submit"]');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...'; }

  const proofFile = document.getElementById('mtnProof')?.files?.[0];
  if (proofFile) {
    console.log("Maintenance Upload: Sending file", { name: proofFile.name, size: proofFile.size });
    body.append('proof_document', proofFile);
  }

  try {
    let result;
    if (id) { result = await api(`/api/maintenance/${id}`, { method: 'PUT', body }); showToast('Record updated', 'success'); }
    else     { result = await api('/api/maintenance',       { method: 'POST', body }); showToast('Service logged', 'success'); }
    // Warn if user selected a file but the server didn't store it
    if (proofFile && result && result.proof_stored === false) {
      showToast('?? Record saved, but proof file could not be stored. Check Cloudinary settings.', 'error');
    }
    cancelForm('maintenanceForm'); resetMaintenanceForm(); appState.maintenance.page = 1; loadMaintenance();
  } catch (err) { 
    console.error("Maintenance Submission Error:", err);
    showToast(err.message, 'error'); 
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-save"></i> Save Record'; }
  }
}

async function deleteMaintenance(id) {
  if (!confirm('Delete this maintenance record?')) return;
  try { await api(`/api/maintenance/${id}`, { method: 'DELETE' }); showToast('Deleted', 'success'); loadMaintenance(); } catch (err) { showToast(err.message, 'error'); }
}

function resetMaintenanceForm() {
  ['mtnId', 'mtnDate', 'mtnCost', 'mtnDesc'].forEach(id => document.getElementById(id).value = '');
  const proof = document.getElementById('mtnProof');
  if (proof) proof.value = '';
  const st = document.getElementById('mtnServiceType'); if (st) st.value = '';
  // Reset Choices.js for mtnTruck
  const ci = window.choiceInstances && window.choiceInstances['mtnTruck'];
  if (ci) ci.setChoiceByValue(''); else { const s = document.getElementById('mtnTruck'); if (s) s.value = ''; }
}

function prefillMtnDesc() {
  const st = document.getElementById('mtnServiceType');
  const desc = document.getElementById('mtnDesc');
  // Only prefill if notes is empty, to avoid overwriting user input
  if (st && desc && !desc.value) {
    // Leave notes blank — service type itself is already capturing the what
  }
}

/* Fuel Efficiency */
let efficiencyCostChart = null;
async function fetchEfficiencyData() {
  const tbody = document.getElementById('efficiencyTableBody');
  try {
    const data = await api('/api/dashboard/efficiency');
    const rows = data.fuelByTruck || [];

    // Calculate stat cards
    const totalLiters = rows.reduce((acc, r) => acc + Number(r.total_liters || 0), 0);
    const totalCost   = rows.reduce((acc, r) => acc + Number(r.total_cost || 0), 0);
    const avgCost     = totalLiters > 0 ? (totalCost / totalLiters) : 0;
    
    const g = id => document.getElementById(id);
    if (g('effStatTrucks')) g('effStatTrucks').textContent = rows.length;
    if (g('effStatLiters')) g('effStatLiters').textContent = Number(totalLiters).toLocaleString('en-IN') + ' L';
    if (g('effStatCost'))   g('effStatCost').textContent   = fmtCurrency(totalCost);
    if (g('effStatAvg'))    g('effStatAvg').textContent    = fmtCurrency(avgCost);

    if (!rows.length) { tbody.innerHTML = emptyRow(6, 'No efficiency data yet'); }
    else {
      tbody.innerHTML = rows.map((r, i) => {
        const costPerL = r.total_liters > 0 ? (r.total_cost / r.total_liters) : 0;
        return `<tr>
          <td style="font-weight:600;color:var(--text-muted);">${i + 1}</td>
          <td>
            <div style="display:flex;align-items:center;gap:0.75rem;">
              <div style="width:32px;height:32px;border-radius:8px;background:rgba(59,130,246,0.1);color:#3b82f6;display:flex;align-items:center;justify-content:center;font-size:0.85rem;"><i class="fa-solid fa-truck"></i></div>
              <strong style="font-size:0.95rem;">${esc(r.truck_no || '—')}</strong>
            </div>
          </td>
          <td><span style="display:inline-flex;align-items:center;gap:4px;background:rgba(148,163,184,0.1);padding:3px 10px;border-radius:20px;font-size:0.85rem;"><i class="fa-solid fa-gas-pump" style="color:var(--text-muted);font-size:0.75rem;"></i>${r.refuels}</span></td>
          <td><strong style="color:#06b6d4;">${Number(r.total_liters).toLocaleString('en-IN')} L</strong></td>
          <td><strong style="color:var(--danger);">${fmtCurrency(r.total_cost)}</strong></td>
          <td><span style="color:#8b5cf6;font-weight:600;">${fmtCurrency(costPerL)}</span><span style="color:var(--text-muted);font-size:0.8rem;">/L</span></td>
        </tr>`;
      }).join('');
    }

    /* Render Chart */
    const trend = data.monthlyTrend || [];
    Chart.defaults.color = '#9ca3af';
    Chart.defaults.font.family = 'Inter';
    if (efficiencyCostChart) efficiencyCostChart.destroy();
    
    const effCtx = document.getElementById('efficiencyCostChart').getContext('2d');
    const effGradient = effCtx.createLinearGradient(0, 0, 0, 400);
    effGradient.addColorStop(0, 'rgba(16, 185, 129, 0.85)'); // Emerald solid
    effGradient.addColorStop(1, 'rgba(16, 185, 129, 0.15)'); // Emerald transparent

    efficiencyCostChart = new Chart(effCtx, {
      type: 'bar',
      data: {
        labels: trend.map(d => d.month),
        datasets: [{
          label: 'Total Cost (?)',
          data: trend.map(d => d.cost),
          backgroundColor: effGradient,
          borderRadius: 6,
          borderWidth: 0,
          barPercentage: 0.5,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(17, 24, 39, 0.95)',
            titleFont: { size: 13, family: 'Inter', weight: 'normal', color: '#9ca3af' },
            bodyFont: { size: 14, family: 'Inter', weight: 'bold' },
            padding: 12,
            cornerRadius: 8,
            displayColors: false,
            callbacks: {
              label: function(context) {
                const cost = context.raw;
                const liters = trend[context.dataIndex].liters;
                return [
                  ` Cost: \u20B9${cost.toLocaleString('en-IN')}`,
                  ` Volume: ${liters.toLocaleString('en-IN')} L`
                ];
              }
            }
          }
        },
        scales: {
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
            ticks: { color: '#9ca3af', font: { family: 'Inter' } }
          },
          x: {
            grid: { display: false, drawBorder: false },
            ticks: { color: '#9ca3af', font: { family: 'Inter' } }
          }
        }
      }
    });
  } catch (err) { tbody.innerHTML = errorRow(6); }
}

/* -- Socket.IO -- */
function initRealtime() {
  if (!window.io) return;
  const token = localStorage.getItem('tbToken');
  if (!token) return;
  if (!appState.socket) {
    appState.socket = io({ auth: { token } });
    appState.socket.on('new_trip', () => { 
      showToast('New trip recorded', 'success'); 
      if (document.getElementById('view-trips').style.display === 'block') {
        appState.trips.page = 1; 
        fetchTrips(); 
      }
    });
    appState.socket.on('fuel_update', () => { 
      showToast('Fuel updated', 'info'); 
      if (document.getElementById('view-fuel').style.display === 'block') {
        appState.fuel.page = 1; 
        loadFuel(); 
      }
      if (document.getElementById('view-dashboard').style.display === 'block') loadDashboard(); 
    });
    appState.socket.on('truck_location_update', (data) => {
      // Update the live GPS marker on the map if map view is active
      if (mapState.mainMap && data.latitude && data.longitude) {
        const latlng = [parseFloat(data.latitude), parseFloat(data.longitude)];
        const existing = mapState.gpsMarkers[data.truck_id];
        if (existing) {
          existing.setLatLng(latlng);
          // Update popup with place name asynchronously
          reverseGeocode(latlng[0], latlng[1]).then(place => {
            existing.setPopupContent(buildGpsPopup(data, place));
          });
        } else {
          mapState.gpsMarkers[data.truck_id] = createGpsMarker(data).addTo(mapState.mainMap);
        }
        // Fly map to the updated location so the user can see it
        mapState.mainMap.flyTo(latlng, Math.max(mapState.mainMap.getZoom(), 10), { duration: 1 });
        // Toast only if map view is visible
        const mapView = document.getElementById('view-map');
        if (mapView && (mapView.style.display === 'flex' || mapView.style.display === 'block')) {
          showToast(`?? ${data.truck_no || 'Truck'} location updated`, 'info');
        }
      }
    });
  }
}

/* -- Auto-login -- */
(function () {
  const tk = localStorage.getItem('tbToken');
  const u = localStorage.getItem('tbUser');
  if (!tk || !u) return;
  try {
    enterDashboard(JSON.parse(u));
  } catch (err) {
    logout();
  }
})();

/* ------------------------------------------
   MAP VIEW — Leaflet + OpenStreetMap
   ------------------------------------------ */
const mapState = {
  mainMap: null,
  dashMap: null,
  allTrips: [],
  statusFilter: 'all',
  geocodeCache: {},
  routeCache: {},
  gpsMarkers: {}
};

// Geocode a city name ? [lat, lng] using Nominatim (with caching)
async function geocodeCity(city) {
  if (!city) return null;
  const key = city.trim().toLowerCase();
  if (mapState.geocodeCache[key]) return mapState.geocodeCache[key];
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city + ', India')}&format=json&limit=1&countrycodes=in`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    const data = await res.json();
    if (data && data.length > 0) {
      const coords = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      mapState.geocodeCache[key] = coords;
      return coords;
    }
  } catch (e) {}
  return null;
}

// Fetch real road route geometry from OSRM (free, no API key)
async function getRoute(fromCoords, toCoords) {
  const key = `${fromCoords[0]},${fromCoords[1]};${toCoords[0]},${toCoords[1]}`;
  if (mapState.routeCache[key]) return mapState.routeCache[key];
  try {
    // OSRM expects [lng, lat] order
    const url = `https://router.project-osrm.org/route/v1/driving/${fromCoords[1]},${fromCoords[0]};${toCoords[1]},${toCoords[0]}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      // GeoJSON coordinates are [lng, lat] — convert to Leaflet [lat, lng]
      const latlngs = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
      mapState.routeCache[key] = latlngs;
      return latlngs;
    }
  } catch (e) {}
  // Fallback to straight line if OSRM fails
  return [fromCoords, toCoords];
}

// Route colors by status — Google Maps style
function routeColor(status) {
  const s = (status || '').toLowerCase();
  if (s === 'ongoing') return '#4285F4';  // Google Maps blue
  if (s === 'pending') return '#FBBC04';  // Google Maps yellow
  return '#34A853';                        // Google Maps green (completed)
}

// Load the full Map View page
async function loadMapView() {
  switchView('map');
  // Invalidate map size after tab switch
  setTimeout(() => mapState.mainMap && mapState.mainMap.invalidateSize(), 200);
  // Init map only once
  if (!mapState.mainMap) {
    mapState.mainMap = L.map('mainMap', { zoomControl: true, attributionControl: false }).setView([22.5, 82.5], 5);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd', maxZoom: 19
    }).addTo(mapState.mainMap);
  }
  // Fetch trips + trucks in parallel
  try {
    const [res, trucks] = await Promise.all([
      api('/api/analytics/trip-profitability?page=1&limit=500'),
      api('/api/trucks')
    ]);
    mapState.allTrips = res.data || [];
    // Update stat chips
    const total = mapState.allTrips.length;
    const completed = mapState.allTrips.filter(t => (t.status||'completed').toLowerCase() === 'completed').length;
    const pending = mapState.allTrips.filter(t => (t.status||'').toLowerCase() === 'pending').length;
    const ongoing = mapState.allTrips.filter(t => (t.status||'').toLowerCase() === 'ongoing').length;
    document.getElementById('mapStatTotal').textContent = total;
    document.getElementById('mapStatCompleted').textContent = completed;
    document.getElementById('mapStatPending').textContent = pending;
    const ongoingEl = document.getElementById('mapStatOngoing');
    if (ongoingEl) ongoingEl.textContent = ongoing;
    // Populate truck filter
    const truckSel = document.getElementById('mapFilterTruck');
    const truckNos = [...new Set(mapState.allTrips.map(t => t.truck_no).filter(Boolean))];
    truckSel.innerHTML = '<option value="">All Trucks</option>' + truckNos.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
    await renderMapRoutes();
    // Draw live GPS markers for trucks that have a reported location
    renderLiveGpsMarkers(trucks);
  } catch (e) {
    showToast('Failed to load trip data for map', 'error');
  }
}

function setMapStatusFilter(status) {
  mapState.statusFilter = status;
  document.querySelectorAll('.map-pill').forEach(b => b.classList.remove('active'));
  const btnMap = { all: 'mapFilterAll', pending: 'mapFilterPending', ongoing: 'mapFilterOngoing', completed: 'mapFilterCompleted' };
  const btn = document.getElementById(btnMap[status]);
  if (btn) btn.classList.add('active');
  renderMapRoutes();
}

// Track polylines per trip for hover/click
const mapRouteLayers = {};

async function renderMapRoutes() {
  if (!mapState.mainMap) return;
  const truckFilter = (document.getElementById('mapFilterTruck') || {}).value || '';
  let trips = mapState.allTrips;
  if (mapState.statusFilter !== 'all') trips = trips.filter(t => (t.status || 'completed').toLowerCase() === mapState.statusFilter);
  if (truckFilter) trips = trips.filter(t => t.truck_no === truckFilter);

  const countEl = document.getElementById('mapRouteCount');
  if (countEl) countEl.textContent = `${trips.length} trip${trips.length !== 1 ? 's' : ''}`;

  // Build trip card list in sidebar
  const listEl = document.getElementById('mapTripList');
  if (listEl) {
    if (!trips.length) {
      listEl.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--text-muted);"><i class="fa-solid fa-truck" style="font-size:2rem;opacity:0.3;display:block;margin-bottom:0.5rem;"></i>No trips match filters</div>`;
    } else {
      listEl.innerHTML = trips.map((t, i) => {
        const st = (t.status || 'completed').toLowerCase();
        const colMap = { ongoing: '#4285F4', pending: '#FBBC04', completed: '#34A853' };
        const col = colMap[st] || '#34A853';
        const profit = t.net_profit >= 0
          ? `<span style="color:#34A853;">+${fmtCurrency(t.net_profit)}</span>`
          : `<span style="color:#EA4335;">${fmtCurrency(t.net_profit)}</span>`;
        return `<div class="map-trip-card" id="tripCard-${t.trip_id}" onclick="focusTripRoute(${t.trip_id})">
          <div class="trip-card-color-bar" style="background:${col};"></div>
          <div class="trip-card-body">
            <div class="trip-card-route">
              <span class="trip-city-from">${esc(`Trip Bill ${t.trip_id}`)}</span>
            </div>
            <div class="trip-card-meta">
              <span><i class="fa-solid fa-truck" style="color:${col};"></i> ${esc(t.truck_no || '—')}</span>
              <span><i class="fa-regular fa-calendar"></i> ${fmtDate(t.trip_date)}</span>
            </div>
            <div class="trip-card-footer">
              <span class="trip-card-status" style="background:${col}22;color:${col};border-color:${col}44;">${st}</span>
              <span class="trip-card-profit">${profit}</span>
            </div>
          </div>
        </div>`;
      }).join('');
    }
  }

  return;

  // Draw routes on map
  for (const trip of trips) {
    if (!trip.from_city || !trip.to_city) continue;
    const fromCoords = await geocodeCity(trip.from_city);
    await new Promise(r => setTimeout(r, 150));
    const toCoords = await geocodeCity(trip.to_city);
    if (!fromCoords || !toCoords) continue;

    const color = routeColor(trip.status || 'completed');
    const routeLatlngs = await getRoute(fromCoords, toCoords);

    // Google Maps double-layer style
    const borderLine = L.polyline(routeLatlngs, { color: '#ffffff', weight: 9, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }).addTo(mapState.mainMap);
    const colorLine = L.polyline(routeLatlngs, { color, weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round' }).addTo(mapState.mainMap);

    // Hover to highlight
    [borderLine, colorLine].forEach(line => {
      line.on('mouseover', () => { colorLine.setStyle({ weight: 8 }); borderLine.setStyle({ weight: 13 }); });
      line.on('mouseout', () => { colorLine.setStyle({ weight: 5 }); borderLine.setStyle({ weight: 9 }); });
      line.on('click', () => focusTripRoute(trip.trip_id));
    });

    // Markers
    const fromIcon = L.divIcon({ className: '', html: `<div class="map-marker" style="background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);"><i class="fa-solid fa-circle-dot"></i></div>`, iconSize: [26, 26], iconAnchor: [13, 13] });
    const toIcon = L.divIcon({ className: '', html: `<div class="gmap-dest-pin" style="background:${color};"><i class="fa-solid fa-location-dot"></i></div>`, iconSize: [32, 40], iconAnchor: [16, 40] });

    const popupContent = `
      <div style="font-family:'Inter',sans-serif;min-width:160px;">
        <div style="font-weight:700;font-size:1rem;margin-bottom:0.4rem;">${trip.from_city && trip.to_city ? `?? ${esc(trip.from_city)} ? ?? ${esc(trip.to_city)}` : `Trip #${trip.trip_id}`}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.25rem 0.75rem;font-size:0.82rem;">
          <span style="color:#888;">Truck</span><span>${esc(trip.truck_no||'—')}</span>
          <span style="color:#888;">Driver</span><span>${esc(trip.driver_name||'—')}</span>
          <span style="color:#888;">Date</span><span>${fmtDate(trip.trip_date)}</span>
          <span style="color:#888;">Status</span><span style="color:${color};font-weight:600;">${(trip.status||'completed')}</span>
          <span style="color:#888;">Profit</span><span style="font-weight:700;color:${trip.net_profit>=0?'#34A853':'#EA4335'}">${fmtCurrency(trip.net_profit)}</span>
        </div>
      </div>`;

    const fromM = L.marker(fromCoords, { icon: fromIcon }).bindPopup(popupContent).addTo(mapState.mainMap);
    const toM = L.marker(toCoords, { icon: toIcon }).bindPopup(popupContent).addTo(mapState.mainMap);

    mapRouteLayers[trip.trip_id] = [borderLine, colorLine, fromM, toM];
    // Store bounds for focus
    mapRouteLayers[trip.trip_id].bounds = L.latLngBounds(routeLatlngs);
  }
}

// Focus a specific trip route — called from sidebar card or route click
function focusTripRoute(tripId) {
  // Highlight card
  document.querySelectorAll('.map-trip-card').forEach(c => c.classList.remove('map-trip-card-active'));
  const card = document.getElementById(`tripCard-${tripId}`);
  if (card) { card.classList.add('map-trip-card-active'); card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
  const trip = mapState.allTrips.find((row) => row.trip_id === tripId);
  if (!trip || !mapState.mainMap) return;
  const gpsMarker = trip.truck_id ? mapState.gpsMarkers[trip.truck_id] : null;
  if (gpsMarker && gpsMarker.getLatLng) {
    mapState.mainMap.flyTo(gpsMarker.getLatLng(), Math.max(mapState.mainMap.getZoom(), 10), { duration: 0.8 });
    setTimeout(() => gpsMarker.openPopup(), 900);
  }
}

// Toggle the floating trip panel open/closed
function toggleMapPanel() {
  const panel = document.getElementById('mapFloatPanel');
  const chevron = document.getElementById('mapPanelChevron');
  if (!panel) return;
  const isCollapsed = panel.classList.toggle('collapsed');
  if (chevron) chevron.className = isCollapsed ? 'fa-solid fa-chevron-right' : 'fa-solid fa-chevron-left';
  setTimeout(() => mapState.mainMap && mapState.mainMap.invalidateSize(), 320);
}

// Show a single trip's route in the preview modal
let _previewMapLayer = null;
async function showTripOnMap(tripId, fromCity, toCity, truckNo, driverName, tripDate) {
  document.getElementById('tripMapModalTitle').textContent = `${fromCity} ? ${toCity}`;
  document.getElementById('tripMapModalInfo').innerHTML =
    `<i class="fa-solid fa-truck"></i> <strong>${truckNo || '—'}</strong> &nbsp;|&nbsp; <i class="fa-solid fa-id-card"></i> ${driverName || '—'} &nbsp;|&nbsp; <i class="fa-regular fa-calendar"></i> ${tripDate}`;
  openModal('tripMapModal');

  // Small delay to let modal render before initializing map
  await new Promise(r => setTimeout(r, 80));

  if (mapState.previewMap) {
    mapState.previewMap.eachLayer(l => { if (!(l instanceof L.TileLayer)) mapState.previewMap.removeLayer(l); });
  } else {
    mapState.previewMap = L.map('tripPreviewMap').setView([22.5, 82.5], 5);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd', maxZoom: 19
    }).addTo(mapState.previewMap);
  }
  mapState.previewMap.invalidateSize();

  const [fromCoords, toCoords] = await Promise.all([geocodeCity(fromCity), geocodeCity(toCity)]);
  if (!fromCoords || !toCoords) {
    showToast(`Could not geocode "${fromCity}" or "${toCity}"`, 'error');
    return;
  }
  // Fetch real road route
  const routeLatlngs = await getRoute(fromCoords, toCoords);
  // Google Maps-style double-layer: white border + blue route
  L.polyline(routeLatlngs, { color: '#ffffff', weight: 11, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(mapState.previewMap);
  L.polyline(routeLatlngs, { color: '#4285F4', weight: 6, opacity: 1, lineCap: 'round', lineJoin: 'round' }).addTo(mapState.previewMap);
  const fromIcon = L.divIcon({ className: '', html: `<div class="gmap-start-pin"><i class="fa-solid fa-circle"></i></div>`, iconSize: [20, 20], iconAnchor: [10, 10] });
  const toIcon = L.divIcon({ className: '', html: `<div class="gmap-dest-pin" style="background:#EA4335;"><i class="fa-solid fa-location-dot"></i></div>`, iconSize: [32, 40], iconAnchor: [16, 40] });
  L.marker(fromCoords, { icon: fromIcon }).bindPopup(`<b>?? ${fromCity}</b><br><small style="color:#666;">Origin</small>`).addTo(mapState.previewMap).openPopup();
  L.marker(toCoords, { icon: toIcon }).bindPopup(`<b>?? ${toCity}</b><br><small style="color:#666;">Destination</small>`).addTo(mapState.previewMap);
  mapState.previewMap.fitBounds(routeLatlngs, { padding: [50, 50] });
}

// Dashboard mini map — shows ongoing trips only
async function renderDashboardMap() {
  const container = document.getElementById('dashboardMap');
  if (!container) return;
  if (!mapState.dashMap) {
    mapState.dashMap = L.map('dashboardMap', { zoomControl: false, scrollWheelZoom: false }).setView([22.5, 82.5], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(mapState.dashMap);
  }
  mapState.dashMap.eachLayer(l => { if (!(l instanceof L.TileLayer)) mapState.dashMap.removeLayer(l); });
  try {
    const res = await api('/api/analytics/trip-profitability?page=1&limit=100');
    const ongoing = (res.data || []).filter(t => (t.status || '').toLowerCase() === 'ongoing' || true).slice(0, 20);
    for (const trip of ongoing.slice(0, 10)) {
      if (!trip.from_city || !trip.to_city) continue;
      const fromC = await geocodeCity(trip.from_city);
      await new Promise(r => setTimeout(r, 120));
      const toC = await geocodeCity(trip.to_city);
      if (!fromC || !toC) continue;
      L.polyline([fromC, toC], { color: routeColor(trip.status || 'completed'), weight: 2.5, opacity: 0.7 }).addTo(mapState.dashMap);
    }
  } catch (e) {}
}

/* ------------------------------------------
   GPS LIVE TRACKING
   ------------------------------------------ */

// Build popup HTML for a GPS truck marker
// Reverse geocode lat/lng ? human-readable place name (with cache)
const _reverseCache = {};
async function reverseGeocode(lat, lng) {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (_reverseCache[key]) return _reverseCache[key];
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, { headers: { 'Accept-Language': 'en' } });
    const data = await res.json();
    const a = data.address || {};
    const place = [a.city || a.town || a.village || a.county || a.state_district, a.state].filter(Boolean).join(', ');
    _reverseCache[key] = place || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    return _reverseCache[key];
  } catch(e) {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

function buildGpsPopup(truck, placeName) {
  const ts = truck.location_updated_at
    ? new Date(truck.location_updated_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : 'Just now';
  const location = placeName || '?? Locating…';
  return `
    <div style="font-family:'Inter',sans-serif;min-width:160px;padding:4px 0;">
      <div style="font-weight:700;font-size:0.95rem;margin-bottom:6px;">
        ?? ${esc(truck.truck_no || 'Truck')}
      </div>
      <div style="display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:0.8rem;">
        <span style="color:#888;">Driver</span><span>${esc(truck.driver_name || '—')}</span>
        <span style="color:#888;">Status</span><span style="color:#10b981;font-weight:600;">? Live GPS</span>
        <span style="color:#888;">Location</span><span style="font-weight:500;">${location}</span>
        <span style="color:#888;">Updated</span><span>${ts}</span>
      </div>
    </div>`;
}

// Create a pulsing GPS truck Leaflet marker, async-fetches place name for popup
function createGpsMarker(truck) {
  const icon = L.divIcon({
    className: '',
    html: `<div class="gps-marker-wrap">
             <div class="gps-pulse-ring"></div>
             <div class="gps-truck-dot"><i class="fa-solid fa-truck"></i></div>
           </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });
  const marker = L.marker([parseFloat(truck.latitude), parseFloat(truck.longitude)], { icon, zIndexOffset: 1000 })
    .bindPopup(buildGpsPopup(truck, null));  // show 'Locating…' first
  // Fetch place name and update popup once available
  reverseGeocode(parseFloat(truck.latitude), parseFloat(truck.longitude)).then(place => {
    marker.setPopupContent(buildGpsPopup(truck, place));
  });
  return marker;
}

// Draw/refresh pulsing GPS markers for all trucks that have lat/lng in DB
function renderLiveGpsMarkers(trucks) {
  if (!mapState.mainMap) return;
  if (!mapState.gpsMarkers) mapState.gpsMarkers = {};
  // Remove stale markers
  Object.values(mapState.gpsMarkers).forEach(m => mapState.mainMap.removeLayer(m));
  mapState.gpsMarkers = {};
  const liveTrucks = trucks.filter(t => t.latitude && t.longitude);
  liveTrucks.forEach(truck => {
    mapState.gpsMarkers[truck.truck_id] = createGpsMarker(truck).addTo(mapState.mainMap);
  });
}

/* -- Share My Location (Driver GPS) -- */
let _watchId = null;        // browser watchPosition ID
let _sharingTruckId = null; // which truck this driver is sharing for

async function promptShareGps() {
  if (_watchId !== null) { stopSharingLocation(); return; }

  const user = appState.currentUser;
  const role = (user && user.role) || 'admin';

  // If the logged-in user is a driver, find their assigned truck automatically
  if (role === 'driver' && user && user.driver_id) {
    const trucks = await api('/api/trucks').catch(() => []);
    const myTruck = trucks.find(t => String(t.driver_id) === String(user.driver_id));
    if (myTruck) {
      showToast(`?? Sharing GPS for ${myTruck.truck_no}…`, 'info');
      shareMyLocation(myTruck.truck_id);
      return;
    } else {
      showToast('No truck is assigned to your account. Ask admin to assign one.', 'error');
      return;
    }
  }

  // Admin / Manager: show truck picker
  const trucks = await api('/api/trucks').catch(() => []);
  if (!trucks.length) { showToast('No trucks found', 'error'); return; }
  const opts = trucks.map(t => `<option value="${t.truck_id}">${esc(t.truck_no)}${t.driver_name ? ' — ' + esc(t.driver_name) : ''}</option>`).join('');
  const wrap = document.createElement('div');
  wrap.id = 'gpsTruckPickerOverlay';
  wrap.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9000;backdrop-filter:blur(4px)';
  wrap.innerHTML = `
    <div style="background:var(--bg-panel);border:1px solid var(--border-color);border-radius:16px;padding:2rem;min-width:300px;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
      <h3 style="margin-bottom:1rem;font-size:1.1rem;display:flex;align-items:center;gap:0.5rem;"><i class="fa-solid fa-satellite-dish" style="color:var(--primary);"></i> Share GPS Location</h3>
      <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:1.25rem;">Your device's GPS will be broadcast live to the map as the selected truck's position.</p>
      <label style="font-size:0.78rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;display:block;margin-bottom:0.4rem;">Select Truck</label>
      <select id="gpsTruckSel" style="width:100%;padding:0.6rem 0.85rem;background:var(--bg-dark);border:1px solid var(--border-color);border-radius:8px;color:var(--text-main);font-size:0.9rem;margin-bottom:1.25rem;">${opts}</select>
      <div style="display:flex;gap:0.75rem;">
        <button onclick="startSharingFromPicker()" class="btn-primary" style="flex:1;padding:0.7rem;"><i class="fa-solid fa-location-arrow"></i> Start Sharing</button>
        <button onclick="document.getElementById('gpsTruckPickerOverlay').remove()" class="btn-secondary" style="flex:1;padding:0.7rem;">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
}

function startSharingFromPicker() {
  const sel = document.getElementById('gpsTruckSel');
  if (!sel) return;
  _sharingTruckId = sel.value;
  document.getElementById('gpsTruckPickerOverlay')?.remove();
  shareMyLocation(_sharingTruckId);
}

/**
 * Service: Enables live GPS broadcasting for a specific truck.
 * Utilizes the browser's Geolocation API to push updates via the high-frequency location tunnel.
 * @param {number} truckId - Database ID of the truck to track.
 */
function shareMyLocation(truckId) {
  if (!navigator.geolocation) { showToast('GPS not supported on this device', 'error'); return; }
  showToast('?? Starting GPS sharing…', 'info');
  // Show floating badge
  const badge = document.createElement('div');
  badge.id = 'gpsSharingBadge';
  badge.className = 'gps-sharing-badge';
  badge.innerHTML = `<span class="gps-badge-dot"></span><span>Sharing GPS Live</span><button onclick="stopSharingLocation()" title="Stop sharing"><i class="fa-solid fa-xmark"></i></button>`;
  document.body.appendChild(badge);
  // Update share button appearance
  const btn = document.getElementById('mapGpsShareBtn');
  if (btn) { btn.classList.add('gps-btn-active'); btn.innerHTML = '<i class="fa-solid fa-satellite-dish"></i> Stop Sharing'; }

  let _firstFix = true;
  _watchId = navigator.geolocation.watchPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;
      const latlng = [latitude, longitude];

      // 1. Instantly update/create the marker client-side (don't wait for socket echo)
      if (mapState.mainMap) {
        const m = mapState.gpsMarkers[truckId];
        if (m) {
          m.setLatLng(latlng);
        } else {
          // Build a minimal truck object for the marker
          const fakeTruck = { truck_id: truckId, truck_no: '...', driver_name: '—', latitude, longitude, location_updated_at: new Date().toISOString() };
          // Try to get real truck info from cached trucks
          try {
            const trucks = await api('/api/trucks').catch(() => []);
            const found = trucks.find(t => String(t.truck_id) === String(truckId));
            if (found) { found.latitude = latitude; found.longitude = longitude; found.location_updated_at = new Date().toISOString(); Object.assign(fakeTruck, found); }
          } catch(e) {}
          mapState.gpsMarkers[truckId] = createGpsMarker(fakeTruck).addTo(mapState.mainMap);
          mapState.gpsMarkers[truckId].openPopup();
        }
        // 2. Fly map to location on first fix so user can see their marker
        if (_firstFix) {
          _firstFix = false;
          mapState.mainMap.flyTo(latlng, 13, { duration: 1.5 });
        }
      }

      // 3. Push to server (which broadcasts via Socket.IO to all other tabs/users)
      try {
        await api(`/api/trucks/${truckId}/location`, {
          method: 'PATCH',
          body: JSON.stringify({ latitude, longitude })
        });
      } catch (e) { /* silently ignore network errors */ }
    },
    (err) => { showToast('GPS error: ' + err.message, 'error'); stopSharingLocation(); },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
  );
}

function stopSharingLocation() {
  if (_watchId !== null) { navigator.geolocation.clearWatch(_watchId); _watchId = null; }
  _sharingTruckId = null;
  document.getElementById('gpsSharingBadge')?.remove();
  const btn = document.getElementById('mapGpsShareBtn');
  if (btn) { btn.classList.remove('gps-btn-active'); btn.innerHTML = '<i class="fa-solid fa-satellite-dish"></i> Share GPS'; }
  showToast('GPS sharing stopped', 'info');
}

/* -- City Autocomplete for Add Trip Form -- */
let _acTimer = null;
async function cityAutocomplete(inputId, listId) {
  const input = document.getElementById(inputId);
  const list = document.getElementById(listId);
  if (!input || !list) return;
  const q = input.value.trim();
  if (q.length < 2) { list.style.display = 'none'; return; }
  clearTimeout(_acTimer);
  _acTimer = setTimeout(async () => {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + ', India')}&format=json&limit=5&countrycodes=in&featuretype=city`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      const data = await res.json();
      if (!data || !data.length) { list.style.display = 'none'; return; }
      list.innerHTML = data.map(d => {
        const name = d.display_name.split(',')[0];
        return `<div class="ac-item" onclick="selectCity('${inputId}','${listId}','${name.replace(/'/g, '')}')">?? ${name}</div>`;
      }).join('');
      list.style.display = 'block';
    } catch (e) { list.style.display = 'none'; }
  }, 300);
}

function selectCity(inputId, listId, name) {
  document.getElementById(inputId).value = name;
  document.getElementById(listId).style.display = 'none';
}

// Close dropdowns on outside click
document.addEventListener('click', e => {
  ['acFromList', 'acToList'].forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.contains(e.target)) el.style.display = 'none';
  });
  
  const settingsMenu = document.getElementById('settingsMenu');
  if (settingsMenu && !settingsMenu.contains(e.target)) settingsMenu.classList.remove('show');
  
  const notifMenu = document.getElementById('notifMenu');
  if (notifMenu && !notifMenu.contains(e.target)) notifMenu.classList.remove('show');
});

/* -- Mobile Sidebar Toggle -- */
function toggleSidebar() {
  const sidebar = document.getElementById('mainSidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (!sidebar) return;

  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  if (isMobile) {
    const isOpening = !sidebar.classList.contains('open');
    sidebar.classList.toggle('open', isOpening);
    if (overlay) {
      overlay.classList.toggle('active', isOpening);
      overlay.classList.toggle('open', isOpening);
    }
    return;
  }

  sidebar.classList.toggle('collapsed');
}

/* -- PWA Installation -- */
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const installBtn = document.getElementById('installAppBtn');
  if (installBtn) {
    installBtn.style.display = 'block';
  }
});

function triggerInstall() {
  const installBtn = document.getElementById('installAppBtn');
  if (installBtn) installBtn.style.display = 'none';
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      deferredPrompt = null;
    });
  }
}

/* ==========================================================================
   Daily Operational Expenses
   ========================================================================== */

/**
 * Service: Manages general cash flow and petty expenses categorization.
 */
async function loadExpenses() {
  switchView('expenses');
  const filterDateInput = document.getElementById('expenseFilterDate');
  if (filterDateInput && !filterDateInput.value) {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    filterDateInput.value = `${d.getFullYear()}-${mm}-${dd}`;
  }
  if (filterDateInput) updateDateDisplay(filterDateInput.value);
  const activeTypeFilter = window._expTypeFilter || 'all';
  document.querySelectorAll('#expenseTypePills .type-pill').forEach((pill) => {
    pill.classList.toggle('active-pill', pill.dataset.filter === activeTypeFilter);
  });
  fetchExpenses();
}

function setExpenseTypeFilter(type, btn) {
  window._expTypeFilter = type || 'all';
  document.querySelectorAll('#expenseTypePills .type-pill').forEach((pill) => {
    pill.classList.toggle('active-pill', pill === btn);
  });
  fetchExpenses();
}

async function fetchExpenses() {
  const tbody = document.getElementById('expensesTableBody');
  try {
    const filterInput = document.getElementById('expenseFilterDate');
    const filterDate = filterInput ? filterInput.value : '';
    
    // Server-side filtering is much faster for large datasets
    const res = await api(`/api/expenses${filterDate ? `?date=${filterDate}` : ''}`);
    let data = res.data || [];

    // Filter by type (this remains client-side as it's a minor UI toggle)
    const typeFilter = window._expTypeFilter || 'all';
    if (typeFilter !== 'all') {
      data = data.filter(item => item.type === typeFilter);
    }

    if (!data.length) {
      tbody.innerHTML = emptyRow(6, filterDate ? `No expenses found for ${filterDate}.` : 'No expenses found.');
      document.getElementById('expStatReceived').innerHTML = '&#8377;0';
      document.getElementById('expStatGiven').innerHTML = '&#8377;0';
      document.getElementById('expStatNet').innerHTML = '&#8377;0';
      let owedElem = document.getElementById('expStatOwed');
      if (owedElem) owedElem.innerHTML = '&#8377;0';
      let advElem = document.getElementById('expStatAdvance');
      if (advElem) advElem.innerHTML = '&#8377;0';
      return;
    }

    let totalReceived = 0, totalGiven = 0, totalOwed = 0, totalAdvance = 0;

    tbody.innerHTML = data.map(item => {
      const amt = parseFloat(item.amount) || 0;
      const pendingAmt = parseFloat(item.pending_amount) || 0;
      const type = item.type;
      
      // Calculate cash-flow totals
      if (type === 'Received' && !item.exclude_from_cash_totals) totalReceived += amt;
      else if (type === 'Owed') totalOwed += pendingAmt; // Note: For statistics, we care about the pending part
      else if (type === 'Advance') totalAdvance += amt;
      else if (type === 'Given') totalGiven += amt;

      let sourceBadge = '';
      if (item.source === 'trip') sourceBadge = '<span class="badge hide-mobile" style="background:#8b5cf6;color:white;font-size:0.7rem;padding:2px 6px;border-radius:4px;">Trip</span>';
      else if (item.source === 'customer') sourceBadge = '<span class="badge hide-mobile" style="background:#10b981;color:white;font-size:0.7rem;padding:2px 6px;border-radius:4px;">Customer</span>';
      else if (item.source === 'fuel') sourceBadge = '<span class="badge hide-mobile" style="background:#f97316;color:white;font-size:0.7rem;padding:2px 6px;border-radius:4px;">Fuel</span>';
      else if (item.source === 'maintenance') sourceBadge = '<span class="badge hide-mobile" style="background:#eab308;color:white;font-size:0.7rem;padding:2px 6px;border-radius:4px;">Maint.</span>';
      else sourceBadge = '<span class="badge hide-mobile" style="background:#64748b;color:white;font-size:0.7rem;padding:2px 6px;border-radius:4px;">Manual</span>';

      let actions = '';
      if (item.source === 'manual') {
        actions = `<button class="btn-icon" style="color:var(--danger);" onclick="deleteExpense(${item.id})"><i class="fa-solid fa-trash"></i></button>`;
      } else if (item.source === 'trip' && type === 'Owed') {
        actions = `<button class="btn-primary" style="padding:0.25rem 0.75rem; font-size:0.75rem; border-radius:20px; background:linear-gradient(135deg,#10b981,#059669); border:none; box-shadow:0 3px 8px rgba(16,185,129,0.3); cursor:pointer; display:inline-flex; align-items:center; gap:4px;" onclick="receiveTripPayment(${item.id}, '${esc(item.person_name)}', ${pendingAmt})"><i class="fa-solid fa-money-bill-transfer"></i> Receive ₹${fmtCurrency(pendingAmt).replace('₹','')}</button>`;
      } else if (item.source === 'trip' && type === 'Settled') {
        actions = `<span style="font-size:0.85rem;color:#10b981;font-weight:600;"><i class="fa-solid fa-circle-check"></i> Settled</span>`;
      } else {
        actions = `<span style="font-size:0.8rem;color:var(--text-muted);"><i class="fa-solid fa-lock"></i> Auto</span>`;
      }

      let amountColor = 'var(--text-primary)';
      if (type === 'Received') amountColor = 'var(--success)';
      else if (type === 'Owed') amountColor = '#a855f7';
      else if (type === 'Settled') amountColor = '#6366f1'; // Indigo for settlement
      else if (type === 'Advance') amountColor = '#fb923c';
      else amountColor = 'var(--danger)';

      const displayType = type === 'Settled' ? '<i class="fa-solid fa-handshake" style="font-size:0.8rem;opacity:0.75;"></i> Settled' : type;
      
      // If trip is partially settled, show the balance note
      let balanceNote = '';
      if (item.source === 'trip' && type === 'Owed' && pendingAmt < amt) {
        balanceNote = `<div style="font-size:0.7rem; color:#8b5cf6; margin-top:0.2rem;">Bal: ${fmtCurrency(pendingAmt)}</div>`;
      }

      return `<tr>
        <td>${fmtDate(item.date)}</td>
        <td>
          <div style="font-weight:600;margin-bottom:0.2rem;">${esc(item.person_name)}</div>
          ${sourceBadge}
        </td>
        <td style="font-size:0.85rem; font-weight:500;">${displayType}</td>
        <td style="font-weight:600;">
          <div style="color:${amountColor};">${fmtCurrency(amt)}</div>
          ${balanceNote}
        </td>
        <td><span class="text-muted" style="font-size: 0.9rem;">${esc(item.remarks || '-')}</span></td>
        <td>${actions}</td>
      </tr>`;
    }).join('');

    document.getElementById('expStatReceived').innerHTML = fmtCurrency(totalReceived);
    document.getElementById('expStatGiven').innerHTML = fmtCurrency(totalGiven);
    let owedElem = document.getElementById('expStatOwed');
    if (owedElem) owedElem.innerHTML = fmtCurrency(totalOwed);
    let advElem = document.getElementById('expStatAdvance');
    if (advElem) advElem.innerHTML = fmtCurrency(totalAdvance);
    const net = totalReceived - totalGiven;
    const netColor = net >= 0 ? 'var(--success)' : 'var(--danger)';
    document.getElementById('expStatNet').innerHTML = `<span style="color:${netColor};">${net >= 0 ? '+' : ''}${fmtCurrency(net)}</span>`;

  } catch (err) {
    const msg = err && err.message ? err.message : 'Failed to load expenses';
    tbody.innerHTML = emptyRow(6, esc(msg));
    showToast(msg, 'error');
  }
}

async function submitExpense(e) {
  e.preventDefault();
  const body = {
    date: document.getElementById('expDate').value,
    person_name: document.getElementById('expPerson').value,
    type: document.getElementById('expType').value,
    amount: document.getElementById('expAmount').value,
    remarks: document.getElementById('expRemarks').value,
  };
  
  const btn = e.target.querySelector('button[type="submit"]');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...'; }

  try {
    await api('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    showToast('Expense recorded', 'success');
    cancelForm('expenseForm');
    resetExpenseForm();
    loadExpenses();
  } catch (err) {
    console.error("Expense Submission Error:", err);
    showToast(err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save'; }
  }
}

async function deleteExpense(id) {
  if (!confirm('Are you sure you want to delete this manual expense entry?')) return;
  try {
    await api(`/api/expenses/${id}`, { method: 'DELETE' });
    showToast('Expense deleted', 'success');
    fetchExpenses();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function resetExpenseForm() {
  ['expId', 'expDate', 'expPerson', 'expAmount', 'expRemarks'].forEach(id => {
    if (document.getElementById(id)) document.getElementById(id).value = '';
  });
  if (document.getElementById('expType')) document.getElementById('expType').value = 'Given';
}

function updateDateDisplay(dateStr) {
  const display = document.getElementById('expenseFilterDisplay');
  if (!display) return;
  if (!dateStr) {
    display.textContent = 'All History';
    return;
  }
  
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  
  if (dateStr === today) {
    display.textContent = 'Today';
    return;
  }
  
  const selectedDate = new Date(dateStr);
  if (isNaN(selectedDate.getTime())) {
    display.textContent = dateStr;
    return;
  }
  const options = { day: 'numeric', month: 'short', year: 'numeric' };
  display.textContent = selectedDate.toLocaleDateString('en-GB', options);
}

window.receiveTripPayment = async function(tripId, personName, amount) {
  const inputAmount = prompt(`Trip #${tripId} (${personName})\nRemaining Owed: ₹${amount}\n\nEnter the payment amount you are receiving now:`, amount);
  if (inputAmount === null) return;
  const payAmt = parseFloat(inputAmount);
  if (isNaN(payAmt) || payAmt <= 0) return showToast('Invalid amount', 'error');

  try {
    const btn = event.currentTarget || event.target;
    if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    await api(`/api/trips/${tripId}/payment`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount_received_add: payAmt })
    });
    showToast('Payment partially/fully received!', 'success');
    fetchExpenses();
    if (typeof loadDashboard === 'function') loadDashboard(); // Sync dashboard stats
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.markTripAsPaid = async function(tripId, btn) {
  if (!confirm('Mark this trip freight as RECEIVED? This cannot be undone.')) return;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
  try {
    await api(`/api/expenses/trips/${tripId}/mark-paid`, { method: 'PATCH' });
    showToast('Trip marked as Received!', 'success');
    fetchExpenses();
    if (typeof loadDashboard === 'function') loadDashboard(); // Sync dashboard stats
  } catch (err) {
    showToast(err.message || 'Failed to update trip.', 'error');
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Mark Paid';
  }
};

window.openTripReceiveModal = function(tripId, personName, amount) {
  const amountInput = document.getElementById('tripReceiveAmount');
  document.getElementById('tripReceiveTripId').value = tripId;
  document.getElementById('tripReceiveMaxAmount').value = Number(amount || 0);
  document.getElementById('tripReceiveTripLabel').textContent = `#${tripId}`;
  document.getElementById('tripReceiveCustomerLabel').textContent = personName || '-';
  document.getElementById('tripReceiveRemainingLabel').textContent = fmtCurrency(amount || 0);
  amountInput.value = Number(amount || 0).toFixed(2);
  openModal('tripReceiveModal');
  setTimeout(() => {
    amountInput.focus();
    amountInput.select();
  }, 30);
};

window.closeTripReceiveModal = function() {
  document.getElementById('tripReceiveTripId').value = '';
  document.getElementById('tripReceiveMaxAmount').value = '';
  document.getElementById('tripReceiveAmount').value = '';
  closeModal('tripReceiveModal');
};

window.submitTripReceivePayment = async function(e) {
  e.preventDefault();
  const tripId = Number(document.getElementById('tripReceiveTripId').value);
  const maxAmount = Number(document.getElementById('tripReceiveMaxAmount').value || 0);
  const payAmt = Number(document.getElementById('tripReceiveAmount').value);
  if (!tripId) return showToast('Trip details are missing', 'error');
  if (!Number.isFinite(payAmt) || payAmt <= 0) return showToast('Enter a valid amount', 'error');
  if (maxAmount > 0 && payAmt - maxAmount > 0.0001) return showToast(`Amount cannot exceed ${fmtCurrency(maxAmount)}`, 'error');

  const btn = document.getElementById('tripReceiveSubmitBtn');
  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Recording...';
  }

  try {
    await api(`/api/trips/${tripId}/payment`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount_received_add: payAmt })
    });
    closeTripReceiveModal();
    showToast('Payment recorded successfully', 'success');
    fetchExpenses();
    if (typeof loadDashboard === 'function') loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
};

window.receiveTripPayment = function(tripId, personName, amount) {
  openTripReceiveModal(tripId, personName, amount);
};