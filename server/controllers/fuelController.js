const {
  getFuelRecords,
  createFuelRecord,
  deleteFuelRecord,
} = require("../models/fuelModel");
const { getIO } = require("../socket");

async function listFuel(req, res, next) {
  try {
    const rows = await getFuelRecords();
    return res.json(rows);
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
