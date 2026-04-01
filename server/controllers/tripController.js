const {
  getTrips,
  getTripsCount,
  createTrip,
  getTripCustomerById,
  updateTrip,
  deleteTrip,
} = require("../models/tripModel");
const { recalculateCustomerBalance: recalculateCustomerBalanceForTrip } = require("../models/customerModel");
const { getIO } = require("../socket");
const { getDriverById } = require("../models/driverModel");
const { getTruckById } = require("../models/truckModel");

async function listTrips(req, res, next) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
    const offset = (page - 1) * limit;

    const filters = {
      driver: req.query.driver ? String(req.query.driver).trim() : "",
      truck: req.query.truck ? String(req.query.truck).trim() : "",
      customer: req.query.customer ? String(req.query.customer).trim() : "",
      date: req.query.date ? String(req.query.date).trim() : "",
      status: req.query.status ? String(req.query.status).trim() : "",
    };

    const totalTrips = await getTripsCount(filters);
    const rows = await getTrips(filters, limit, offset);

    return res.json({
      page,
      limit,
      totalTrips,
      data: rows,
    });
  } catch (err) {
    return next(err);
  }
}

async function addTrip(req, res, next) {
  try {
    const {
      truck_id, driver_id, customer_id,
      amount = 0, status = "pending", trip_date,
      material_type = null, quantity = null, destination = null
    } = req.body;

    if (!trip_date) {
      return res.status(400).json({ error: "trip_date is required" });
    }

    const result = await createTrip(
      truck_id || null, driver_id || null, customer_id || null,
      amount, status, trip_date, material_type, quantity, destination
    );


    await recalculateCustomerBalanceForTrip(customer_id);

    const io = getIO();
    if (io) {
      io.emit("new_trip", {
        trip_id: result.insertId,
        truck_id: truck_id || null,
        driver_id: driver_id || null,
        customer_id: customer_id || null,
        amount,
        status,
        trip_date,
        material_type,
        quantity,
        destination
      });

    }

    return res.status(201).json({
      trip_id: result.insertId,
      message: "Trip created"
    });
  } catch (err) {
    return next(err);
  }
}

async function editTrip(req, res, next) {
  try {
    const { truck_id, driver_id, customer_id, amount, status, trip_date, material_type = null, quantity = null, destination = null } = req.body;

    const existingRows = await getTripCustomerById(req.params.id);
    if (existingRows.length === 0) {
      return res.status(404).json({ error: "Trip not found" });
    }

    const previousCustomerId = existingRows[0].customer_id;

    const result = await updateTrip(
      req.params.id, truck_id || null, driver_id || null,
      customer_id || null, amount, status, trip_date, material_type, quantity, destination
    );


    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Trip not found" });
    }

    await recalculateCustomerBalanceForTrip(previousCustomerId);
    if (String(previousCustomerId || "") !== String(customer_id || "")) {
      await recalculateCustomerBalanceForTrip(customer_id);
    }

    return res.json({ message: "Trip updated" });
  } catch (err) {
    return next(err);
  }
}

async function removeTrip(req, res, next) {
  try {
    const existingRows = await getTripCustomerById(req.params.id);
    if (existingRows.length === 0) {
      return res.status(404).json({ error: "Trip not found" });
    }

    const result = await deleteTrip(req.params.id);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Trip not found" });
    }

    await recalculateCustomerBalanceForTrip(existingRows[0].customer_id);
    return res.json({ message: "Trip deleted" });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listTrips,
  addTrip,
  editTrip,
  removeTrip,
};
