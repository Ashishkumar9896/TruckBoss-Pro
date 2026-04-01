const pool = require("../config/db");

function buildTripFilterClause(filters) {
  let whereClause = " WHERE 1=1";
  const values = [];

  if (filters.driver) {
    whereClause += " AND tr.driver_id = ?";
    values.push(filters.driver);
  }

  if (filters.truck) {
    whereClause += " AND t.truck_no = ?";
    values.push(filters.truck);
  }

  if (filters.customer) {
    whereClause += " AND tr.customer_id = ?";
    values.push(filters.customer);
  }

  if (filters.date) {
    whereClause += " AND DATE(tr.trip_date) = ?";
    values.push(filters.date);
  }

  if (filters.status) {
    whereClause += " AND tr.status = ?";
    values.push(filters.status);
  }

  return { whereClause, values };
}

async function getTrips(filters, limit, offset) {
  const { whereClause, values } = buildTripFilterClause(filters);
  const [rows] = await pool.query(
    `SELECT tr.trip_id, tr.truck_id, tr.driver_id, tr.customer_id, tr.manual_customer_name, tr.amount, tr.status, tr.trip_date, tr.material_type, tr.quantity, tr.destination,
            t.truck_no,
            d.name AS driver_name,
            COALESCE(c.name, tr.manual_customer_name) AS customer_name
     FROM trips tr
     LEFT JOIN truck_details t ON tr.truck_id = t.truck_id
     LEFT JOIN driver_details d ON tr.driver_id = d.driver_id
     LEFT JOIN customers c ON tr.customer_id = c.customer_id
     ${whereClause}
     ORDER BY tr.trip_date DESC
     LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  );
  return rows;
}

async function getTripsCount(filters) {
  const { whereClause, values } = buildTripFilterClause(filters);
  const [[result]] = await pool.query(
    `SELECT COUNT(*) AS totalTrips
     FROM trips tr
     LEFT JOIN truck_details t ON tr.truck_id = t.truck_id
     LEFT JOIN driver_details d ON tr.driver_id = d.driver_id
     ${whereClause}`,
    values
  );
  return result.totalTrips;
}

async function createTrip(truckId, driverId, customerId, amount, status, tripDate, materialType = null, quantity = null, destination = null, manualCustomerName = null) {
  const [result] = await pool.query(
    "INSERT INTO trips (truck_id, driver_id, customer_id, amount, status, trip_date, material_type, quantity, destination, manual_customer_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [truckId, driverId, customerId, amount, status, tripDate, materialType, quantity, destination, manualCustomerName]
  );
  return result;
}


async function getTripCustomerById(tripId) {
  const [rows] = await pool.query("SELECT customer_id FROM trips WHERE trip_id = ?", [tripId]);
  return rows;
}

async function updateTrip(id, truckId, driverId, customerId, amount, status, tripDate, materialType = null, quantity = null, destination = null, manualCustomerName = null) {
  const [result] = await pool.query(
    "UPDATE trips SET truck_id=?, driver_id=?, customer_id=?, amount=?, status=?, trip_date=?, material_type=?, quantity=?, destination=?, manual_customer_name=? WHERE trip_id=?",
    [truckId, driverId, customerId, amount, status, tripDate, materialType, quantity, destination, manualCustomerName, id]
  );
  return result;
}


async function deleteTrip(id) {
  const [result] = await pool.query("DELETE FROM trips WHERE trip_id = ?", [id]);
  return result;
}

async function checkActiveTrips(entityType, entityId) {
  let column = '';
  if (entityType === 'driver') column = 'driver_id';
  else if (entityType === 'truck') column = 'truck_id';
  else if (entityType === 'customer') column = 'customer_id';
  else return false;

  const [rows] = await pool.query(
    `SELECT COUNT(*) as count FROM trips WHERE ${column} = ? AND status IN ('ongoing', 'pending')`,
    [entityId]
  );
  return rows[0].count > 0;
}

module.exports = {
  getTrips,
  getTripsCount,
  createTrip,
  getTripCustomerById,
  updateTrip,
  deleteTrip,
  checkActiveTrips,
};
