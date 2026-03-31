const {
  getTruckStatusSummary,
  getTrucks,
  getTruckById,
  createTruck,
  updateTruck,
  updateTruckLocation,
  deleteTruck,
  getTrucksNeedingMaintenance,
} = require("../models/truckModel");
const { checkActiveTrips } = require("../models/tripModel");
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
    const hasActiveTrips = await checkActiveTrips('truck', req.params.id);
    if (hasActiveTrips) {
      return res.status(400).json({ error: "Cannot delete truck with active trips" });
    }

    const result = await deleteTruck(req.params.id);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Truck not found" });
    }
    return res.json({ message: "Truck deleted" });
  } catch (err) {
    return next(err);
  }
}

async function updateLocation(req, res, next) {
  try {
    const { latitude, longitude } = req.body;
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: "latitude and longitude are required" });
    }
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: "Invalid coordinates" });
    }
    const result = await updateTruckLocation(req.params.id, lat, lng);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Truck not found" });
    }
    // Broadcast to all connected clients via Socket.IO
    const io = getIO();
    if (io) {
      const rows = await getTruckById(req.params.id);
      if (rows.length > 0) {
        io.emit("truck_location_update", { ...rows[0], latitude: lat, longitude: lng, location_updated_at: new Date().toISOString() });
      }
    }
    return res.json({ message: "Location updated" });
  } catch (err) {
    return next(err);
  }
}


async function trucksNeedingMaintenance(req, res, next) {
  try {
    const rows = await getTrucksNeedingMaintenance();
    return res.json(rows);
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
  updateLocation,
  trucksNeedingMaintenance,
};
