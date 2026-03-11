const pool = require("../config/db");

async function getDrivers() {
  const [rows] = await pool.query("SELECT * FROM driver_details ORDER BY created_at DESC");
  return rows;
}

async function getDriverById(id) {
  const [rows] = await pool.query("SELECT * FROM driver_details WHERE driver_id = ?", [id]);
  return rows;
}

async function createDriver(name, licenceNo, phoneNo, address, salary) {
  const [result] = await pool.query(
    "INSERT INTO driver_details (name, licence_no, phone_no, address, salary) VALUES (?, ?, ?, ?, ?)",
    [name, licenceNo, phoneNo, address, salary]
  );
  return result;
}

async function updateDriver(id, name, licenceNo, phoneNo, address, salary, status) {
  const [result] = await pool.query(
    "UPDATE driver_details SET name=?, licence_no=?, phone_no=?, address=?, salary=?, status=? WHERE driver_id=?",
    [name, licenceNo, phoneNo, address, salary, status, id]
  );
  return result;
}

async function deleteDriver(id) {
  const [result] = await pool.query("DELETE FROM driver_details WHERE driver_id = ?", [id]);
  return result;
}

async function getDriverPerformance() {
  const [rows] = await pool.query(`
    SELECT d.driver_id, d.name, 
           COUNT(DISTINCT t.trip_id) AS total_trips,
           COALESCE(SUM(t.amount), 0) AS revenue,
           COALESCE((SELECT SUM(f.liters) FROM fuel_records f WHERE f.driver_id = d.driver_id), 0) AS total_fuel
    FROM driver_details d
    LEFT JOIN trips t ON d.driver_id = t.driver_id AND t.status = 'Completed'
    GROUP BY d.driver_id, d.name
    ORDER BY revenue DESC
  `);
  return rows;
}

module.exports = {
  getDrivers,
  getDriverById,
  createDriver,
  updateDriver,
  deleteDriver,
  getDriverPerformance,
};
