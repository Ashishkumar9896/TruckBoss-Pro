const pool = require("../config/db");

async function logAction(req, action, entity, entity_id) {
  try {
    const user_id = req.user ? req.user.user_id : null;
    const ip_address = req.ip || req.connection.remoteAddress;

    if (!user_id && action !== "LOGIN") return;

    await pool.query(
      "INSERT INTO audit_logs (user_id, action, entity, entity_id, ip_address) VALUES (?, ?, ?, ?, ?)",
      [user_id, action, entity, entity_id || null, ip_address]
    );
  } catch (err) {
    console.error("Audit Log Failed:", err.message);
  }
}

module.exports = { logAction };
