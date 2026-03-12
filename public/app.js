const API = "";

const appState = {
  socket: null,
  currentUser: null,
  trips: { page: 1, limit: 10, totalPages: 1, rows: [] },
  fuel: { page: 1, limit: 10, totalPages: 1 },
  maintenance: { page: 1, limit: 10, totalPages: 1 }
};

/* ── Modals ── */
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function switchModal(from, to) { closeModal(from); openModal(to); }

/* ── Theme Toggle ── */
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
})();


/* ── Toast ── */
function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast show ${type}`;
  t.innerText = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.className = `toast ${type}`; setTimeout(() => t.remove(), 300); }, 3000);
}

/* ── Loading / Error / Empty helpers ── */
function showLoading(c, msg = 'Loading...') { if (!c) return; c.style.position = 'relative'; const d = document.createElement('div'); d.className = 'loading'; d.innerText = msg; c.appendChild(d); }
function hideLoading(c) { if (!c) return; c.querySelectorAll('.loading').forEach(e => e.remove()); }
function showError(c, m) { const el = typeof c === 'string' ? document.getElementById(c) : c; if (el) el.innerHTML = `<div class='error'>⚠ ${m}</div>`; }
function emptyRow(cols, msg) { return `<tr><td colspan="${cols}" class="empty">${msg}</td></tr>`; }
function errorRow(cols) { return `<tr><td colspan="${cols}" class="error">⚠ Failed to load data</td></tr>`; }

/* ── Form toggle/cancel ── */
function toggleForm(id) { const el = document.getElementById(id); el.style.display = el.style.display === 'none' ? 'block' : 'none'; }
function cancelForm(id) { document.getElementById(id).style.display = 'none'; }
function esc(v) { return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmtCurrency(v) { return `₹${Number(v||0).toLocaleString('en-IN')}`; }
function fmtDate(v) { return v ? String(v).split('T')[0] : '—'; }

/* ── API wrapper ── */
async function api(path, opts = {}) {
  const h = { ...opts.headers };
  if (!h['Content-Type']) h['Content-Type'] = 'application/json';
  const tk = localStorage.getItem('tbToken');
  if (tk) h.Authorization = `Bearer ${tk}`;
  const r = await fetch(API + path, { ...opts, headers: h });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || d.message || 'Request failed');
  return d;
}

/* ── Set select options helper ── */
function setSelectOpts(selId, items) {
  const sel = document.getElementById(selId);
  const cur = sel.value;
  sel.innerHTML = '<option value="">-- None --</option>' + items.map(i => `<option value="${i.value}">${esc(i.label)}</option>`).join('');
  sel.value = cur;
}

/* ── Auth ── */
async function handleLogin(e) {
  e.preventDefault();
  try {
    const d = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: document.getElementById('loginEmail').value, password: document.getElementById('loginPassword').value }) });
    localStorage.setItem('tbToken', d.token);
    localStorage.setItem('tbUser', JSON.stringify(d.user));
    closeModal('authModal');
    enterDashboard(d.user);
  } catch (err) { showToast(err.message, 'error'); }
}

async function handleRegister(e) {
  e.preventDefault();
  try {
    const d = await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ full_name: document.getElementById('regName').value, email: document.getElementById('regEmail').value, password: document.getElementById('regPassword').value }) });
    localStorage.setItem('tbToken', d.token);
    localStorage.setItem('tbUser', JSON.stringify(d.user));
    closeModal('registerModal');
    enterDashboard(d.user);
  } catch (err) { showToast(err.message, 'error'); }
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
  document.getElementById('dashboardPage').style.display = 'flex';
  const displayName = user.full_name || user.email.split('@')[0];
  document.getElementById('username').textContent = displayName;
  // Sync sidebar user
  const sbUser = document.getElementById('sidebarUsername');
  const sbAvatar = document.getElementById('sidebarAvatar');
  if (sbUser) sbUser.textContent = displayName;
  if (sbAvatar) sbAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=3b82f6&color=fff`;
  document.getElementById('userAvatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=3b82f6&color=fff`;
  initRealtime();
  loadDashboard();
}

/* ── Settings Dropdown ── */
function toggleSettingsMenu(e) {
  e.stopPropagation();
  const menu = document.getElementById('settingsMenu');
  menu.classList.toggle('show');
}

// Global click listener to close dropdowns
window.addEventListener('click', (e) => {
  const menu = document.getElementById('settingsMenu');
  if (menu && menu.classList.contains('show')) {
    if (!e.target.closest('.settings-dropdown')) {
      menu.classList.remove('show');
    }
  }
});

/* ── Navigation ── */
function switchView(name) {
  document.querySelectorAll('.view-section').forEach(el => el.style.display = 'none');
  document.getElementById(`view-${name}`).style.display = 'block';
  document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
  document.getElementById(`menu-${name}`).classList.add('active');
  const titles = { dashboard: 'Dashboard', trucks: 'Fleet Directory', drivers: 'Drivers', customers: 'Customers', trips: 'Trips', fuel: 'Fuel Records', reports: 'Reports', performance: 'Driver Performance', maintenance: 'Maintenance Log', efficiency: 'Fuel Efficiency' };
  document.getElementById('pageTitle').textContent = titles[name];
  // Close mobile sidebar on navigate
  if (window.innerWidth <= 768) {
    document.getElementById('mainSidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');
  }
}

/* ── Sidebar Toggle ── */
function toggleSidebar() {
  const sidebar = document.getElementById('mainSidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (window.innerWidth <= 768) {
    // Mobile: slide in/out
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
  } else {
    // Desktop: collapse/expand
    sidebar.classList.toggle('collapsed');
  }
}

/* ══════════════════════════════════════════
   DASHBOARD
   ══════════════════════════════════════════ */
let revenueChart = null, fuelTrendChart = null;

async function loadDashboard() {
  switchView('dashboard');
  const c = document.getElementById('view-dashboard');
  showLoading(c, 'Loading dashboard metrics...');
  try {
    const [m, a, trucks, forecast] = await Promise.all([
      api('/api/dashboard/metrics'), 
      api('/api/dashboard/analytics'), 
      api('/api/trucks'),
      api('/api/dashboard/maintenance-forecast')
    ]);
    document.getElementById('totalTrucks').textContent = m.totalTrucks || 0;
    document.getElementById('activeTrucksVal').textContent = m.activeTrucks || 0;
    document.getElementById('monthlyRevenueVal').textContent = fmtCurrency(m.monthlyRevenue);
    document.getElementById('fuelExpensesVal').textContent = fmtCurrency(m.fuelExpenses);
    document.getElementById('profitVal').textContent = fmtCurrency(m.profit);
    renderCharts(a.monthlyRevenue || [], a.monthlyFuelCost || []);
    
    // Maintenance Alerts & Forecast
    const alertsBox = document.getElementById('dashboardAlerts');
    let alertHtml = '';
    
    // Traditional Date-based Due Alerts
    const dueTrucks = trucks.filter(t => t.maintenance && t.maintenance.toLowerCase() !== 'not required' && t.maintenance.toLowerCase() !== 'none' && t.maintenance.toLowerCase() !== '');
    if (dueTrucks.length > 0) {
      alertHtml += dueTrucks.map(t => `<div class="alert-warning"><i class="fa-solid fa-triangle-exclamation"></i> Truck <strong>${esc(t.truck_no)}</strong> marked for manual service: ${esc(t.maintenance)}</div>`).join('');
    }
    
    // Usage-based Forecast Alerts (e.g. threshold = 15 trips)
    const thresholdTrips = 15;
    const dueSoon = forecast.filter(f => f.trips_since_service >= thresholdTrips);
    if (dueSoon.length > 0) {
      alertHtml += dueSoon.map(f => `<div class="alert-warning" style="color:var(--danger); border-color:var(--danger); background:rgba(239,68,68,0.1);"><i class="fa-solid fa-wrench"></i> Truck <strong>${esc(f.truck_no)}</strong> requires maintenance! (${f.trips_since_service} trips since last service)</div>`).join('');
    }

    if (alertHtml) {
      alertsBox.innerHTML = alertHtml;
      alertsBox.style.display = 'block';
    } else {
      alertsBox.style.display = 'none';
      alertsBox.innerHTML = '';
    }
    
    // Render Maintenance Forecast Widget
    const forecastTbody = document.getElementById('forecastTableBody');
    if (forecastTbody) {
      forecastTbody.innerHTML = forecast.map(f => {
        let badgeClass = 'status-available'; // green
        if (f.trips_since_service >= 15) badgeClass = 'status-inactive'; // red/warning
        else if (f.trips_since_service >= 10) badgeClass = 'status-pending'; // yellow
        return `<tr>
          <td><strong>${esc(f.truck_no)}</strong></td>
          <td>${f.last_service === 'No Record' ? 'Never' : fmtDate(f.last_service)}</td>
          <td>${f.trips_since_service}</td>
          <td><span class="status-badge ${badgeClass}">${f.trips_since_service}/15 Limit</span></td>
        </tr>`;
      }).join('');
    }
  } catch (err) { showError(c, 'Failed to load dashboard'); } finally { hideLoading(c); }
}

function renderCharts(rev, fuel) {
  Chart.defaults.color = '#9ca3af';
  Chart.defaults.font.family = 'Inter';
  if (revenueChart) revenueChart.destroy();
  revenueChart = new Chart(document.getElementById('revenueChart').getContext('2d'), {
    type: 'bar',
    data: { labels: rev.map(d => d.month), datasets: [{ label: 'Revenue (₹)', data: rev.map(d => d.revenue), backgroundColor: '#3b82f6', borderRadius: 4 }] },
    options: { responsive: true, maintainAspectRatio: false }
  });
  if (fuelTrendChart) fuelTrendChart.destroy();
  fuelTrendChart = new Chart(document.getElementById('fuelTrendChart').getContext('2d'), {
    type: 'line',
    data: { labels: fuel.map(d => d.month), datasets: [{ label: 'Fuel Cost (₹)', data: fuel.map(d => d.fuelCost), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', fill: true, tension: 0.4 }] },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

/* ══════════════════════════════════════════
   TRUCKS CRUD
   ══════════════════════════════════════════ */
async function loadTrucks() {
  switchView('trucks');
  const tbody = document.getElementById('trucksTableBody');
  const tc = tbody.closest('.table-responsive');
  showLoading(tc, 'Loading trucks...');
  try {
    const trucks = await api('/api/trucks');
    await populateTruckDriverSelect();
    if (!trucks.length) { tbody.innerHTML = emptyRow(6, 'No trucks yet'); return; }
    tbody.innerHTML = trucks.map((t, i) => `<tr>
      <td>${i + 1}</td><td>${esc(t.truck_no)}</td><td>${esc(t.driver_name || '—')}</td>
      <td><span class="status-badge status-${(t.status||'').toLowerCase().replace(/\s+/g,'-')}">${esc(t.status)}</span></td>
      <td>${esc(t.maintenance)}</td>
      <td class="actions-cell">
        <button class="btn-icon" onclick="editTruck(${t.truck_id})"><i class="fa-solid fa-pen"></i></button>
        <button class="btn-icon btn-icon-danger" onclick="deleteTruck(${t.truck_id})"><i class="fa-solid fa-trash"></i></button>
      </td></tr>`).join('');
  } catch (err) { tbody.innerHTML = errorRow(6); } finally { hideLoading(tc); }
}

async function populateTruckDriverSelect() {
  try { const d = await api('/api/drivers'); setSelectOpts('trkDriver', d.map(x => ({ value: x.driver_id, label: x.name }))); } catch (e) {}
}

async function submitTruck(e) {
  e.preventDefault();
  const id = document.getElementById('trkId').value;
  const body = { truck_no: document.getElementById('trkNo').value, driver_id: document.getElementById('trkDriver').value || null, status: document.getElementById('trkStatus').value, maintenance: document.getElementById('trkMaintenance').value };
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
    document.getElementById('trkDriver').value = t.driver_id || '';
    document.getElementById('trkStatus').value = t.status;
    document.getElementById('trkMaintenance').value = t.maintenance;
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
}

/* ══════════════════════════════════════════
   DRIVERS CRUD
   ══════════════════════════════════════════ */
async function loadDrivers() {
  switchView('drivers');
  const tbody = document.getElementById('driversTableBody');
  const tc = tbody.closest('.table-responsive');
  showLoading(tc, 'Loading drivers...');
  try {
    const drivers = await api('/api/drivers');
    if (!drivers.length) { tbody.innerHTML = emptyRow(7, 'No drivers yet'); return; }
    tbody.innerHTML = drivers.map((d, i) => `<tr>
      <td>${i + 1}</td><td>${esc(d.name)}</td><td>${esc(d.licence_no)}</td><td>${esc(d.phone_no || '—')}</td>
      <td>${fmtCurrency(d.salary)}</td>
      <td><span class="status-badge status-${(d.status||'active').toLowerCase()}">${esc(d.status || 'active')}</span></td>
      <td class="actions-cell">
        <button class="btn-icon" onclick="editDriver(${d.driver_id})"><i class="fa-solid fa-pen"></i></button>
        <button class="btn-icon btn-icon-danger" onclick="deleteDriver(${d.driver_id})"><i class="fa-solid fa-trash"></i></button>
      </td></tr>`).join('');
  } catch (err) { tbody.innerHTML = errorRow(7); } finally { hideLoading(tc); }
}

async function submitDriver(e) {
  e.preventDefault();
  const id = document.getElementById('drvId').value;
  const body = { name: document.getElementById('drvName').value, licence_no: document.getElementById('drvLicence').value, phone_no: document.getElementById('drvPhone').value, address: document.getElementById('drvAddress').value, salary: document.getElementById('drvSalary').value, status: 'active' };
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
    document.getElementById('drvLicence').value = d.licence_no;
    document.getElementById('drvPhone').value = d.phone_no || '';
    document.getElementById('drvAddress').value = d.address || '';
    document.getElementById('drvSalary').value = d.salary;
    document.getElementById('driverForm').style.display = 'block';
    document.getElementById('driverForm').scrollIntoView({ behavior: 'smooth' });
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteDriver(id) {
  if (!confirm('Delete this driver?')) return;
  try { await api(`/api/drivers/${id}`, { method: 'DELETE' }); showToast('Driver deleted', 'success'); loadDrivers(); } catch (err) { showToast(err.message, 'error'); }
}

function resetDriverForm() {
  ['drvId', 'drvName', 'drvLicence', 'drvPhone', 'drvAddress'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('drvSalary').value = 0;
}

/* ══════════════════════════════════════════
   CUSTOMERS CRUD
   ══════════════════════════════════════════ */
async function loadCustomers() {
  switchView('customers');
  const tbody = document.getElementById('customersTableBody');
  const tc = tbody.closest('.table-responsive');
  showLoading(tc, 'Loading customers...');
  try {
    const rows = await api('/api/customers');
    if (!rows.length) { tbody.innerHTML = emptyRow(7, 'No customers yet'); return; }
    tbody.innerHTML = rows.map((c, i) => `<tr>
      <td>${i + 1}</td><td>${esc(c.name)}</td><td>${esc(c.phone_no || '—')}</td><td>${esc(c.address || '—')}</td>
      <td>${fmtCurrency(c.amount_paid)}</td><td>${fmtCurrency(c.balance)}</td>
      <td class="actions-cell">
        <button class="btn-icon" onclick="editCustomer(${c.customer_id})"><i class="fa-solid fa-pen"></i></button>
        <button class="btn-icon btn-icon-danger" onclick="deleteCustomer(${c.customer_id})"><i class="fa-solid fa-trash"></i></button>
      </td></tr>`).join('');
  } catch (err) { tbody.innerHTML = errorRow(7); } finally { hideLoading(tc); }
}

async function submitCustomer(e) {
  e.preventDefault();
  const id = document.getElementById('custId').value;
  const body = { name: document.getElementById('custName').value, phone_no: document.getElementById('custPhone').value, address: document.getElementById('custAddress').value, amount_paid: document.getElementById('custAmountPaid').value, balance: document.getElementById('custBalance').value };
  try {
    if (id) { await api(`/api/customers/${id}`, { method: 'PUT', body: JSON.stringify(body) }); showToast('Customer updated', 'success'); }
    else { await api('/api/customers', { method: 'POST', body: JSON.stringify(body) }); showToast('Customer added', 'success'); }
    cancelForm('customerForm'); resetCustomerForm(); loadCustomers();
  } catch (err) { showToast(err.message, 'error'); }
}

async function editCustomer(id) {
  try {
    const c = await api(`/api/customers/${id}`);
    document.getElementById('custId').value = c.customer_id;
    document.getElementById('custName').value = c.name;
    document.getElementById('custPhone').value = c.phone_no || '';
    document.getElementById('custAddress').value = c.address || '';
    document.getElementById('custAmountPaid').value = c.amount_paid;
    document.getElementById('custBalance').value = c.balance;
    document.getElementById('customerForm').style.display = 'block';
    document.getElementById('customerForm').scrollIntoView({ behavior: 'smooth' });
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteCustomer(id) {
  if (!confirm('Delete this customer?')) return;
  try { await api(`/api/customers/${id}`, { method: 'DELETE' }); showToast('Customer deleted', 'success'); loadCustomers(); } catch (err) { showToast(err.message, 'error'); }
}

function resetCustomerForm() {
  ['custId', 'custName', 'custPhone', 'custAddress'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('custAmountPaid').value = 0;
  document.getElementById('custBalance').value = 0;
}

/* ══════════════════════════════════════════
   TRIPS CRUD
   ══════════════════════════════════════════ */
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

async function loadTrips() {
  switchView('trips');
  fetchTrips();
}

async function fetchTrips() {
  const tbody = document.getElementById('tripsTableBody');
  const tc = tbody.closest('.table-responsive');
  showLoading(tc, 'Loading trips...');
  const params = new URLSearchParams();
  params.set('page', appState.trips.page);
  params.set('limit', appState.trips.limit);
  const f = { driver: document.getElementById('tripFilterDriver').value.trim(), truck: document.getElementById('tripFilterTruck').value.trim(), date: document.getElementById('tripFilterDate').value, status: document.getElementById('tripFilterStatus').value };
  for (const [k, v] of Object.entries(f)) if (v) params.set(k, v);
  try {
    const [res, trucks, drivers, customers] = await Promise.all([
      api('/api/analytics/trip-profitability?' + params.toString()),
      api('/api/trucks'), api('/api/drivers'), api('/api/customers')
    ]);
    setSelectOpts('trpTruck', trucks.map(t => ({ value: t.truck_id, label: t.truck_no })));
    setSelectOpts('trpDriver', drivers.map(d => ({ value: d.driver_id, label: d.name })));
    setSelectOpts('trpCustomer', customers.map(c => ({ value: c.customer_id, label: c.name })));
    appState.trips.rows = res.data || [];
    appState.trips.totalPages = Math.max(res.totalPages, 1);
    document.getElementById('tripPageInfo').textContent = `Page ${appState.trips.page} of ${appState.trips.totalPages} • ${res.totalRecords || 0} trips`;
    document.getElementById('tripPrevBtn').disabled = appState.trips.page <= 1;
    document.getElementById('tripNextBtn').disabled = appState.trips.page >= appState.trips.totalPages;
    if (!appState.trips.rows.length) { tbody.innerHTML = emptyRow(9, 'No trips found'); return; }
    const offset = (appState.trips.page - 1) * appState.trips.limit;
    tbody.innerHTML = appState.trips.rows.map((t, i) => `<tr>
      <td>${offset + i + 1}</td>
      <td><strong>${esc(t.from_city)}</strong> → <strong>${esc(t.to_city)}</strong> <br><small class="text-muted">Trip #${t.trip_id}</small></td>
      <td>${esc(t.truck_no || '—')}</td><td>${esc(t.driver_name || '—')}</td><td>—</td>
      <td>${fmtDate(t.trip_date)}</td>
      <td><span class="status-badge status-completed">Evaluated</span></td>
      <td>
        <strong style="color:${t.net_profit >= 0 ? 'var(--success)' : 'var(--danger)'}">${fmtCurrency(t.net_profit)}</strong><br>
        <small style="color:var(--text-muted)">Rev: ${fmtCurrency(t.revenue)} | Exp: ${fmtCurrency(t.expenses.total)}</small>
      </td>
      <td class="actions-cell">
        <button class="btn-icon" onclick="editTrip(${t.trip_id})"><i class="fa-solid fa-pen"></i></button>
        <button class="btn-icon btn-icon-danger" onclick="deleteTrip(${t.trip_id})"><i class="fa-solid fa-trash"></i></button>
      </td></tr>`).join('');
  } catch (err) { tbody.innerHTML = errorRow(9); } finally { hideLoading(tc); }
}

async function submitTrip(e) {
  e.preventDefault();
  const id = document.getElementById('trpId').value;
  const body = { 
    from_city: document.getElementById('trpFrom').value, 
    to_city: document.getElementById('trpTo').value, 
    truck_id: document.getElementById('trpTruck').value || null, 
    driver_id: document.getElementById('trpDriver').value || null, 
    customer_id: document.getElementById('trpCustomer').value || null, 
    amount: document.getElementById('trpAmount').value, 
    toll_amount: document.getElementById('trpToll').value,
    misc_expenses: document.getElementById('trpMisc').value,
    status: document.getElementById('trpStatus').value, 
    trip_date: document.getElementById('trpDate').value 
  };
  try {
    if (id) { await api(`/api/trips/${id}`, { method: 'PUT', body: JSON.stringify(body) }); showToast('Trip updated', 'success'); }
    else { await api('/api/trips', { method: 'POST', body: JSON.stringify(body) }); showToast('Trip added', 'success'); }
    cancelForm('tripForm'); resetTripForm(); fetchTrips();
  } catch (err) { showToast(err.message, 'error'); }
}

function editTrip(id) {
  const t = appState.trips.rows.find(r => r.trip_id === id);
  if (!t) { showToast('Trip not found on this page', 'info'); return; }
  document.getElementById('trpId').value = t.trip_id;
  document.getElementById('trpFrom').value = t.from_city || '';
  document.getElementById('trpTo').value = t.to_city || '';
  document.getElementById('trpTruck').value = t.truck_id || '';
  document.getElementById('trpDriver').value = t.driver_id || '';
  document.getElementById('trpCustomer').value = t.customer_id || '';
  document.getElementById('trpAmount').value = t.revenue || 0;
  document.getElementById('trpToll').value = t.expenses ? t.expenses.tolls : 0;
  document.getElementById('trpMisc').value = t.expenses ? t.expenses.misc : 0;
  document.getElementById('trpStatus').value = 'completed';
  document.getElementById('trpDate').value = t.trip_date ? t.trip_date.split('T')[0] : '';
  document.getElementById('tripForm').style.display = 'block';
  document.getElementById('tripForm').scrollIntoView({ behavior: 'smooth' });
}

async function deleteTrip(id) {
  if (!confirm('Delete this trip?')) return;
  try { await api(`/api/trips/${id}`, { method: 'DELETE' }); showToast('Trip deleted', 'success'); fetchTrips(); } catch (err) { showToast(err.message, 'error'); }
}

function resetTripForm() {
  ['trpId', 'trpFrom', 'trpTo', 'trpAmount', 'trpDate'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('trpToll').value = '0';
  document.getElementById('trpMisc').value = '0';
  document.getElementById('trpTruck').value = '';
  document.getElementById('trpDriver').value = '';
  document.getElementById('trpCustomer').value = '';
  document.getElementById('trpStatus').value = 'pending';
}

/* ══════════════════════════════════════════
   FUEL CRUD
   ══════════════════════════════════════════ */
function changeFuelPage(dir) {
  const np = appState.fuel.page + dir;
  if (np >= 1 && np <= appState.fuel.totalPages) { appState.fuel.page = np; loadFuel(); }
}

async function loadFuel() {
  switchView('fuel');
  const tbody = document.getElementById('fuelTableBody');
  const tc = tbody.closest('.table-responsive');
  showLoading(tc, 'Loading fuel records...');
  try {
    const params = new URLSearchParams();
    params.set('page', appState.fuel.page);
    params.set('limit', appState.fuel.limit);
    const [res, trucks, drivers] = await Promise.all([api('/api/fuel?' + params.toString()), api('/api/trucks'), api('/api/drivers')]);
    
    appState.fuel.totalPages = Math.max(Math.ceil(res.totalRecords / appState.fuel.limit), 1);
    document.getElementById('fuelPageInfo').textContent = `Page ${appState.fuel.page} of ${appState.fuel.totalPages} • ${res.totalRecords || 0} records`;
    document.getElementById('fuelPrevBtn').disabled = appState.fuel.page <= 1;
    document.getElementById('fuelNextBtn').disabled = appState.fuel.page >= appState.fuel.totalPages;

    const rows = res.data || [];
    setSelectOpts('fuelTruck', trucks.map(t => ({ value: t.truck_id, label: t.truck_no })));
    setSelectOpts('fuelDriver', drivers.map(d => ({ value: d.driver_id, label: d.name })));
    if (!rows.length) { tbody.innerHTML = emptyRow(7, 'No fuel records yet'); return; }
    
    const offset = (appState.fuel.page - 1) * appState.fuel.limit;
    tbody.innerHTML = rows.map((f, i) => `<tr>
      <td>${offset + i + 1}</td><td>${esc(f.truck_no || '—')}</td><td>${esc(f.driver_name || '—')}</td>
      <td>${Number(f.liters).toLocaleString('en-IN')} L</td><td>${fmtCurrency(f.price)}</td><td>${fmtDate(f.fuel_date)}</td>
      <td class="actions-cell"><button class="btn-icon btn-icon-danger" onclick="deleteFuel(${f.fuel_id})"><i class="fa-solid fa-trash"></i></button></td>
      </tr>`).join('');
  } catch (err) { tbody.innerHTML = errorRow(7); } finally { hideLoading(tc); }
}

async function submitFuel(e) {
  e.preventDefault();
  const body = { truck_id: document.getElementById('fuelTruck').value || null, driver_id: document.getElementById('fuelDriver').value || null, liters: document.getElementById('fuelLiters').value, price: document.getElementById('fuelPrice').value, fuel_date: document.getElementById('fuelDate').value };
  try {
    await api('/api/fuel', { method: 'POST', body: JSON.stringify(body) });
    showToast('Fuel record added', 'success');
    cancelForm('fuelForm'); resetFuelForm(); loadFuel();
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteFuel(id) {
  if (!confirm('Delete this fuel record?')) return;
  try { await api(`/api/fuel/${id}`, { method: 'DELETE' }); showToast('Fuel deleted', 'success'); loadFuel(); } catch (err) { showToast(err.message, 'error'); }
}

function resetFuelForm() {
  ['fuelLiters', 'fuelPrice', 'fuelDate'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('fuelTruck').value = '';
  document.getElementById('fuelDriver').value = '';
}

/* ── Reports ── */
function loadReports() { switchView('reports'); }
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
function exportTripsPDF() { downloadReport(`/api/reports/trips/pdf?t=${Date.now()}`, 'trips-report.pdf'); }
function exportTripsExcel() { downloadReport(`/api/reports/trips/excel?t=${Date.now()}`, 'trips-report.xlsx'); }
function exportFuelExcel() { downloadReport(`/api/reports/fuel/excel?t=${Date.now()}`, 'fuel-report.xlsx'); }
function exportRevenuePDF() { downloadReport(`/api/reports/revenue/pdf?t=${Date.now()}`, 'revenue-report.pdf'); }

/* ══════════════════════════════════════════
   ADVANCED MODULES (Performance, Maintenance, Efficiency)
   ══════════════════════════════════════════ */

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
    const [res, trucks] = await Promise.all([api('/api/maintenance?' + params.toString()), api('/api/trucks')]);
    
    appState.maintenance.totalPages = Math.max(Math.ceil(res.totalRecords / appState.maintenance.limit), 1);
    document.getElementById('mtnPageInfo').textContent = `Page ${appState.maintenance.page} of ${appState.maintenance.totalPages} • ${res.totalRecords || 0} records`;
    document.getElementById('mtnPrevBtn').disabled = appState.maintenance.page <= 1;
    document.getElementById('mtnNextBtn').disabled = appState.maintenance.page >= appState.maintenance.totalPages;

    const rows = res.data || [];
    setSelectOpts('mtnTruck', trucks.map(t => ({ value: t.truck_id, label: t.truck_no })));
    if (!rows.length) { tbody.innerHTML = emptyRow(6, 'No maintenance records yet'); return; }
    
    const offset = (appState.maintenance.page - 1) * appState.maintenance.limit;
    tbody.innerHTML = rows.map((m, i) => `<tr>
      <td>${offset + i + 1}</td><td>${esc(m.truck_no || '—')}</td><td>${fmtDate(m.service_date)}</td>
      <td>${fmtCurrency(m.cost)}</td><td>${esc(m.description || '—')}</td>
      <td class="actions-cell">
        <button class="btn-icon btn-icon-danger" onclick="deleteMaintenance(${m.maintenance_id})"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>`).join('');
  } catch (err) { tbody.innerHTML = errorRow(6); } finally { hideLoading(tc); }
}

async function submitMaintenance(e) {
  e.preventDefault();
  const id = document.getElementById('mtnId').value;
  const body = { truck_id: document.getElementById('mtnTruck').value, service_date: document.getElementById('mtnDate').value, cost: document.getElementById('mtnCost').value, description: document.getElementById('mtnDesc').value };
  try {
    if (id) { await api(`/api/maintenance/${id}`, { method: 'PUT', body: JSON.stringify(body) }); showToast('Record updated', 'success'); }
    else { await api('/api/maintenance', { method: 'POST', body: JSON.stringify(body) }); showToast('Record added', 'success'); }
    cancelForm('maintenanceForm'); resetMaintenanceForm(); loadMaintenance();
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteMaintenance(id) {
  if (!confirm('Delete this maintenance record?')) return;
  try { await api(`/api/maintenance/${id}`, { method: 'DELETE' }); showToast('Deleted', 'success'); loadMaintenance(); } catch (err) { showToast(err.message, 'error'); }
}

function resetMaintenanceForm() {
  ['mtnId', 'mtnTruck', 'mtnDate', 'mtnCost', 'mtnDesc'].forEach(id => document.getElementById(id).value = '');
}

/* Fuel Efficiency */
let efficiencyCostChart = null;
async function loadEfficiency() {
  switchView('efficiency');
  const tbody = document.getElementById('efficiencyTableBody');
  const tc = tbody.closest('.table-responsive');
  showLoading(tc, 'Loading efficiency metrics...');
  try {
    const data = await api('/api/dashboard/efficiency');
    const rows = data.fuelByTruck || [];
    if (!rows.length) { tbody.innerHTML = emptyRow(5, 'No efficiency data yet'); }
    else {
      tbody.innerHTML = rows.map((r, i) => `<tr>
        <td>${i + 1}</td><td>${esc(r.truck_no || '—')}</td><td>${r.refuels}</td>
        <td>${Number(r.total_liters).toLocaleString('en-IN')} L</td>
        <td>${fmtCurrency(r.total_cost)}</td>
      </tr>`).join('');
    }

    /* Render Chart */
    const trend = data.monthlyTrend || [];
    Chart.defaults.color = '#9ca3af';
    Chart.defaults.font.family = 'Inter';
    if (efficiencyCostChart) efficiencyCostChart.destroy();
    efficiencyCostChart = new Chart(document.getElementById('efficiencyCostChart').getContext('2d'), {
      type: 'line',
      data: {
        labels: trend.map(d => d.month),
        datasets: [{
          label: 'Total Fuel Cost (₹)',
          data: trend.map(d => d.cost),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.3
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  } catch (err) { tbody.innerHTML = errorRow(5); } finally { hideLoading(tc); }
}

/* ── Socket.IO ── */
function initRealtime() {
  if (!window.io) return;
  const token = localStorage.getItem('tbToken');
  if (!token) return;
  if (!appState.socket) {
    appState.socket = io({ auth: { token } });
    appState.socket.on('new_trip', () => { showToast('New trip recorded', 'success'); if (document.getElementById('view-trips').style.display === 'block') fetchTrips(); });
    appState.socket.on('fuel_update', () => { showToast('Fuel updated', 'info'); if (document.getElementById('view-fuel').style.display === 'block') loadFuel(); if (document.getElementById('view-dashboard').style.display === 'block') loadDashboard(); });
    appState.socket.on('truck_location_update', () => { showToast('Truck location updated', 'info'); if (document.getElementById('view-trucks').style.display === 'block') loadTrucks(); if (document.getElementById('view-trips').style.display === 'block') fetchTrips(); });
  }
}

/* ── Auto-login ── */
(function () {
  const tk = localStorage.getItem('tbToken');
  const u = localStorage.getItem('tbUser');
  if (tk && u) enterDashboard(JSON.parse(u));
})();