const {
  getTruckStatusSummary,
  getTrucks,
  getTruckById,
  createTruck,
  updateTruck,
  deleteTruck,
} = require("../models/truckModel");
const { getIO } = require("../socket");

async function getStatusSummary(req, res, next) {
  try {
    const rows = await getTruckStatusSummary();
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
}

async function listTrucks(req, res, next) {
  try {
    const rows = await getTrucks();
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
}

async function getTruck(req, res, next) {
  try {
    const rows = await getTruckById(req.params.id);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Truck not found" });
    }
    return res.json(rows[0]);
  } catch (err) {
    return next(err);
  }
}

async function addTruck(req, res, next) {
  try {
    const { truck_no, driver_id, status = "Available", maintenance = "Not Required" } = req.body;
    if (!truck_no) {
      return res.status(400).json({ error: "Truck number is required" });
    }

    const result = await createTruck(truck_no, driver_id || null, status, maintenance);
    return res.status(201).json({ truck_id: result.insertId, message: "Truck created" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Truck number already exists" });
    }
    return next(err);
  }
}

async function editTruck(req, res, next) {
  try {
    const { truck_no, driver_id, status, maintenance, latitude, longitude, location } = req.body;
    const result = await updateTruck(req.params.id, truck_no, driver_id || null, status, maintenance);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Truck not found" });
    }

    const hasLocationUpdate =
      latitude !== undefined || longitude !== undefined || location !== undefined;
    if (hasLocationUpdate) {
      const io = getIO();
      if (io) {
        io.emit("truck_location_update", {
          truck_id: Number(req.params.id),
          truck_no,
          latitude: latitude ?? null,
          longitude: longitude ?? null,
          location: location ?? null,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    return res.json({ message: "Truck updated" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Truck number already exists" });
    }
    return next(err);
  }
}

async function removeTruck(req, res, next) {
  try {
    const result = await deleteTruck(req.params.id);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Truck not found" });
    }
    return res.json({ message: "Truck deleted" });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getStatusSummary,
  listTrucks,
  getTruck,
  addTruck,
  editTruck,
  removeTruck,
};
