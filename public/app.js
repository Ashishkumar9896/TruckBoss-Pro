const API = "";

const appState = {
  socket: null,
  currentSection: "dashboard",
  currentUser: null,
  tripFiltersBound: false,
  trips: {
    page: 1,
    limit: 10,
    totalTrips: 0,
    totalPages: 1,
    rows: [],
  },
};

const sectionTitles = {
  dashboard: "Dashboard",
  customers: "Customers",
  drivers: "Drivers",
  trucks: "Trucks",
  trips: "Trips",
  fuel: "Fuel Records",
};

const sectionAccess = {
  admin: ["dashboard", "customers", "drivers", "trucks", "trips", "fuel"],
  manager: ["dashboard", "customers", "drivers", "trucks", "trips", "fuel"],
  driver: ["trips"],
};

function getToken() {
  return localStorage.getItem("tbToken");
}

function getCurrentUser() {
  return appState.currentUser || JSON.parse(localStorage.getItem("tbUser") || "null");
}

function getCurrentRole() {
  return getCurrentUser()?.role || "guest";
}

function isAdmin() {
  return getCurrentRole() === "admin";
}

function isManager() {
  return getCurrentRole() === "manager";
}

function isDriver() {
  return getCurrentRole() === "driver";
}

function canManageCustomers() {
  return isAdmin() || isManager();
}

function canManageTrips() {
  return isAdmin() || isManager();
}

function canManageFuel() {
  return isAdmin() || isManager();
}

function canManageDriversAndTrucks() {
  return isAdmin();
}

function canDeleteRecords() {
  return isAdmin();
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };

  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(API + path, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || data.message || "Request failed");
  }

  return data;
}

function showToast(message, type = "info") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.className = "toast";
  }, 3500);
}

function openModal(id) {
  document.getElementById(id).style.display = "flex";
}

function closeModal(id) {
  document.getElementById(id).style.display = "none";
}

function switchModal(from, to) {
  closeModal(from);
  openModal(to);
}

function togglePassword(inputId, icon) {
  const element = document.getElementById(inputId);
  if (element.type === "password") {
    element.type = "text";
    icon.classList.replace("ri-eye-line", "ri-eye-off-line");
  } else {
    element.type = "password";
    icon.classList.replace("ri-eye-off-line", "ri-eye-line");
  }
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function downloadReport(path, filename) {
  try {
    const res = await fetch(API + path, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.message || "Download failed");
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    showToast(err.message, "error");
  }
}

function downloadTripsPDF() {
  return downloadReport("/api/reports/trips/pdf", "trip-report.pdf");
}

function downloadTripsExcel() {
  return downloadReport("/api/reports/trips/excel", "trip-report.xlsx");
}

function downloadFuelExcel() {
  return downloadReport("/api/reports/fuel/excel", "fuel-report.xlsx");
}

function downloadRevenueExcel() {
  return downloadReport("/api/reports/revenue/monthly/excel", "monthly-revenue-report.xlsx");
}

async function handleLogin(event) {
  event.preventDefault();

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

async function handleRegister(event) {
  event.preventDefault();

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
  if (appState.socket) {
    appState.socket.disconnect();
    appState.socket = null;
  }

  localStorage.removeItem("tbToken");
  localStorage.removeItem("tbUser");
  appState.currentUser = null;

  document.getElementById("dashboardPage").style.display = "none";
  document.getElementById("landingPage").style.display = "block";
  history.pushState({}, "", "/");
}

function getDefaultSectionForRole(role) {
  return role === "driver" ? "trips" : "dashboard";
}

function enterDashboard(user) {
  appState.currentUser = user;
  document.getElementById("landingPage").style.display = "none";
  document.getElementById("dashboardPage").style.display = "block";
  document.getElementById("userGreeting").textContent = user.full_name || user.email.split("@")[0];
  document.getElementById("userRoleLabel").textContent = `${user.role} access`;

  applyRolePermissions(user);
  bindTripFilterEvents();
  initRealtime();

  const defaultSection = getDefaultSectionForRole(user.role);
  navigate(defaultSection);
  history.replaceState({ section: defaultSection }, "", `/${defaultSection}`);
}

function applyRolePermissions(user) {
  const allowedSections = sectionAccess[user.role] || [];

  document.querySelectorAll(".nav-item").forEach((button) => {
    button.style.display = allowedSections.includes(button.dataset.section) ? "flex" : "none";
  });

  toggleElements(".admin-only", isAdmin());
  toggleElements(".manage-customers", canManageCustomers());
  toggleElements(".manage-trips", canManageTrips());
  toggleElements(".manage-fuel", canManageFuel());
  toggleElements(".admin-panel", isAdmin() || isManager());

  const driverFilter = document.getElementById("tripDriverFilter");
  if (isDriver()) {
    driverFilter.value = user.full_name || user.email.split("@")[0];
    driverFilter.disabled = true;
  } else {
    driverFilter.disabled = false;
  }
}

function toggleElements(selector, shouldShow) {
  document.querySelectorAll(selector).forEach((element) => {
    element.style.display = shouldShow ? "inline-flex" : "none";
  });
}

function initRealtime() {
  const token = getToken();
  if (!token || typeof io === "undefined") return;
  if (appState.socket && appState.socket.connected) return;

  const socketStatus = document.getElementById("socketStatus");
  appState.socket = io({ auth: { token } });

  appState.socket.on("connect", () => {
    socketStatus.textContent = "Live";
  });

  appState.socket.on("disconnect", () => {
    socketStatus.textContent = "Offline";
  });

  appState.socket.on("new_trip", () => {
    if (appState.currentSection === "trips") {
      loadTrips(appState.trips.page);
    }
    queueDashboardRefresh();
    showToast("New trip recorded", "success");
  });

  appState.socket.on("fuel_update", () => {
    if (appState.currentSection === "fuel") {
      loadFuel();
    }
    queueDashboardRefresh();
    showToast("Fuel log updated", "info");
  });

  appState.socket.on("truck_location_update", () => {
    if (appState.currentSection === "trucks") {
      loadTrucks();
    }
  });
}

window.addEventListener("popstate", (event) => {
  const section = event.state?.section;
  if (section) {
    navigate(section, false);
  }
});

function navigate(section, pushState = true) {
  const allowedSections = sectionAccess[getCurrentRole()] || [];
  const safeSection = allowedSections.includes(section) ? section : getDefaultSectionForRole(getCurrentRole());

  appState.currentSection = safeSection;

  document.querySelectorAll(".section-content").forEach((sectionElement) => {
    sectionElement.style.display = "none";
  });

  const target = document.getElementById(`section${capitalize(safeSection)}`);
  if (target) {
    target.style.display = "block";
  }

  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.section === safeSection);
  });

  document.getElementById("pageTitle").textContent = sectionTitles[safeSection] || capitalize(safeSection);

  const loaders = {
    dashboard: loadDashboard,
    customers: loadCustomers,
    drivers: loadDrivers,
    trucks: loadTrucks,
    trips: () => loadTrips(appState.trips.page),
    fuel: loadFuel,
  };

  if (loaders[safeSection]) {
    loaders[safeSection]();
  }

  if (pushState) {
    history.pushState({ section: safeSection }, "", `/${safeSection}`);
  }
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function toggleForm(formId) {
  const element = document.getElementById(formId);
  element.style.display = element.style.display === "none" ? "block" : "none";
}

function cancelForm(formId, resetFn) {
  document.getElementById(formId).style.display = "none";
  if (resetFn) {
    resetFn();
  }
}

function bindTripFilterEvents() {
  if (appState.tripFiltersBound) return;

  ["tripDriverFilter", "tripTruckFilter", "tripDateFilter", "tripStatusFilter"].forEach((id) => {
    const element = document.getElementById(id);
    const eventName = element.tagName === "SELECT" || element.type === "date" ? "change" : "input";
    element.addEventListener(eventName, debounce(() => loadTrips(1), 300));
  });

  appState.tripFiltersBound = true;
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

let revenueChart = null;
let truckChart = null;
let fuelTrendChart = null;
let dashboardRefreshTimer = null;
let dashboardLoadInFlight = null;

function destroyChart(chart) {
  if (chart) {
    chart.destroy();
  }
}

async function loadDashboard() {
  if (isDriver()) return;

  if (dashboardLoadInFlight) {
    return dashboardLoadInFlight;
  }

  dashboardLoadInFlight = (async () => {
    try {
      const [metrics, analytics] = await Promise.all([
        api("/api/dashboard/metrics"),
        api("/api/dashboard/analytics"),
      ]);
      renderStatCards(metrics);
      renderRevenueChart(analytics.monthlyRevenue || []);
      renderFuelTrendChart(analytics.monthlyFuelCost || []);
    } catch (err) {
      showToast(`Failed to load dashboard: ${err.message}`, "error");
    } finally {
      dashboardLoadInFlight = null;
    }
  })();

  return dashboardLoadInFlight;
}

function queueDashboardRefresh() {
  if (isDriver() || appState.currentSection !== "dashboard") {
    return;
  }

  clearTimeout(dashboardRefreshTimer);
  dashboardRefreshTimer = setTimeout(() => {
    loadDashboard();
  }, 400);
}

function renderStatCards(metrics) {
  document.getElementById("dashboardCards").innerHTML = `
    <article class="stat-card highlight-card">
      <div class="stat-icon blue"><i class="ri-truck-line"></i></div>
      <div class="stat-copy">
        <span class="stat-label">Total Trucks</span>
        <strong class="stat-value">${Number(metrics.totalTrucks || 0).toLocaleString("en-IN")}</strong>
      </div>
    </article>
    <article class="stat-card">
      <div class="stat-icon teal"><i class="ri-route-line"></i></div>
      <div class="stat-copy">
        <span class="stat-label">Active Trucks</span>
        <strong class="stat-value">${Number(metrics.activeTrucks || 0).toLocaleString("en-IN")}</strong>
      </div>
    </article>
    <article class="stat-card">
      <div class="stat-icon gold"><i class="ri-money-rupee-circle-line"></i></div>
      <div class="stat-copy">
        <span class="stat-label">Monthly Revenue</span>
        <strong class="stat-value">${formatCurrency(metrics.monthlyRevenue)}</strong>
      </div>
    </article>
    <article class="stat-card">
      <div class="stat-icon red"><i class="ri-fuel-line"></i></div>
      <div class="stat-copy">
        <span class="stat-label">Fuel Expenses</span>
        <strong class="stat-value">${formatCurrency(metrics.fuelExpenses)}</strong>
      </div>
    </article>
    <article class="stat-card">
      <div class="stat-icon green"><i class="ri-line-chart-line"></i></div>
      <div class="stat-copy">
        <span class="stat-label">Profit</span>
        <strong class="stat-value">${formatCurrency(metrics.profit)}</strong>
      </div>
    </article>
  `;
}

function renderRevenueChart(data) {
  destroyChart(revenueChart);
  const ctx = document.getElementById("revenueChart").getContext("2d");
  revenueChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.map((item) => item.month),
      datasets: [{
        label: "Revenue (₹)",
        data: data.map((item) => item.revenue),
        backgroundColor: "rgba(249, 115, 22, 0.78)",
        borderRadius: 14,
        borderSkipped: false,
      }],
    },
    options: getChartOptions(),
  });
}

function renderFuelTrendChart(data) {
  destroyChart(fuelTrendChart);
  const ctx = document.getElementById("fuelTrendChart").getContext("2d");
  fuelTrendChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: data.map((item) => item.month),
      datasets: [{
        label: "Fuel Cost (₹)",
        data: data.map((item) => item.fuelCost),
        borderColor: "#22d3ee",
        backgroundColor: "rgba(34, 211, 238, 0.14)",
        fill: true,
        tension: 0.35,
      }],
    },
    options: getChartOptions(),
  });
}

function getChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: "#d7dfeb",
          font: { family: "Manrope" },
        },
      },
    },
    scales: {
      x: {
        ticks: { color: "#90a0b8" },
        grid: { color: "rgba(128, 145, 171, 0.12)" },
      },
      y: {
        ticks: { color: "#90a0b8" },
        grid: { color: "rgba(128, 145, 171, 0.12)" },
      },
    },
  };
}

async function loadCustomers() {
  try {
    const rows = await api("/api/customers");
    const tbody = document.querySelector("#customerTable tbody");

    if (!rows.length) {
      tbody.innerHTML = emptyTableRow(7, "No customers yet");
      return;
    }

    tbody.innerHTML = rows.map((customer, index) => {
      const actions = canManageCustomers()
        ? `
          <div class="table-actions">
            <button class="icon-btn" onclick="editCustomer(${customer.customer_id})"><i class="ri-edit-line"></i></button>
            ${canDeleteRecords() ? `<button class="icon-btn danger" onclick="deleteCustomer(${customer.customer_id})"><i class="ri-delete-bin-line"></i></button>` : ""}
          </div>
        `
        : '<span class="muted-label">Read only</span>';

      return `
        <tr>
          <td>${index + 1}</td>
          <td>${esc(customer.name)}</td>
          <td>${esc(customer.phone_no || "—")}</td>
          <td>${esc(customer.address || "—")}</td>
          <td>${formatCurrency(customer.amount_paid)}</td>
          <td>${formatCurrency(customer.balance)}</td>
          <td>${actions}</td>
        </tr>
      `;
    }).join("");
  } catch (err) {
    showToast(`Failed to load customers: ${err.message}`, "error");
  }
}

async function submitCustomer(event) {
  event.preventDefault();
  const id = document.getElementById("custId").value;
  const body = {
    name: document.getElementById("custName").value,
    phone_no: document.getElementById("custPhone").value,
    address: document.getElementById("custAddress").value,
    amount_paid: document.getElementById("custAmountPaid").value,
    balance: document.getElementById("custBalance").value,
  };

  try {
    if (id) {
      await api(`/api/customers/${id}`, { method: "PUT", body: JSON.stringify(body) });
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
    const customer = await api(`/api/customers/${id}`);
    document.getElementById("custId").value = customer.customer_id;
    document.getElementById("custName").value = customer.name;
    document.getElementById("custPhone").value = customer.phone_no || "";
    document.getElementById("custAddress").value = customer.address || "";
    document.getElementById("custAmountPaid").value = customer.amount_paid;
    document.getElementById("custBalance").value = customer.balance;
    document.getElementById("customerForm").style.display = "block";
    document.getElementById("customerForm").scrollIntoView({ behavior: "smooth" });
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function deleteCustomer(id) {
  if (!canDeleteRecords()) return;
  if (!confirm("Delete this customer?")) return;
  try {
    await api(`/api/customers/${id}`, { method: "DELETE" });
    showToast("Customer deleted", "success");
    loadCustomers();
  } catch (err) {
    showToast(err.message, "error");
  }
}

function resetCustomerForm() {
  ["custId", "custName", "custPhone", "custAddress"].forEach((id) => {
    document.getElementById(id).value = "";
  });
  document.getElementById("custAmountPaid").value = 0;
  document.getElementById("custBalance").value = 0;
}

async function loadDrivers() {
  try {
    const rows = await api("/api/drivers");
    const tbody = document.querySelector("#driverTable tbody");

    if (!rows.length) {
      tbody.innerHTML = emptyTableRow(7, "No drivers yet");
      return;
    }

    tbody.innerHTML = rows.map((driver, index) => {
      const actions = canManageDriversAndTrucks()
        ? `
          <div class="table-actions">
            <button class="icon-btn" onclick="editDriver(${driver.driver_id})"><i class="ri-edit-line"></i></button>
            <button class="icon-btn danger" onclick="deleteDriver(${driver.driver_id})"><i class="ri-delete-bin-line"></i></button>
          </div>
        `
        : '<span class="muted-label">Read only</span>';

      return `
        <tr>
          <td>${index + 1}</td>
          <td>${esc(driver.name)}</td>
          <td>${esc(driver.licence_no)}</td>
          <td>${esc(driver.phone_no || "—")}</td>
          <td>${formatCurrency(driver.salary)}</td>
          <td><span class="badge badge-${slugify(driver.status || "active")}">${esc(driver.status || "active")}</span></td>
          <td>${actions}</td>
        </tr>
      `;
    }).join("");
  } catch (err) {
    showToast(`Failed to load drivers: ${err.message}`, "error");
  }
}

async function submitDriver(event) {
  event.preventDefault();
  const id = document.getElementById("drvId").value;
  const body = {
    name: document.getElementById("drvName").value,
    licence_no: document.getElementById("drvLicence").value,
    phone_no: document.getElementById("drvPhone").value,
    address: document.getElementById("drvAddress").value,
    salary: document.getElementById("drvSalary").value,
    status: "active",
  };

  try {
    if (id) {
      await api(`/api/drivers/${id}`, { method: "PUT", body: JSON.stringify(body) });
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
    const driver = await api(`/api/drivers/${id}`);
    document.getElementById("drvId").value = driver.driver_id;
    document.getElementById("drvName").value = driver.name;
    document.getElementById("drvLicence").value = driver.licence_no;
    document.getElementById("drvPhone").value = driver.phone_no || "";
    document.getElementById("drvAddress").value = driver.address || "";
    document.getElementById("drvSalary").value = driver.salary;
    document.getElementById("driverForm").style.display = "block";
    document.getElementById("driverForm").scrollIntoView({ behavior: "smooth" });
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function deleteDriver(id) {
  if (!canDeleteRecords()) return;
  if (!confirm("Delete this driver?")) return;
  try {
    await api(`/api/drivers/${id}`, { method: "DELETE" });
    showToast("Driver deleted", "success");
    loadDrivers();
  } catch (err) {
    showToast(err.message, "error");
  }
}

function resetDriverForm() {
  ["drvId", "drvName", "drvLicence", "drvPhone", "drvAddress"].forEach((id) => {
    document.getElementById(id).value = "";
  });
  document.getElementById("drvSalary").value = 0;
}

async function loadTrucks() {
  try {
    const [rows, statusData] = await Promise.all([
      api("/api/trucks"),
      api("/api/trucks/summary/status"),
    ]);

    const tbody = document.querySelector("#truckTable tbody");
    if (!rows.length) {
      tbody.innerHTML = emptyTableRow(6, "No trucks yet");
    } else {
      tbody.innerHTML = rows.map((truck, index) => {
        const actions = canManageDriversAndTrucks()
          ? `
            <div class="table-actions">
              <button class="icon-btn" onclick="editTruck(${truck.truck_id})"><i class="ri-edit-line"></i></button>
              <button class="icon-btn danger" onclick="deleteTruck(${truck.truck_id})"><i class="ri-delete-bin-line"></i></button>
            </div>
          `
          : '<span class="muted-label">Read only</span>';

        return `
          <tr>
            <td>${index + 1}</td>
            <td>${esc(truck.truck_no)}</td>
            <td>${esc(truck.driver_name || "—")}</td>
            <td><span class="badge badge-${slugify(truck.status)}">${esc(truck.status)}</span></td>
            <td>${esc(truck.maintenance)}</td>
            <td>${actions}</td>
          </tr>
        `;
      }).join("");
    }

    renderTruckChart(statusData);
    if (canManageDriversAndTrucks()) {
      await populateTruckDriverSelect();
    }
  } catch (err) {
    showToast(`Failed to load trucks: ${err.message}`, "error");
  }
}

async function populateTruckDriverSelect() {
  try {
    const drivers = await api("/api/drivers");
    const select = document.getElementById("trkDriver");
    const currentValue = select.value;
    select.innerHTML = '<option value="">-- None --</option>' + drivers.map((driver) => `<option value="${driver.driver_id}">${esc(driver.name)}</option>`).join("");
    select.value = currentValue;
  } catch (err) {
    showToast(`Failed to load driver list: ${err.message}`, "error");
  }
}

function renderTruckChart(data) {
  destroyChart(truckChart);
  const ctx = document.getElementById("truckChart").getContext("2d");
  truckChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: data.map((item) => item.status),
      datasets: [{
        data: data.map((item) => item.count),
        backgroundColor: ["#1d4ed8", "#f97316", "#22c55e", "#eab308"],
        borderColor: "rgba(12, 16, 26, 0.95)",
        borderWidth: 4,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: {
            color: "#d7dfeb",
            font: { family: "Manrope" },
          },
        },
      },
    },
  });
}

async function submitTruck(event) {
  event.preventDefault();
  const id = document.getElementById("trkId").value;
  const body = {
    truck_no: document.getElementById("trkNo").value,
    driver_id: document.getElementById("trkDriver").value || null,
    status: document.getElementById("trkStatus").value,
    maintenance: document.getElementById("trkMaintenance").value,
  };

  try {
    if (id) {
      await api(`/api/trucks/${id}`, { method: "PUT", body: JSON.stringify(body) });
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
    const truck = await api(`/api/trucks/${id}`);
    await populateTruckDriverSelect();
    document.getElementById("trkId").value = truck.truck_id;
    document.getElementById("trkNo").value = truck.truck_no;
    document.getElementById("trkDriver").value = truck.driver_id || "";
    document.getElementById("trkStatus").value = truck.status;
    document.getElementById("trkMaintenance").value = truck.maintenance;
    document.getElementById("truckForm").style.display = "block";
    document.getElementById("truckForm").scrollIntoView({ behavior: "smooth" });
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function deleteTruck(id) {
  if (!canDeleteRecords()) return;
  if (!confirm("Delete this truck?")) return;
  try {
    await api(`/api/trucks/${id}`, { method: "DELETE" });
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

function collectTripFilters() {
  const user = getCurrentUser();
  return {
    driver: isDriver() ? (user?.full_name || user?.email?.split("@")[0] || "") : document.getElementById("tripDriverFilter").value.trim(),
    truck: document.getElementById("tripTruckFilter").value.trim(),
    date: document.getElementById("tripDateFilter").value,
    status: document.getElementById("tripStatusFilter").value,
  };
}

function buildTripQuery(page) {
  const params = new URLSearchParams();
  const filters = collectTripFilters();

  params.set("page", String(page));
  params.set("limit", String(appState.trips.limit));

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  return params.toString();
}

async function loadTrips(page = 1) {
  try {
    const requests = [api(`/api/trips?${buildTripQuery(page)}`)];

    if (canManageTrips()) {
      requests.push(api("/api/trucks"), api("/api/drivers"), api("/api/customers"));
    }

    const [tripResponse, trucks = [], drivers = [], customers = []] = await Promise.all(requests);

    appState.trips.page = Number(tripResponse.page || page);
    appState.trips.totalTrips = Number(tripResponse.totalTrips || 0);
    appState.trips.totalPages = Math.max(Math.ceil(appState.trips.totalTrips / appState.trips.limit), 1);
    appState.trips.rows = Array.isArray(tripResponse.data) ? tripResponse.data : [];

    if (canManageTrips()) {
      populateTripFormSelects(trucks, drivers, customers);
    }

    renderTripTable();
    renderTripPagination();
  } catch (err) {
    showToast(`Failed to load trips: ${err.message}`, "error");
  }
}

function populateTripFormSelects(trucks, drivers, customers) {
  setSelectOptions("trpTruck", trucks.map((truck) => ({ value: truck.truck_id, label: truck.truck_no })));
  setSelectOptions("trpDriver", drivers.map((driver) => ({ value: driver.driver_id, label: driver.name })));
  setSelectOptions("trpCustomer", customers.map((customer) => ({ value: customer.customer_id, label: customer.name })));
}

function setSelectOptions(selectId, options) {
  const select = document.getElementById(selectId);
  const currentValue = select.value;
  select.innerHTML = '<option value="">-- None --</option>' + options.map((option) => `<option value="${option.value}">${esc(option.label)}</option>`).join("");
  select.value = currentValue;
}

function renderTripTable() {
  const tbody = document.querySelector("#tripTable tbody");

  if (!appState.trips.rows.length) {
    tbody.innerHTML = emptyTableRow(9, isDriver() ? "No assigned trips found" : "No trips found for these filters");
    return;
  }

  const rowOffset = (appState.trips.page - 1) * appState.trips.limit;

  tbody.innerHTML = appState.trips.rows.map((trip, index) => {
    const actions = canManageTrips()
      ? `
        <div class="table-actions">
          <button class="icon-btn" onclick="editTrip(${trip.trip_id})"><i class="ri-edit-line"></i></button>
          ${canDeleteRecords() ? `<button class="icon-btn danger" onclick="deleteTrip(${trip.trip_id})"><i class="ri-delete-bin-line"></i></button>` : ""}
        </div>
      `
      : '<span class="muted-label">Assigned</span>';

    return `
      <tr>
        <td>${rowOffset + index + 1}</td>
        <td>
          <div class="route-cell">
            <strong>${esc(trip.from_city)}</strong>
            <span><i class="ri-arrow-right-line"></i></span>
            <strong>${esc(trip.to_city)}</strong>
          </div>
        </td>
        <td>${esc(trip.truck_no || "—")}</td>
        <td>${esc(trip.driver_name || "—")}</td>
        <td>${esc(trip.customer_name || "—")}</td>
        <td>${formatDate(trip.trip_date)}</td>
        <td><span class="badge badge-${slugify(trip.status)}">${esc(trip.status)}</span></td>
        <td>${formatCurrency(trip.amount)}</td>
        <td>${actions}</td>
      </tr>
    `;
  }).join("");
}

function renderTripPagination() {
  document.getElementById("tripPaginationMeta").textContent = `Page ${appState.trips.page} of ${appState.trips.totalPages} • ${appState.trips.totalTrips} trips`;
  document.getElementById("tripPrevBtn").disabled = appState.trips.page <= 1;
  document.getElementById("tripNextBtn").disabled = appState.trips.page >= appState.trips.totalPages;
}

function changeTripPage(direction) {
  const nextPage = appState.trips.page + direction;
  if (nextPage < 1 || nextPage > appState.trips.totalPages) {
    return;
  }
  loadTrips(nextPage);
}

function resetTripFilters() {
  document.getElementById("tripTruckFilter").value = "";
  document.getElementById("tripDateFilter").value = "";
  document.getElementById("tripStatusFilter").value = "";
  if (!isDriver()) {
    document.getElementById("tripDriverFilter").value = "";
  }
  loadTrips(1);
}

async function submitTrip(event) {
  event.preventDefault();
  const id = document.getElementById("trpId").value;
  const body = {
    from_city: document.getElementById("trpFrom").value,
    to_city: document.getElementById("trpTo").value,
    truck_id: document.getElementById("trpTruck").value || null,
    driver_id: document.getElementById("trpDriver").value || null,
    customer_id: document.getElementById("trpCustomer").value || null,
    amount: document.getElementById("trpAmount").value,
    status: document.getElementById("trpStatus").value,
    trip_date: document.getElementById("trpDate").value,
  };

  try {
    if (id) {
      await api(`/api/trips/${id}`, { method: "PUT", body: JSON.stringify(body) });
      showToast("Trip updated", "success");
    } else {
      await api("/api/trips", { method: "POST", body: JSON.stringify(body) });
      showToast("Trip added", "success");
    }

    cancelForm("tripForm", resetTripForm);
    loadTrips(appState.trips.page);
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function editTrip(id) {
  if (!canManageTrips()) return;

  const trip = appState.trips.rows.find((row) => row.trip_id === id);
  if (!trip) {
    showToast("Trip not available on this page. Use filters to locate it.", "info");
    return;
  }

  await loadTrips(appState.trips.page);
  document.getElementById("trpId").value = trip.trip_id;
  document.getElementById("trpFrom").value = trip.from_city;
  document.getElementById("trpTo").value = trip.to_city;
  document.getElementById("trpTruck").value = trip.truck_id || "";
  document.getElementById("trpDriver").value = trip.driver_id || "";
  document.getElementById("trpCustomer").value = trip.customer_id || "";
  document.getElementById("trpAmount").value = trip.amount;
  document.getElementById("trpStatus").value = trip.status;
  document.getElementById("trpDate").value = trip.trip_date ? trip.trip_date.split("T")[0] : "";
  document.getElementById("tripForm").style.display = "block";
  document.getElementById("tripForm").scrollIntoView({ behavior: "smooth" });
}

async function deleteTrip(id) {
  if (!canDeleteRecords()) return;
  if (!confirm("Delete this trip?")) return;
  try {
    await api(`/api/trips/${id}`, { method: "DELETE" });
    showToast("Trip deleted", "success");
    const nextPage = appState.trips.rows.length === 1 && appState.trips.page > 1 ? appState.trips.page - 1 : appState.trips.page;
    loadTrips(nextPage);
  } catch (err) {
    showToast(err.message, "error");
  }
}

function resetTripForm() {
  ["trpId", "trpFrom", "trpTo", "trpAmount", "trpDate"].forEach((id) => {
    document.getElementById(id).value = "";
  });
  document.getElementById("trpTruck").value = "";
  document.getElementById("trpDriver").value = "";
  document.getElementById("trpCustomer").value = "";
  document.getElementById("trpStatus").value = "pending";
}

async function loadFuel() {
  try {
    const requests = [api("/api/fuel")];
    if (canManageFuel()) {
      requests.push(api("/api/trucks"), api("/api/drivers"));
    }

    const [rows, trucks = [], drivers = []] = await Promise.all(requests);

    if (canManageFuel()) {
      setSelectOptions("fuelTruck", trucks.map((truck) => ({ value: truck.truck_id, label: truck.truck_no })));
      setSelectOptions("fuelDriver", drivers.map((driver) => ({ value: driver.driver_id, label: driver.name })));
    }

    const tbody = document.querySelector("#fuelTable tbody");
    if (!rows.length) {
      tbody.innerHTML = emptyTableRow(7, "No fuel records yet");
      return;
    }

    tbody.innerHTML = rows.map((fuel, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${esc(fuel.truck_no || "—")}</td>
        <td>${esc(fuel.driver_name || "—")}</td>
        <td>${Number(fuel.liters || 0).toLocaleString("en-IN")} L</td>
        <td>${formatCurrency(fuel.price)}</td>
        <td>${formatDate(fuel.fuel_date)}</td>
        <td>${canDeleteRecords() ? `<div class="table-actions"><button class="icon-btn danger" onclick="deleteFuel(${fuel.fuel_id})"><i class="ri-delete-bin-line"></i></button></div>` : '<span class="muted-label">Read only</span>'}</td>
      </tr>
    `).join("");
  } catch (err) {
    showToast(`Failed to load fuel: ${err.message}`, "error");
  }
}

async function submitFuel(event) {
  event.preventDefault();
  const body = {
    truck_id: document.getElementById("fuelTruck").value || null,
    driver_id: document.getElementById("fuelDriver").value || null,
    liters: document.getElementById("fuelLiters").value,
    price: document.getElementById("fuelPrice").value,
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
  if (!canDeleteRecords()) return;
  if (!confirm("Delete this fuel record?")) return;
  try {
    await api(`/api/fuel/${id}`, { method: "DELETE" });
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

function emptyTableRow(colspan, label) {
  return `<tr><td colspan="${colspan}" class="empty-state-cell">${esc(label)}</td></tr>`;
}

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function formatDate(value) {
  if (!value) return "—";
  return String(value).split("T")[0];
}

function slugify(value) {
  return String(value || "unknown").toLowerCase().replace(/\s+/g, "-");
}

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

(function autoLogin() {
  const token = getToken();
  const user = JSON.parse(localStorage.getItem("tbUser") || "null");
  if (token && user) {
    enterDashboard(user);
  }
})();