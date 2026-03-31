const pool = require("../config/db");

async function findUserByEmail(email) {
  const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
  return rows;
}

async function findUserIdByEmail(email) {
  const [rows] = await pool.query("SELECT user_id FROM users WHERE email = ?", [email]);
  return rows;
}

async function createUser(email, password, fullName, role) {
  const [result] = await pool.query(
    "INSERT INTO users (email, password, full_name, role) VALUES (?, ?, ?, ?)",
    [email, password, fullName, role]
  );
  return result;
}

async function createUserWithDriver(email, password, fullName, driverId) {
  const [result] = await pool.query(
    "INSERT INTO users (email, password, full_name, role, driver_id) VALUES (?, ?, ?, 'driver', ?)",
    [email, password, fullName, driverId]
  );
  return result;
}

async function updateUserPassword(userId, password) {
  const [result] = await pool.query(
    "UPDATE users SET password = ? WHERE user_id = ?",
    [password, userId]
  );
  return result;
}

async function findUserByDriverId(driverId) {
  const [rows] = await pool.query("SELECT user_id, email FROM users WHERE driver_id = ?", [driverId]);
  return rows;
}

module.exports = {
  findUserByEmail,
  findUserIdByEmail,
  createUser,
  createUserWithDriver,
  updateUserPassword,
  findUserByDriverId,
};
