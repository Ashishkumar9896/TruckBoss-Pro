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

module.exports = {
  findUserByEmail,
  findUserIdByEmail,
  createUser,
};
