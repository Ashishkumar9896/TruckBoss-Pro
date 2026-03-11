const pool = require("../config/db");

async function getFuelRecords() {
  const [rows] = await pool.query(
    `SELECT f.*,
            t.truck_no,
            d.name AS driver_name
     FROM fuel_details f
     LEFT JOIN truck_details t ON f.truck_id = t.truck_id
     LEFT JOIN driver_details d ON f.driver_id = d.driver_id
     ORDER BY f.fuel_date DESC`
  );
  return rows;
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
