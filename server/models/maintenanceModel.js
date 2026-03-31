const pool = require("../config/db");

async function getMaintenanceRecords(limit = 10, offset = 0) {
  const [rows] = await pool.query(
    `SELECT m.*, t.truck_no 
     FROM maintenance_records m 
     JOIN truck_details t ON m.truck_id = t.truck_id 
     ORDER BY m.service_date DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  const [[{ count }]] = await pool.query("SELECT COUNT(*) AS count FROM maintenance_records");
  return { data: rows, totalRecords: count };
}

async function createMaintenance(truckId, serviceDate, cost, description, proofDocument) {
  const [result] = await pool.query(
    "INSERT INTO maintenance_records (truck_id, service_date, cost, description, proof_document) VALUES (?, ?, ?, ?, ?)",
    [truckId, serviceDate, cost, description, proofDocument]
  );
  return result;
}

async function updateMaintenance(id, truckId, serviceDate, cost, description, proofDocument) {
  let query = "UPDATE maintenance_records SET truck_id=?, service_date=?, cost=?, description=?";
  let params = [truckId, serviceDate, cost, description];

  if (proofDocument !== undefined) {
    query += ", proof_document=?";
    params.push(proofDocument);
  }

  query += " WHERE maintenance_id=?";
  params.push(id);

  const [result] = await pool.query(query, params);
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
