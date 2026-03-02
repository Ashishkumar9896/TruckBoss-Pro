require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ── Rate limiters ──────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

// ── Database pool ──────────────────────────────────────────────────────────────
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "trucks",
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

(async () => {
  try {
    await pool.query("SELECT 1");
    console.log("✅ MySQL connected successfully");
  } catch (err) {
    console.error("❌ MySQL connection failed:", err.message);
  }
})();

// ── JWT middleware ─────────────────────────────────────────────────────────────
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Access token required" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(403).json({ error: "Invalid or expired token" });
  }
}

// ── Auth routes ────────────────────────────────────────────────────────────────
app.post("/api/auth/register", authLimiter, async (req, res) => {
  try {
    const { email, password, full_name } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email and password are required" });

    const [existing] = await pool.query(
      "SELECT user_id FROM users WHERE email = ?",
      [email]
    );
    if (existing.length > 0)
      return res.status(409).json({ error: "Email already registered" });

    const hashed = await bcrypt.hash(password, 12);
    const [result] = await pool.query(
      "INSERT INTO users (email, password, full_name) VALUES (?, ?, ?)",
      [email, hashed, full_name || null]
    );
    const token = jwt.sign(
      { user_id: result.insertId, email, role: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );
    return res.status(201).json({
      token,
      user: { user_id: result.insertId, email, full_name: full_name || null, role: "admin" },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/auth/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email and password are required" });

    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
    if (rows.length === 0)
      return res.status(401).json({ error: "Invalid credentials" });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { user_id: user.user_id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );
    return res.json({
      token,
      user: { user_id: user.user_id, email: user.email, full_name: user.full_name, role: user.role },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ── Dashboard ──────────────────────────────────────────────────────────────────
app.get("/api/dashboard/stats", apiLimiter, authenticateToken, async (req, res) => {
  try {
    const [[customers]] = await pool.query("SELECT COUNT(*) AS count FROM customers");
    const [[revenue]] = await pool.query("SELECT COALESCE(SUM(amount_paid), 0) AS total FROM customers");
    const [[trucks]] = await pool.query("SELECT COUNT(*) AS count FROM truck_details");
    const [truckStatus] = await pool.query(
      "SELECT status, COUNT(*) AS count FROM truck_details GROUP BY status"
    );
    const [[trips]] = await pool.query("SELECT COUNT(*) AS count FROM trips");
    const [[drivers]] = await pool.query("SELECT COUNT(*) AS count FROM driver_details");
    const [[fuel]] = await pool.query("SELECT COALESCE(SUM(price), 0) AS total FROM fuel_details");

    const statusMap = {};
    truckStatus.forEach((r) => { statusMap[r.status] = r.count; });

    return res.json({
      customers: customers.count,
      revenue: revenue.total,
      trucks: trucks.count,
      trucksAvailable: statusMap["Available"] || 0,
      trucksInUse: statusMap["In Use"] || 0,
      trucksMaintenance: statusMap["Maintenance"] || 0,
      trips: trips.count,
      drivers: drivers.count,
      fuelCost: fuel.total,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/dashboard/revenue-chart", apiLimiter, authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT name, amount_paid FROM customers ORDER BY amount_paid DESC LIMIT 10"
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ── Customers ──────────────────────────────────────────────────────────────────
app.get("/api/customers", apiLimiter, authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM customers ORDER BY created_at DESC");
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/customers/:id", apiLimiter, authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM customers WHERE customer_id = ?",
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Customer not found" });
    return res.json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/customers", apiLimiter, authenticateToken, async (req, res) => {
  try {
    const { name, phone_no, address, amount_paid = 0, balance = 0 } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    const [result] = await pool.query(
      "INSERT INTO customers (name, phone_no, address, amount_paid, balance) VALUES (?, ?, ?, ?, ?)",
      [name, phone_no || null, address || null, amount_paid, balance]
    );
    return res.status(201).json({ customer_id: result.insertId, message: "Customer created" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.put("/api/customers/:id", apiLimiter, authenticateToken, async (req, res) => {
  try {
    const { name, phone_no, address, amount_paid, balance } = req.body;
    const [result] = await pool.query(
      "UPDATE customers SET name=?, phone_no=?, address=?, amount_paid=?, balance=? WHERE customer_id=?",
      [name, phone_no || null, address || null, amount_paid, balance, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: "Customer not found" });
    return res.json({ message: "Customer updated" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.delete("/api/customers/:id", apiLimiter, authenticateToken, async (req, res) => {
  try {
    const [result] = await pool.query(
      "DELETE FROM customers WHERE customer_id = ?",
      [req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: "Customer not found" });
    return res.json({ message: "Customer deleted" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ── Drivers ────────────────────────────────────────────────────────────────────
app.get("/api/drivers", apiLimiter, authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM driver_details ORDER BY created_at DESC");
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/drivers/:id", apiLimiter, authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM driver_details WHERE driver_id = ?",
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Driver not found" });
    return res.json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/drivers", apiLimiter, authenticateToken, async (req, res) => {
  try {
    const { name, licence_no, phone_no, address, salary = 0 } = req.body;
    if (!name || !licence_no)
      return res.status(400).json({ error: "Name and licence number are required" });
    const [result] = await pool.query(
      "INSERT INTO driver_details (name, licence_no, phone_no, address, salary) VALUES (?, ?, ?, ?, ?)",
      [name, licence_no, phone_no || null, address || null, salary]
    );
    return res.status(201).json({ driver_id: result.insertId, message: "Driver created" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY")
      return res.status(409).json({ error: "Licence number already exists" });
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.put("/api/drivers/:id", apiLimiter, authenticateToken, async (req, res) => {
  try {
    const { name, licence_no, phone_no, address, salary, status } = req.body;
    const [result] = await pool.query(
      "UPDATE driver_details SET name=?, licence_no=?, phone_no=?, address=?, salary=?, status=? WHERE driver_id=?",
      [name, licence_no, phone_no || null, address || null, salary, status, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: "Driver not found" });
    return res.json({ message: "Driver updated" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY")
      return res.status(409).json({ error: "Licence number already exists" });
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.delete("/api/drivers/:id", apiLimiter, authenticateToken, async (req, res) => {
  try {
    const [result] = await pool.query(
      "DELETE FROM driver_details WHERE driver_id = ?",
      [req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: "Driver not found" });
    return res.json({ message: "Driver deleted" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ── Trucks ─────────────────────────────────────────────────────────────────────
app.get("/api/trucks/summary/status", apiLimiter, authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT status, COUNT(*) AS count FROM truck_details GROUP BY status"
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/trucks", apiLimiter, authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.*, d.name AS driver_name
       FROM truck_details t
       LEFT JOIN driver_details d ON t.driver_id = d.driver_id
       ORDER BY t.created_at DESC`
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/trucks/:id", apiLimiter, authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.*, d.name AS driver_name
       FROM truck_details t
       LEFT JOIN driver_details d ON t.driver_id = d.driver_id
       WHERE t.truck_id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Truck not found" });
    return res.json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/trucks", apiLimiter, authenticateToken, async (req, res) => {
  try {
    const { truck_no, driver_id, status = "Available", maintenance = "Not Required" } = req.body;
    if (!truck_no) return res.status(400).json({ error: "Truck number is required" });
    const [result] = await pool.query(
      "INSERT INTO truck_details (truck_no, driver_id, status, maintenance) VALUES (?, ?, ?, ?)",
      [truck_no, driver_id || null, status, maintenance]
    );
    return res.status(201).json({ truck_id: result.insertId, message: "Truck created" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY")
      return res.status(409).json({ error: "Truck number already exists" });
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.put("/api/trucks/:id", apiLimiter, authenticateToken, async (req, res) => {
  try {
    const { truck_no, driver_id, status, maintenance } = req.body;
    const [result] = await pool.query(
      "UPDATE truck_details SET truck_no=?, driver_id=?, status=?, maintenance=? WHERE truck_id=?",
      [truck_no, driver_id || null, status, maintenance, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: "Truck not found" });
    return res.json({ message: "Truck updated" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY")
      return res.status(409).json({ error: "Truck number already exists" });
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.delete("/api/trucks/:id", apiLimiter, authenticateToken, async (req, res) => {
  try {
    const [result] = await pool.query(
      "DELETE FROM truck_details WHERE truck_id = ?",
      [req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: "Truck not found" });
    return res.json({ message: "Truck deleted" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ── Trips ──────────────────────────────────────────────────────────────────────
app.get("/api/trips", apiLimiter, authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT tr.*,
              t.truck_no,
              d.name  AS driver_name,
              c.name  AS customer_name
       FROM trips tr
       LEFT JOIN truck_details  t ON tr.truck_id    = t.truck_id
       LEFT JOIN driver_details d ON tr.driver_id   = d.driver_id
       LEFT JOIN customers      c ON tr.customer_id = c.customer_id
       ORDER BY tr.trip_date DESC`
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/trips", apiLimiter, authenticateToken, async (req, res) => {
  try {
    const { from_city, to_city, truck_id, driver_id, customer_id, amount = 0, status = "pending", trip_date } = req.body;
    if (!from_city || !to_city || !trip_date)
      return res.status(400).json({ error: "from_city, to_city and trip_date are required" });
    const [result] = await pool.query(
      "INSERT INTO trips (from_city, to_city, truck_id, driver_id, customer_id, amount, status, trip_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [from_city, to_city, truck_id || null, driver_id || null, customer_id || null, amount, status, trip_date]
    );
    return res.status(201).json({ trip_id: result.insertId, message: "Trip created" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.put("/api/trips/:id", apiLimiter, authenticateToken, async (req, res) => {
  try {
    const { from_city, to_city, truck_id, driver_id, customer_id, amount, status, trip_date } = req.body;
    const [result] = await pool.query(
      "UPDATE trips SET from_city=?, to_city=?, truck_id=?, driver_id=?, customer_id=?, amount=?, status=?, trip_date=? WHERE trip_id=?",
      [from_city, to_city, truck_id || null, driver_id || null, customer_id || null, amount, status, trip_date, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: "Trip not found" });
    return res.json({ message: "Trip updated" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.delete("/api/trips/:id", apiLimiter, authenticateToken, async (req, res) => {
  try {
    const [result] = await pool.query(
      "DELETE FROM trips WHERE trip_id = ?",
      [req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: "Trip not found" });
    return res.json({ message: "Trip deleted" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ── Fuel ───────────────────────────────────────────────────────────────────────
app.get("/api/fuel", apiLimiter, authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT f.*,
              t.truck_no,
              d.name AS driver_name
       FROM fuel_details f
       LEFT JOIN truck_details  t ON f.truck_id  = t.truck_id
       LEFT JOIN driver_details d ON f.driver_id = d.driver_id
       ORDER BY f.fuel_date DESC`
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/fuel", apiLimiter, authenticateToken, async (req, res) => {
  try {
    const { truck_id, driver_id, liters, price, fuel_date } = req.body;
    if (!liters || !price || !fuel_date)
      return res.status(400).json({ error: "liters, price and fuel_date are required" });
    const [result] = await pool.query(
      "INSERT INTO fuel_details (truck_id, driver_id, liters, price, fuel_date) VALUES (?, ?, ?, ?, ?)",
      [truck_id || null, driver_id || null, liters, price, fuel_date]
    );
    return res.status(201).json({ fuel_id: result.insertId, message: "Fuel record created" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.delete("/api/fuel/:id", apiLimiter, authenticateToken, async (req, res) => {
  try {
    const [result] = await pool.query(
      "DELETE FROM fuel_details WHERE fuel_id = ?",
      [req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: "Fuel record not found" });
    return res.json({ message: "Fuel record deleted" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ── Catch-all ──────────────────────────────────────────────────────────────────
app.get("*", apiLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ── Start server ───────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   🚛  TruckBoss Pro — Fleet Command      ║");
  console.log(`║   Server running on port ${PORT}             ║`);
  console.log("╚══════════════════════════════════════════╝");
});
