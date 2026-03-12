const pool = require("../config/db");

async function recalculateCustomerBalance(customerId) {
  if (!customerId) return;
  await pool.query(
    `UPDATE customers c
     LEFT JOIN (
       SELECT customer_id, COALESCE(SUM(amount), 0) AS trip_total
       FROM trips
       WHERE customer_id = ?
       GROUP BY customer_id
     ) t ON c.customer_id = t.customer_id
     SET c.balance = GREATEST(COALESCE(t.trip_total, 0) - COALESCE(c.amount_paid, 0), 0)
     WHERE c.customer_id = ?`,
    [customerId, customerId]
  );
}

async function getDashboardStats() {
  const [[customers]] = await pool.query("SELECT COUNT(*) AS count FROM customers");
  const [[revenue]] = await pool.query("SELECT COALESCE(SUM(amount_paid), 0) AS total FROM customers");
  const [[balance]] = await pool.query("SELECT COALESCE(SUM(balance), 0) AS total FROM customers");
  const [[trucks]] = await pool.query("SELECT COUNT(*) AS count FROM truck_details");
  const [truckStatus] = await pool.query("SELECT status, COUNT(*) AS count FROM truck_details GROUP BY status");
  const [[trips]] = await pool.query("SELECT COUNT(*) AS count FROM trips");
  const [[drivers]] = await pool.query("SELECT COUNT(*) AS count FROM driver_details");
  const [[fuel]] = await pool.query("SELECT COALESCE(SUM(price), 0) AS total FROM fuel_details");

  return { customers, revenue, balance, trucks, truckStatus, trips, drivers, fuel };
}

async function getRevenueChart() {
  const [rows] = await pool.query("SELECT name, amount_paid FROM customers ORDER BY amount_paid DESC LIMIT 10");
  return rows;
}

async function getCustomers() {
  const [rows] = await pool.query("SELECT * FROM customers WHERE is_active = TRUE ORDER BY created_at DESC");
  return rows;
}

async function getCustomerById(id) {
  const [rows] = await pool.query("SELECT * FROM customers WHERE customer_id = ? AND is_active = TRUE", [id]);
  return rows;
}

async function createCustomer(name, phoneNo, address, amountPaid, balance) {
  const [result] = await pool.query(
    "INSERT INTO customers (name, phone_no, address, amount_paid, balance) VALUES (?, ?, ?, ?, ?)",
    [name, phoneNo, address, amountPaid, balance]
  );
  return result;
}

async function updateCustomer(id, name, phoneNo, address, amountPaid, balance) {
  const [result] = await pool.query(
    "UPDATE customers SET name=?, phone_no=?, address=?, amount_paid=?, balance=? WHERE customer_id=?",
    [name, phoneNo, address, amountPaid, balance, id]
  );
  return result;
}

async function deleteCustomer(id) {
  const [result] = await pool.query("UPDATE customers SET is_active = FALSE WHERE customer_id = ?", [id]);
  return result;
}

module.exports = {
  recalculateCustomerBalance,
  getDashboardStats,
  getRevenueChart,
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
};
