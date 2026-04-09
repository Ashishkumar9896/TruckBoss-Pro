const pool = require("../config/db");

async function getFuelRecords(limit = 10, offset = 0, filters = {}) {
  const conditions = [];
  const params = [];

  if (filters.truck_id) {
    conditions.push('f.truck_id = ?');
    params.push(filters.truck_id);
  }
  if (filters.driver_id) {
    conditions.push('f.driver_id = ?');
    params.push(filters.driver_id);
  }
  if (filters.date) {
    conditions.push('DATE(f.fuel_date) = ?');
    params.push(filters.date);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT f.*,
            t.truck_no,
            d.name AS driver_name
     FROM fuel_details f
     LEFT JOIN truck_details t ON f.truck_id = t.truck_id
     LEFT JOIN driver_details d ON f.driver_id = d.driver_id
     ${where}
     ORDER BY f.fuel_date DESC, f.fuel_id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [[{ count }]] = await pool.query(
    `SELECT COUNT(*) AS count FROM fuel_details f ${where}`,
    params
  );

  return { data: rows, totalRecords: count };
}

async function createFuelRecord(truckId, driverId, liters, price, fuelDate) {
  const [result] = await pool.query(
    "INSERT INTO fuel_details (truck_id, driver_id, liters, price, fuel_date) VALUES (?, ?, ?, ?, ?)",
    [truckId, driverId, liters, price, fuelDate]
  );
  return result;
}

async function updateFuelRecord(id, truckId, driverId, liters, price, fuelDate) {
  const [result] = await pool.query(
    "UPDATE fuel_details SET truck_id = ?, driver_id = ?, liters = ?, price = ?, fuel_date = ? WHERE fuel_id = ?",
    [truckId, driverId, liters, price, fuelDate, id]
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
  updateFuelRecord,
  deleteFuelRecord,
};
