const API = "";

const appState = {
  socket: null,
  currentUser: null,
  trips: { page: 1, limit: 10, totalPages: 1, rows: [] }
};

/* ── Modals ── */
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function switchModal(from, to) { closeModal(from); openModal(to); }

/* ── Toast ── */
function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast show ${type}`;
  t.innerText = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.className = `toast ${type}`; setTimeout(() => t.remove(), 300); }, 3000);
}

/* ── Loading / Error / Empty helpers ── */
function showLoading(c) { if (!c) return; c.style.position = 'relative'; const d = document.createElement('div'); d.className = 'loading'; d.innerText = 'Loading...'; c.appendChild(d); }
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
  document.getElementById('username').textContent = user.full_name || user.email.split('@')[0];
  initRealtime();
  loadDashboard();
}

/* ── Navigation ── */
function switchView(name) {
  document.querySelectorAll('.view-section').forEach(el => el.style.display = 'none');
  document.getElementById(`view-${name}`).style.display = 'block';
  document.querySelectorAll('.menu li').forEach(el => el.classList.remove('active'));
  document.getElementById(`menu-${name}`).classList.add('active');
  const titles = { dashboard: 'Dashboard', trucks: 'Fleet Directory', drivers: 'Drivers', customers: 'Customers', trips: 'Trips', fuel: 'Fuel Records', reports: 'Reports' };
  document.getElementById('pageTitle').textContent = titles[name];
}

/* ══════════════════════════════════════════
   DASHBOARD
   ══════════════════════════════════════════ */
let revenueChart = null, fuelTrendChart = null;

async function loadDashboard() {
  switchView('dashboard');
  const c = document.getElementById('view-dashboard');
  showLoading(c);
  try {
    const [m, a] = await Promise.all([api('/api/dashboard/metrics'), api('/api/dashboard/analytics')]);
    document.getElementById('totalTrucks').textContent = m.totalTrucks || 0;
    document.getElementById('activeTrucksVal').textContent = m.activeTrucks || 0;
    document.getElementById('monthlyRevenueVal').textContent = fmtCurrency(m.monthlyRevenue);
    document.getElementById('fuelExpensesVal').textContent = fmtCurrency(m.fuelExpenses);
    document.getElementById('profitVal').textContent = fmtCurrency(m.profit);
    renderCharts(a.monthlyRevenue || [], a.monthlyFuelCost || []);
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
  showLoading(tc);
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
  showLoading(tc);
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
  showLoading(tc);
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
  showLoading(tc);
  const params = new URLSearchParams();
  params.set('page', appState.trips.page);
  params.set('limit', appState.trips.limit);
  const f = { driver: document.getElementById('tripFilterDriver').value.trim(), truck: document.getElementById('tripFilterTruck').value.trim(), date: document.getElementById('tripFilterDate').value, status: document.getElementById('tripFilterStatus').value };
  for (const [k, v] of Object.entries(f)) if (v) params.set(k, v);
  try {
    const [res, trucks, drivers, customers] = await Promise.all([
      api('/api/trips?' + params.toString()),
      api('/api/trucks'), api('/api/drivers'), api('/api/customers')
    ]);
    setSelectOpts('trpTruck', trucks.map(t => ({ value: t.truck_id, label: t.truck_no })));
    setSelectOpts('trpDriver', drivers.map(d => ({ value: d.driver_id, label: d.name })));
    setSelectOpts('trpCustomer', customers.map(c => ({ value: c.customer_id, label: c.name })));
    appState.trips.rows = res.data || [];
    appState.trips.totalPages = Math.max(Math.ceil(res.totalTrips / appState.trips.limit), 1);
    document.getElementById('tripPageInfo').textContent = `Page ${appState.trips.page} of ${appState.trips.totalPages} • ${res.totalTrips || 0} trips`;
    document.getElementById('tripPrevBtn').disabled = appState.trips.page <= 1;
    document.getElementById('tripNextBtn').disabled = appState.trips.page >= appState.trips.totalPages;
    if (!appState.trips.rows.length) { tbody.innerHTML = emptyRow(9, 'No trips found'); return; }
    const offset = (appState.trips.page - 1) * appState.trips.limit;
    tbody.innerHTML = appState.trips.rows.map((t, i) => `<tr>
      <td>${offset + i + 1}</td>
      <td><strong>${esc(t.from_city)}</strong> → <strong>${esc(t.to_city)}</strong></td>
      <td>${esc(t.truck_no || '—')}</td><td>${esc(t.driver_name || '—')}</td><td>${esc(t.customer_name || '—')}</td>
      <td>${fmtDate(t.trip_date)}</td>
      <td><span class="status-badge status-${(t.status||'').toLowerCase()}">${esc(t.status)}</span></td>
      <td>${fmtCurrency(t.amount)}</td>
      <td class="actions-cell">
        <button class="btn-icon" onclick="editTrip(${t.trip_id})"><i class="fa-solid fa-pen"></i></button>
        <button class="btn-icon btn-icon-danger" onclick="deleteTrip(${t.trip_id})"><i class="fa-solid fa-trash"></i></button>
      </td></tr>`).join('');
  } catch (err) { tbody.innerHTML = errorRow(9); } finally { hideLoading(tc); }
}

async function submitTrip(e) {
  e.preventDefault();
  const id = document.getElementById('trpId').value;
  const body = { from_city: document.getElementById('trpFrom').value, to_city: document.getElementById('trpTo').value, truck_id: document.getElementById('trpTruck').value || null, driver_id: document.getElementById('trpDriver').value || null, customer_id: document.getElementById('trpCustomer').value || null, amount: document.getElementById('trpAmount').value, status: document.getElementById('trpStatus').value, trip_date: document.getElementById('trpDate').value };
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
  document.getElementById('trpFrom').value = t.from_city;
  document.getElementById('trpTo').value = t.to_city;
  document.getElementById('trpTruck').value = t.truck_id || '';
  document.getElementById('trpDriver').value = t.driver_id || '';
  document.getElementById('trpCustomer').value = t.customer_id || '';
  document.getElementById('trpAmount').value = t.amount;
  document.getElementById('trpStatus').value = t.status;
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
  document.getElementById('trpTruck').value = '';
  document.getElementById('trpDriver').value = '';
  document.getElementById('trpCustomer').value = '';
  document.getElementById('trpStatus').value = 'pending';
}

/* ══════════════════════════════════════════
   FUEL CRUD
   ══════════════════════════════════════════ */
async function loadFuel() {
  switchView('fuel');
  const tbody = document.getElementById('fuelTableBody');
  const tc = tbody.closest('.table-responsive');
  showLoading(tc);
  try {
    const [rows, trucks, drivers] = await Promise.all([api('/api/fuel'), api('/api/trucks'), api('/api/drivers')]);
    setSelectOpts('fuelTruck', trucks.map(t => ({ value: t.truck_id, label: t.truck_no })));
    setSelectOpts('fuelDriver', drivers.map(d => ({ value: d.driver_id, label: d.name })));
    if (!rows.length) { tbody.innerHTML = emptyRow(7, 'No fuel records yet'); return; }
    tbody.innerHTML = rows.map((f, i) => `<tr>
      <td>${i + 1}</td><td>${esc(f.truck_no || '—')}</td><td>${esc(f.driver_name || '—')}</td>
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
function exportTripsPDF() { window.location.href = '/api/reports/trips/pdf'; }
function exportTripsExcel() { window.location.href = '/api/reports/trips/excel'; }
function exportFuelExcel() { window.location.href = '/api/reports/fuel/excel'; }
function exportRevenuePDF() { window.location.href = '/api/reports/revenue/pdf'; }

/* ── Socket.IO ── */
function initRealtime() {
  if (!window.io) return;
  const token = localStorage.getItem('tbToken');
  if (!token) return;
  if (!appState.socket) {
    appState.socket = io({ auth: { token } });
    appState.socket.on('new_trip', () => { showToast('New trip recorded', 'success'); if (document.getElementById('view-trips').style.display === 'block') fetchTrips(); });
    appState.socket.on('fuel_update', () => { showToast('Fuel updated', 'info'); if (document.getElementById('view-fuel').style.display === 'block') loadFuel(); if (document.getElementById('view-dashboard').style.display === 'block') loadDashboard(); });
  }
}

/* ── Auto-login ── */
(function () {
  const tk = localStorage.getItem('tbToken');
  const u = localStorage.getItem('tbUser');
  if (tk && u) enterDashboard(JSON.parse(u));
})();