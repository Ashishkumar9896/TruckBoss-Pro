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

async function listTrips(req, res, next) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
    const offset = (page - 1) * limit;

    const filters = {
      driver: req.query.driver ? String(req.query.driver).trim() : "",
      truck: req.query.truck ? String(req.query.truck).trim() : "",
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
      from_city,
      to_city,
      truck_id,
      driver_id,
      customer_id,
      amount = 0,
      status = "pending",
      trip_date,
      toll_amount = 0,
      misc_expenses = 0
    } = req.body;

    if (!from_city || !to_city || !trip_date) {
      return res.status(400).json({ error: "from_city, to_city and trip_date are required" });
    }

    const result = await createTrip(
      from_city,
      to_city,
      truck_id || null,
      driver_id || null,
      customer_id || null,
      amount,
      status,
      trip_date,
      toll_amount,
      misc_expenses
    );

    await recalculateCustomerBalanceForTrip(customer_id);

    const io = getIO();
    if (io) {
      io.emit("new_trip", {
        trip_id: result.insertId,
        from_city,
        to_city,
        truck_id: truck_id || null,
        driver_id: driver_id || null,
        customer_id: customer_id || null,
        amount,
        status,
        trip_date,
      });
    }

    return res.status(201).json({ trip_id: result.insertId, message: "Trip created" });
  } catch (err) {
    return next(err);
  }
}

async function editTrip(req, res, next) {
  try {
    const { from_city, to_city, truck_id, driver_id, customer_id, amount, status, trip_date, toll_amount = 0, misc_expenses = 0 } = req.body;

    const existingRows = await getTripCustomerById(req.params.id);
    if (existingRows.length === 0) {
      return res.status(404).json({ error: "Trip not found" });
    }

    const previousCustomerId = existingRows[0].customer_id;

    const result = await updateTrip(
      req.params.id,
      from_city,
      to_city,
      truck_id || null,
      driver_id || null,
      customer_id || null,
      amount,
      status,
      trip_date,
      toll_amount,
      misc_expenses
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
