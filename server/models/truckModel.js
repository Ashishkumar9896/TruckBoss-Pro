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
     ORDER BY t.created_at DESC`
  );
  return rows;
}

async function getTruckById(id) {
  const [rows] = await pool.query(
    `SELECT t.*, d.name AS driver_name
     FROM truck_details t
     LEFT JOIN driver_details d ON t.driver_id = d.driver_id
     WHERE t.truck_id = ?`,
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

async function updateTruckLocation(id, latitude, longitude) {
  const [result] = await pool.query(
    "UPDATE truck_details SET latitude=?, longitude=?, location_updated_at=NOW() WHERE truck_id=?",
    [latitude, longitude, id]
  );
  return result;
}

async function deleteTruck(id) {
  const [result] = await pool.query("DELETE FROM truck_details WHERE truck_id = ?", [id]);
  return result;
}

async function getTrucksNeedingMaintenance() {
  const [rows] = await pool.query(
    `SELECT truck_id, truck_no, status,
            CASE
              WHEN LOWER(TRIM(maintenance)) != 'not required'
                   AND maintenance IS NOT NULL
                   AND TRIM(maintenance) != ''
              THEN maintenance
              ELSE 'Under Maintenance (Status)'
            END AS maintenance
     FROM truck_details
     WHERE
       LOWER(status) = 'maintenance'
       OR (
         maintenance IS NOT NULL
         AND TRIM(maintenance) != ''
         AND LOWER(TRIM(maintenance)) != 'not required'
       )
     ORDER BY truck_no ASC`
  );
  return rows;
}

async function clearTruckMaintenance(truckId) {
  const [result] = await pool.query(
    `UPDATE truck_details
     SET maintenance = 'Not Required',
         status = CASE WHEN LOWER(status) = 'maintenance' THEN 'Available' ELSE status END
     WHERE truck_id = ?`,
    [truckId]
  );
  return result;
}

module.exports = {
  getTruckStatusSummary,
  getTrucks,
  getTruckById,
  createTruck,
  updateTruck,
  updateTruckLocation,
  deleteTruck,
  getTrucksNeedingMaintenance,
  clearTruckMaintenance,
};
