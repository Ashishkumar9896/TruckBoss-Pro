const {
  getFuelRecords,
  createFuelRecord,
  deleteFuelRecord,
} = require("../models/fuelModel");
const { getIO } = require("../socket");

async function listFuel(req, res, next) {
  try {
    const limit  = parseInt(req.query.limit)  || 10;
    const page   = parseInt(req.query.page)   || 1;
    const offset = (page - 1) * limit;

    const filters = {};
    if (req.query.truck_id) filters.truck_id = req.query.truck_id;
    if (req.query.driver_id) filters.driver_id = req.query.driver_id;
    if (req.query.date)     filters.date     = req.query.date;

    const result = await getFuelRecords(limit, offset, filters);
    return res.json({
      page,
      limit,
      totalRecords: result.totalRecords,
      data: result.data
    });
  } catch (err) {
    return next(err);
  }
}

async function addFuel(req, res, next) {
  try {
    const { truck_id, driver_id, liters, price, fuel_date } = req.body;
    if (!liters || !price || !fuel_date) {
      return res.status(400).json({ error: "liters, price and fuel_date are required" });
    }

    const result = await createFuelRecord(
      truck_id || null,
      driver_id || null,
      liters,
      price,
      fuel_date
    );

    const io = getIO();
    if (io) {
      io.emit("fuel_update", {
        fuel_id: result.insertId,
        truck_id: truck_id || null,
        driver_id: driver_id || null,
        liters,
        price,
        fuel_date,
      });
    }

    return res.status(201).json({ fuel_id: result.insertId, message: "Fuel record created" });
  } catch (err) {
    return next(err);
  }
}

async function removeFuel(req, res, next) {
  try {
    const result = await deleteFuelRecord(req.params.id);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Fuel record not found" });
    }

    return res.json({ message: "Fuel record deleted" });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listFuel,
  addFuel,
  removeFuel,
};
