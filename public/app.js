/* ════════════════════════════════════════════════════════════
   TruckBoss Pro — Frontend Application
   ════════════════════════════════════════════════════════════ */

const API = "";   // same origin

// ── Utility: API request with JWT ─────────────────────────────────────────────
async function api(path, options = {}) {
  const token = localStorage.getItem("tbToken");
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers["Authorization"] = "Bearer " + token;
  const res = await fetch(API + path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ── Toast ──────────────────────────────────────────────────────────────────────
function showToast(msg, type = "info") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "toast show " + type;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = "toast"; }, 3500);
}

// ── Modal helpers ──────────────────────────────────────────────────────────────
function openModal(id) { document.getElementById(id).style.display = "flex"; }
function closeModal(id) { document.getElementById(id).style.display = "none"; }
function switchModal(from, to) { closeModal(from); openModal(to); }

// ── Password visibility toggle ─────────────────────────────────────────────────
function togglePassword(inputId, icon) {
  const el = document.getElementById(inputId);
  if (el.type === "password") {
    el.type = "text";
    icon.classList.replace("ri-eye-line", "ri-eye-off-line");
  } else {
    el.type = "password";
    icon.classList.replace("ri-eye-off-line", "ri-eye-line");
  }
}

function scrollToTop() { window.scrollTo(0, 0); }

// ══ AUTH ══════════════════════════════════════════════════════════════════════

async function handleLogin(e) {
  e.preventDefault();
  try {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: document.getElementById("loginEmail").value,
        password: document.getElementById("loginPassword").value,
      }),
    });
    localStorage.setItem("tbToken", data.token);
    localStorage.setItem("tbUser", JSON.stringify(data.user));
    closeModal("authModal");
    enterDashboard(data.user);
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function handleRegister(e) {
  e.preventDefault();
  try {
    const data = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        full_name: document.getElementById("regName").value,
        email: document.getElementById("regEmail").value,
        password: document.getElementById("regPassword").value,
      }),
    });
    localStorage.setItem("tbToken", data.token);
    localStorage.setItem("tbUser", JSON.stringify(data.user));
    closeModal("registerModal");
    enterDashboard(data.user);
  } catch (err) {
    showToast(err.message, "error");
  }
}

function handleLogout() {
  localStorage.removeItem("tbToken");
  localStorage.removeItem("tbUser");
  document.getElementById("dashboardPage").style.display = "none";
  document.getElementById("landingPage").style.display = "flex";
  history.pushState({}, "", "/");
}

function enterDashboard(user) {
  document.getElementById("landingPage").style.display = "none";
  document.getElementById("dashboardPage").style.display = "block";
  const name = user.full_name || user.email.split("@")[0];
  document.getElementById("userGreeting").textContent = "👋 " + name;
  navigate("dashboard");
  history.pushState({ section: "dashboard" }, "", "/dashboard");
}

// Auto-login from stored token
(function autoLogin() {
  const token = localStorage.getItem("tbToken");
  const user = JSON.parse(localStorage.getItem("tbUser") || "null");
  if (token && user) {
    enterDashboard(user);
  }
})();

// Browser back/forward
window.addEventListener("popstate", (e) => {
  const section = e.state && e.state.section;
  if (section) navigate(section, false);
});

// ══ NAVIGATION ════════════════════════════════════════════════════════════════

const sectionTitles = {
  dashboard: "Dashboard",
  customers: "Customers",
  drivers:   "Drivers",
  trucks:    "Trucks",
  trips:     "Trips",
  fuel:      "Fuel Records",
};

function navigate(section, pushState = true) {
  // Hide all sections
  document.querySelectorAll(".section-content").forEach((el) => {
    el.style.display = "none";
  });
  // Show target
  const target = document.getElementById("section" + capitalize(section));
  if (target) target.style.display = "block";

  // Update sidebar
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.section === section);
  });

  // Update title
  document.getElementById("pageTitle").textContent = sectionTitles[section] || section;

  // Load data
  const loaders = {
    dashboard: loadDashboard,
    customers: loadCustomers,
    drivers:   loadDrivers,
    trucks:    loadTrucks,
    trips:     loadTrips,
    fuel:      loadFuel,
  };
  if (loaders[section]) loaders[section]();

  if (pushState) history.pushState({ section }, "", "/" + section);
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ── Form toggle helpers ────────────────────────────────────────────────────────
function toggleForm(formId) {
  const el = document.getElementById(formId);
  el.style.display = el.style.display === "none" ? "block" : "none";
}
function cancelForm(formId, resetFn) {
  document.getElementById(formId).style.display = "none";
  if (resetFn) resetFn();
}

// ══ CHARTS ════════════════════════════════════════════════════════════════════
let revenueChart = null;
let truckChart   = null;

function destroyChart(chartVar) { if (chartVar) { chartVar.destroy(); } }

async function loadDashboard() {
  try {
    const [stats, revData] = await Promise.all([
      api("/api/dashboard/stats"),
      api("/api/dashboard/revenue-chart"),
    ]);
    renderStatCards(stats);
    renderRevenueChart(revData);
  } catch (err) {
    showToast("Failed to load dashboard: " + err.message, "error");
  }
}

function renderStatCards(s) {
  const fmt = (n) => Number(n).toLocaleString("en-IN");
  document.getElementById("dashboardCards").innerHTML = `
    <div class="stat-card">
      <div class="stat-icon orange"><i class="ri-group-line"></i></div>
      <div class="stat-label">Customers</div>
      <div class="stat-value">${s.customers}</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon green"><i class="ri-money-rupee-circle-line"></i></div>
      <div class="stat-label">Total Revenue</div>
      <div class="stat-value">₹${fmt(s.revenue)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon blue"><i class="ri-truck-line"></i></div>
      <div class="stat-label">Total Trucks</div>
      <div class="stat-value">${s.trucks}</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon green"><i class="ri-checkbox-circle-line"></i></div>
      <div class="stat-label">Available</div>
      <div class="stat-value">${s.trucksAvailable}</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon blue"><i class="ri-road-map-line"></i></div>
      <div class="stat-label">In Use</div>
      <div class="stat-value">${s.trucksInUse}</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon yellow"><i class="ri-tools-line"></i></div>
      <div class="stat-label">Maintenance</div>
      <div class="stat-value">${s.trucksMaintenance}</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon purple"><i class="ri-steering-2-line"></i></div>
      <div class="stat-label">Drivers</div>
      <div class="stat-value">${s.drivers}</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon orange"><i class="ri-map-pin-2-line"></i></div>
      <div class="stat-label">Total Trips</div>
      <div class="stat-value">${s.trips}</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon red"><i class="ri-fuel-line"></i></div>
      <div class="stat-label">Fuel Cost</div>
      <div class="stat-value">₹${fmt(s.fuelCost)}</div>
    </div>
  `;
}

function renderRevenueChart(data) {
  destroyChart(revenueChart);
  const ctx = document.getElementById("revenueChart").getContext("2d");
  revenueChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.map((d) => d.name),
      datasets: [{
        label: "Amount Paid (₹)",
        data: data.map((d) => d.amount_paid),
        backgroundColor: "rgba(249,115,22,.7)",
        borderColor: "#f97316",
        borderWidth: 2,
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: "#e5e7eb" } } },
      scales: {
        x: { ticks: { color: "#94a3b8" }, grid: { color: "#374151" } },
        y: { ticks: { color: "#94a3b8" }, grid: { color: "#374151" } },
      },
    },
  });
}

// ══ CUSTOMERS ════════════════════════════════════════════════════════════════

async function loadCustomers() {
  try {
    const rows = await api("/api/customers");
    const tbody = document.querySelector("#customerTable tbody");
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted)">No customers yet</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map((c, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(c.name)}</td>
        <td>${esc(c.phone_no || "—")}</td>
        <td>${esc(c.address || "—")}</td>
        <td>₹${Number(c.amount_paid).toLocaleString("en-IN")}</td>
        <td>₹${Number(c.balance).toLocaleString("en-IN")}</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="editCustomer(${c.customer_id})"><i class="ri-edit-line"></i></button>
          <button class="btn btn-sm btn-danger" onclick="deleteCustomer(${c.customer_id})"><i class="ri-delete-bin-line"></i></button>
        </td>
      </tr>`).join("");
  } catch (err) {
    showToast("Failed to load customers: " + err.message, "error");
  }
}

async function submitCustomer(e) {
  e.preventDefault();
  const id = document.getElementById("custId").value;
  const body = {
    name:        document.getElementById("custName").value,
    phone_no:    document.getElementById("custPhone").value,
    address:     document.getElementById("custAddress").value,
    amount_paid: document.getElementById("custAmountPaid").value,
    balance:     document.getElementById("custBalance").value,
  };
  try {
    if (id) {
      await api("/api/customers/" + id, { method: "PUT", body: JSON.stringify(body) });
      showToast("Customer updated", "success");
    } else {
      await api("/api/customers", { method: "POST", body: JSON.stringify(body) });
      showToast("Customer added", "success");
    }
    cancelForm("customerForm", resetCustomerForm);
    loadCustomers();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function editCustomer(id) {
  try {
    const c = await api("/api/customers/" + id);
    document.getElementById("custId").value = c.customer_id;
    document.getElementById("custName").value = c.name;
    document.getElementById("custPhone").value = c.phone_no || "";
    document.getElementById("custAddress").value = c.address || "";
    document.getElementById("custAmountPaid").value = c.amount_paid;
    document.getElementById("custBalance").value = c.balance;
    document.getElementById("customerForm").style.display = "block";
    document.getElementById("customerForm").scrollIntoView({ behavior: "smooth" });
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function deleteCustomer(id) {
  if (!confirm("Delete this customer?")) return;
  try {
    await api("/api/customers/" + id, { method: "DELETE" });
    showToast("Customer deleted", "success");
    loadCustomers();
  } catch (err) {
    showToast(err.message, "error");
  }
}

function resetCustomerForm() {
  ["custId","custName","custPhone","custAddress"].forEach((id) => {
    document.getElementById(id).value = "";
  });
  document.getElementById("custAmountPaid").value = 0;
  document.getElementById("custBalance").value = 0;
}

// ══ DRIVERS ══════════════════════════════════════════════════════════════════

async function loadDrivers() {
  try {
    const rows = await api("/api/drivers");
    const tbody = document.querySelector("#driverTable tbody");
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted)">No drivers yet</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map((d, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(d.name)}</td>
        <td>${esc(d.licence_no)}</td>
        <td>${esc(d.phone_no || "—")}</td>
        <td>₹${Number(d.salary).toLocaleString("en-IN")}</td>
        <td><span class="badge badge-${d.status}">${d.status}</span></td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="editDriver(${d.driver_id})"><i class="ri-edit-line"></i></button>
          <button class="btn btn-sm btn-danger" onclick="deleteDriver(${d.driver_id})"><i class="ri-delete-bin-line"></i></button>
        </td>
      </tr>`).join("");
  } catch (err) {
    showToast("Failed to load drivers: " + err.message, "error");
  }
}

async function submitDriver(e) {
  e.preventDefault();
  const id = document.getElementById("drvId").value;
  const body = {
    name:       document.getElementById("drvName").value,
    licence_no: document.getElementById("drvLicence").value,
    phone_no:   document.getElementById("drvPhone").value,
    address:    document.getElementById("drvAddress").value,
    salary:     document.getElementById("drvSalary").value,
    status:     "active",
  };
  try {
    if (id) {
      await api("/api/drivers/" + id, { method: "PUT", body: JSON.stringify(body) });
      showToast("Driver updated", "success");
    } else {
      await api("/api/drivers", { method: "POST", body: JSON.stringify(body) });
      showToast("Driver added", "success");
    }
    cancelForm("driverForm", resetDriverForm);
    loadDrivers();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function editDriver(id) {
  try {
    const d = await api("/api/drivers/" + id);
    document.getElementById("drvId").value = d.driver_id;
    document.getElementById("drvName").value = d.name;
    document.getElementById("drvLicence").value = d.licence_no;
    document.getElementById("drvPhone").value = d.phone_no || "";
    document.getElementById("drvAddress").value = d.address || "";
    document.getElementById("drvSalary").value = d.salary;
    document.getElementById("driverForm").style.display = "block";
    document.getElementById("driverForm").scrollIntoView({ behavior: "smooth" });
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function deleteDriver(id) {
  if (!confirm("Delete this driver?")) return;
  try {
    await api("/api/drivers/" + id, { method: "DELETE" });
    showToast("Driver deleted", "success");
    loadDrivers();
  } catch (err) {
    showToast(err.message, "error");
  }
}

function resetDriverForm() {
  ["drvId","drvName","drvLicence","drvPhone","drvAddress"].forEach((id) => {
    document.getElementById(id).value = "";
  });
  document.getElementById("drvSalary").value = 0;
}

// ══ TRUCKS ═══════════════════════════════════════════════════════════════════

async function loadTrucks() {
  try {
    const [rows, statusData] = await Promise.all([
      api("/api/trucks"),
      api("/api/trucks/summary/status"),
    ]);
    const tbody = document.querySelector("#truckTable tbody");
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted)">No trucks yet</td></tr>';
    } else {
      tbody.innerHTML = rows.map((t, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${esc(t.truck_no)}</td>
          <td>${esc(t.driver_name || "—")}</td>
          <td><span class="badge badge-${t.status.toLowerCase().replace(" ", "-")}">${t.status}</span></td>
          <td>${esc(t.maintenance)}</td>
          <td>
            <button class="btn btn-sm btn-outline" onclick="editTruck(${t.truck_id})"><i class="ri-edit-line"></i></button>
            <button class="btn btn-sm btn-danger" onclick="deleteTruck(${t.truck_id})"><i class="ri-delete-bin-line"></i></button>
          </td>
        </tr>`).join("");
    }
    renderTruckChart(statusData);
    await populateTruckDriverSelect();
  } catch (err) {
    showToast("Failed to load trucks: " + err.message, "error");
  }
}

async function populateTruckDriverSelect() {
  try {
    const drivers = await api("/api/drivers");
    ["trkDriver"].forEach((selId) => {
      const sel = document.getElementById(selId);
      const cur = sel.value;
      sel.innerHTML = '<option value="">-- None --</option>' +
        drivers.map((d) => `<option value="${d.driver_id}">${esc(d.name)}</option>`).join("");
      sel.value = cur;
    });
  } catch (_) {}
}

function renderTruckChart(data) {
  destroyChart(truckChart);
  const statusColors = {
    Available:   "rgba(34,197,94,.7)",
    "In Use":    "rgba(37,99,235,.7)",
    Maintenance: "rgba(234,179,8,.7)",
  };
  const ctx = document.getElementById("truckChart").getContext("2d");
  truckChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: data.map((d) => d.status),
      datasets: [{
        data: data.map((d) => d.count),
        backgroundColor: data.map((d) => statusColors[d.status] || "#64748b"),
        borderColor: "#1f2937",
        borderWidth: 3,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: "#e5e7eb" } },
      },
    },
  });
}

async function submitTruck(e) {
  e.preventDefault();
  const id = document.getElementById("trkId").value;
  const body = {
    truck_no:    document.getElementById("trkNo").value,
    driver_id:   document.getElementById("trkDriver").value || null,
    status:      document.getElementById("trkStatus").value,
    maintenance: document.getElementById("trkMaintenance").value,
  };
  try {
    if (id) {
      await api("/api/trucks/" + id, { method: "PUT", body: JSON.stringify(body) });
      showToast("Truck updated", "success");
    } else {
      await api("/api/trucks", { method: "POST", body: JSON.stringify(body) });
      showToast("Truck added", "success");
    }
    cancelForm("truckForm", resetTruckForm);
    loadTrucks();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function editTruck(id) {
  try {
    const t = await api("/api/trucks/" + id);
    await populateTruckDriverSelect();
    document.getElementById("trkId").value = t.truck_id;
    document.getElementById("trkNo").value = t.truck_no;
    document.getElementById("trkDriver").value = t.driver_id || "";
    document.getElementById("trkStatus").value = t.status;
    document.getElementById("trkMaintenance").value = t.maintenance;
    document.getElementById("truckForm").style.display = "block";
    document.getElementById("truckForm").scrollIntoView({ behavior: "smooth" });
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function deleteTruck(id) {
  if (!confirm("Delete this truck?")) return;
  try {
    await api("/api/trucks/" + id, { method: "DELETE" });
    showToast("Truck deleted", "success");
    loadTrucks();
  } catch (err) {
    showToast(err.message, "error");
  }
}

function resetTruckForm() {
  document.getElementById("trkId").value = "";
  document.getElementById("trkNo").value = "";
  document.getElementById("trkDriver").value = "";
  document.getElementById("trkStatus").value = "Available";
  document.getElementById("trkMaintenance").value = "Not Required";
}

// ══ TRIPS ════════════════════════════════════════════════════════════════════

async function loadTrips() {
  try {
    const [trips, trucks, drivers, customers] = await Promise.all([
      api("/api/trips"),
      api("/api/trucks"),
      api("/api/drivers"),
      api("/api/customers"),
    ]);

    // Populate selects
    document.getElementById("trpTruck").innerHTML =
      '<option value="">-- None --</option>' +
      trucks.map((t) => `<option value="${t.truck_id}">${esc(t.truck_no)}</option>`).join("");
    document.getElementById("trpDriver").innerHTML =
      '<option value="">-- None --</option>' +
      drivers.map((d) => `<option value="${d.driver_id}">${esc(d.name)}</option>`).join("");
    document.getElementById("trpCustomer").innerHTML =
      '<option value="">-- None --</option>' +
      customers.map((c) => `<option value="${c.customer_id}">${esc(c.name)}</option>`).join("");

    const container = document.getElementById("tripList");
    if (trips.length === 0) {
      container.innerHTML = '<p style="color:var(--muted);text-align:center;padding:40px">No trips yet</p>';
      return;
    }

    container.innerHTML = trips.map((t) => `
      <div class="trip-card">
        <div class="trip-route">
          <i class="ri-map-pin-2-line"></i>
          ${esc(t.from_city)} → ${esc(t.to_city)}
        </div>
        <div class="trip-meta">
          <span><i class="ri-truck-line"></i> ${esc(t.truck_no || "—")}</span>
          <span><i class="ri-steering-2-line"></i> ${esc(t.driver_name || "—")}</span>
          <span><i class="ri-group-line"></i> ${esc(t.customer_name || "—")}</span>
          <span><i class="ri-calendar-line"></i> ${t.trip_date ? t.trip_date.split("T")[0] : "—"}</span>
        </div>
        <div class="trip-footer">
          <span class="trip-amount">₹${Number(t.amount).toLocaleString("en-IN")}</span>
          <span class="badge badge-${t.status}">${t.status}</span>
          <div class="trip-actions">
            <button class="btn btn-sm btn-outline" onclick="editTrip(${t.trip_id})"><i class="ri-edit-line"></i></button>
            <button class="btn btn-sm btn-danger" onclick="deleteTrip(${t.trip_id})"><i class="ri-delete-bin-line"></i></button>
          </div>
        </div>
      </div>`).join("");
  } catch (err) {
    showToast("Failed to load trips: " + err.message, "error");
  }
}

async function submitTrip(e) {
  e.preventDefault();
  const id = document.getElementById("trpId").value;
  const body = {
    from_city:   document.getElementById("trpFrom").value,
    to_city:     document.getElementById("trpTo").value,
    truck_id:    document.getElementById("trpTruck").value || null,
    driver_id:   document.getElementById("trpDriver").value || null,
    customer_id: document.getElementById("trpCustomer").value || null,
    amount:      document.getElementById("trpAmount").value,
    status:      document.getElementById("trpStatus").value,
    trip_date:   document.getElementById("trpDate").value,
  };
  try {
    if (id) {
      await api("/api/trips/" + id, { method: "PUT", body: JSON.stringify(body) });
      showToast("Trip updated", "success");
    } else {
      await api("/api/trips", { method: "POST", body: JSON.stringify(body) });
      showToast("Trip added", "success");
    }
    cancelForm("tripForm", resetTripForm);
    loadTrips();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function editTrip(id) {
  try {
    const trips = await api("/api/trips");
    const t = trips.find((x) => x.trip_id === id);
    if (!t) return;
    await loadTrips(); // ensure selects populated
    document.getElementById("trpId").value = t.trip_id;
    document.getElementById("trpFrom").value = t.from_city;
    document.getElementById("trpTo").value = t.to_city;
    document.getElementById("trpTruck").value = t.truck_id || "";
    document.getElementById("trpDriver").value = t.driver_id || "";
    document.getElementById("trpCustomer").value = t.customer_id || "";
    document.getElementById("trpAmount").value = t.amount;
    document.getElementById("trpStatus").value = t.status;
    document.getElementById("trpDate").value = t.trip_date ? t.trip_date.split("T")[0] : "";
    document.getElementById("tripForm").style.display = "block";
    document.getElementById("tripForm").scrollIntoView({ behavior: "smooth" });
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function deleteTrip(id) {
  if (!confirm("Delete this trip?")) return;
  try {
    await api("/api/trips/" + id, { method: "DELETE" });
    showToast("Trip deleted", "success");
    loadTrips();
  } catch (err) {
    showToast(err.message, "error");
  }
}

function resetTripForm() {
  ["trpId","trpFrom","trpTo","trpAmount"].forEach((id) => {
    document.getElementById(id).value = "";
  });
  document.getElementById("trpTruck").value = "";
  document.getElementById("trpDriver").value = "";
  document.getElementById("trpCustomer").value = "";
  document.getElementById("trpStatus").value = "pending";
  document.getElementById("trpDate").value = "";
}

// ══ FUEL ═════════════════════════════════════════════════════════════════════

async function loadFuel() {
  try {
    const [rows, trucks, drivers] = await Promise.all([
      api("/api/fuel"),
      api("/api/trucks"),
      api("/api/drivers"),
    ]);

    document.getElementById("fuelTruck").innerHTML =
      '<option value="">-- None --</option>' +
      trucks.map((t) => `<option value="${t.truck_id}">${esc(t.truck_no)}</option>`).join("");
    document.getElementById("fuelDriver").innerHTML =
      '<option value="">-- None --</option>' +
      drivers.map((d) => `<option value="${d.driver_id}">${esc(d.name)}</option>`).join("");

    const tbody = document.querySelector("#fuelTable tbody");
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted)">No fuel records yet</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map((f, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(f.truck_no || "—")}</td>
        <td>${esc(f.driver_name || "—")}</td>
        <td>${Number(f.liters).toLocaleString("en-IN")} L</td>
        <td>₹${Number(f.price).toLocaleString("en-IN")}</td>
        <td>${f.fuel_date ? f.fuel_date.split("T")[0] : "—"}</td>
        <td>
          <button class="btn btn-sm btn-danger" onclick="deleteFuel(${f.fuel_id})"><i class="ri-delete-bin-line"></i></button>
        </td>
      </tr>`).join("");
  } catch (err) {
    showToast("Failed to load fuel: " + err.message, "error");
  }
}

async function submitFuel(e) {
  e.preventDefault();
  const body = {
    truck_id:  document.getElementById("fuelTruck").value || null,
    driver_id: document.getElementById("fuelDriver").value || null,
    liters:    document.getElementById("fuelLiters").value,
    price:     document.getElementById("fuelPrice").value,
    fuel_date: document.getElementById("fuelDate").value,
  };
  try {
    await api("/api/fuel", { method: "POST", body: JSON.stringify(body) });
    showToast("Fuel record added", "success");
    cancelForm("fuelForm", resetFuelForm);
    loadFuel();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function deleteFuel(id) {
  if (!confirm("Delete this fuel record?")) return;
  try {
    await api("/api/fuel/" + id, { method: "DELETE" });
    showToast("Fuel record deleted", "success");
    loadFuel();
  } catch (err) {
    showToast(err.message, "error");
  }
}

function resetFuelForm() {
  document.getElementById("fuelTruck").value = "";
  document.getElementById("fuelDriver").value = "";
  document.getElementById("fuelLiters").value = "";
  document.getElementById("fuelPrice").value = "";
  document.getElementById("fuelDate").value = "";
}

// ── Escape HTML to prevent XSS ────────────────────────────────────────────────
function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
