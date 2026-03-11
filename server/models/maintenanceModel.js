const pool = require("../config/db");

async function getMaintenanceRecords() {
  const [rows] = await pool.query(
    `SELECT m.*, t.truck_no 
     FROM maintenance_records m 
     JOIN truck_details t ON m.truck_id = t.truck_id 
     ORDER BY m.service_date DESC`
  );
  return rows;
}

async function createMaintenance(truckId, serviceDate, cost, description) {
  const [result] = await pool.query(
    "INSERT INTO maintenance_records (truck_id, service_date, cost, description) VALUES (?, ?, ?, ?)",
    [truckId, serviceDate, cost, description]
  );
  return result;
}

async function updateMaintenance(id, truckId, serviceDate, cost, description) {
  const [result] = await pool.query(
    "UPDATE maintenance_records SET truck_id=?, service_date=?, cost=?, description=? WHERE maintenance_id=?",
    [truckId, serviceDate, cost, description, id]
  );
  return result;
}

async function deleteMaintenance(id) {
  const [result] = await pool.query("DELETE FROM maintenance_records WHERE maintenance_id = ?", [id]);
  return result;
}

module.exports = {
  getMaintenanceRecords,
  createMaintenance,
  updateMaintenance,
  deleteMaintenance,
};
