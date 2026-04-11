const pool = require("../config/db");

/**
 * Data Access: Retrieves a full user record by email address.
 * Used primarily during authentication and session validation.
 */
async function findUserByEmail(email) {
  const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
  return rows;
}

async function findUserIdByEmail(email) {
  const [rows] = await pool.query("SELECT user_id FROM users WHERE email = ?", [email]);
  return rows;
}

/**
 * Data Access: Persists a new administrative or manager user.
 */
async function createUser(email, password, fullName, role) {
  const [result] = await pool.query(
    "INSERT INTO users (email, password, full_name, role) VALUES (?, ?, ?, ?)",
    [email, password, fullName, role]
  );
  return result;
}

/**
 * Data Access: Provisions a new driver user account with specific role constraints.
 */
async function createUserWithDriver(email, password, fullName, driverId) {
  const [result] = await pool.query(
    "INSERT INTO users (email, password, full_name, role, driver_id) VALUES (?, ?, ?, 'driver', ?)",
    [email, password, fullName, driverId]
  );
  return result;
}

/**
 * Data Access: Updates a user's hashed password.
 */
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
