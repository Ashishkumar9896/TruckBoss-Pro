const {
  getDrivers,
  getDriverById,
  createDriver,
  updateDriver,
  deleteDriver,
  getDriverPerformance,
} = require("../models/driverModel");

async function listDrivers(req, res, next) {
  try {
    const rows = await getDrivers();
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
}

async function getDriver(req, res, next) {
  try {
    const rows = await getDriverById(req.params.id);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Driver not found" });
    }
    return res.json(rows[0]);
  } catch (err) {
    return next(err);
  }
}

async function addDriver(req, res, next) {
  try {
    const { name, licence_no, phone_no, address, salary = 0 } = req.body;
    if (!name || !licence_no) {
      return res.status(400).json({ error: "Name and licence number are required" });
    }

    const result = await createDriver(name, licence_no, phone_no || null, address || null, salary);
    return res.status(201).json({ driver_id: result.insertId, message: "Driver created" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Licence number already exists" });
    }
    return next(err);
  }
}

async function editDriver(req, res, next) {
  try {
    const { name, licence_no, phone_no, address, salary, status } = req.body;
    const result = await updateDriver(
      req.params.id,
      name,
      licence_no,
      phone_no || null,
      address || null,
      salary,
      status
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Driver not found" });
    }

    return res.json({ message: "Driver updated" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Licence number already exists" });
    }
    return next(err);
  }
}

async function removeDriver(req, res, next) {
  try {
    const result = await deleteDriver(req.params.id);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Driver not found" });
    }
    return res.json({ message: "Driver deleted" });
  } catch (err) {
    return next(err);
  }
}

async function getPerformance(req, res, next) {
  try {
    const rows = await getDriverPerformance();
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listDrivers,
  getDriver,
  addDriver,
  editDriver,
  removeDriver,
  getPerformance,
};
