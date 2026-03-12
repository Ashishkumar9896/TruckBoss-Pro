const pool = require("../config/db");

async function getFuelRecords(limit = 10, offset = 0) {
  const [rows] = await pool.query(
    `SELECT f.*,
            t.truck_no,
            d.name AS driver_name
     FROM fuel_details f
     LEFT JOIN truck_details t ON f.truck_id = t.truck_id
     LEFT JOIN driver_details d ON f.driver_id = d.driver_id
     ORDER BY f.fuel_date DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  const [[{ count }]] = await pool.query("SELECT COUNT(*) AS count FROM fuel_details");
  return { data: rows, totalRecords: count };
}

async function createFuelRecord(truckId, driverId, liters, price, fuelDate) {
  const [result] = await pool.query(
    "INSERT INTO fuel_details (truck_id, driver_id, liters, price, fuel_date) VALUES (?, ?, ?, ?, ?)",
    [truckId, driverId, liters, price, fuelDate]
  );
  return result;
}

async function deleteFuelRecord(id) {
  const [result] = await pool.query("DELETE FROM fuel_details WHERE fuel_id = ?", [id]);
  return result;
}

module.exports = {
  getFuelRecords,
  createFuelRecord,
  deleteFuelRecord,
};
