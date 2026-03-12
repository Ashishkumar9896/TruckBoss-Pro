const pool = require("../config/db");

async function getTruckStatusSummary() {
  const [rows] = await pool.query("SELECT status, COUNT(*) AS count FROM truck_details GROUP BY status");
  return rows;
}

async function getTrucks() {
  const [rows] = await pool.query(
    `SELECT t.*, d.name AS driver_name
     FROM truck_details t
     LEFT JOIN driver_details d ON t.driver_id = d.driver_id
     WHERE t.is_active = TRUE
     ORDER BY t.created_at DESC`
  );
  return rows;
}

async function getTruckById(id) {
  const [rows] = await pool.query(
    `SELECT t.*, d.name AS driver_name
     FROM truck_details t
     LEFT JOIN driver_details d ON t.driver_id = d.driver_id
     WHERE t.truck_id = ? AND t.is_active = TRUE`,
    [id]
  );
  return rows;
}

async function createTruck(truckNo, driverId, status, maintenance) {
  const [result] = await pool.query(
    "INSERT INTO truck_details (truck_no, driver_id, status, maintenance) VALUES (?, ?, ?, ?)",
    [truckNo, driverId, status, maintenance]
  );
  return result;
}

async function updateTruck(id, truckNo, driverId, status, maintenance) {
  const [result] = await pool.query(
    "UPDATE truck_details SET truck_no=?, driver_id=?, status=?, maintenance=? WHERE truck_id=?",
    [truckNo, driverId, status, maintenance, id]
  );
  return result;
}

async function deleteTruck(id) {
  const [result] = await pool.query("UPDATE truck_details SET is_active = FALSE WHERE truck_id = ?", [id]);
  return result;
}

module.exports = {
  getTruckStatusSummary,
  getTrucks,
  getTruckById,
  createTruck,
  updateTruck,
  deleteTruck,
};
