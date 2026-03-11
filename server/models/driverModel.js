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

module.exports = {
  getDrivers,
  getDriverById,
  createDriver,
  updateDriver,
  deleteDriver,
};
