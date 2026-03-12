const pool = require("../config/db");

function buildTripFilterClause(filters) {
  let whereClause = " WHERE 1=1";
  const values = [];

  if (filters.driver) {
    whereClause += " AND d.name LIKE ?";
    values.push(`%${filters.driver}%`);
  }

  if (filters.truck) {
    whereClause += " AND t.truck_no = ?";
    values.push(filters.truck);
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
    `SELECT tr.*,
            t.truck_no,
            d.name AS driver_name,
            c.name AS customer_name
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

async function createTrip(fromCity, toCity, truckId, driverId, customerId, amount, status, tripDate, tollAmount = 0, miscExpenses = 0) {
  const [result] = await pool.query(
    "INSERT INTO trips (from_city, to_city, truck_id, driver_id, customer_id, amount, status, trip_date, toll_amount, misc_expenses) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [fromCity, toCity, truckId, driverId, customerId, amount, status, tripDate, tollAmount, miscExpenses]
  );
  return result;
}

async function getTripCustomerById(tripId) {
  const [rows] = await pool.query("SELECT customer_id FROM trips WHERE trip_id = ?", [tripId]);
  return rows;
}

async function updateTrip(id, fromCity, toCity, truckId, driverId, customerId, amount, status, tripDate, tollAmount = 0, miscExpenses = 0) {
  const [result] = await pool.query(
    "UPDATE trips SET from_city=?, to_city=?, truck_id=?, driver_id=?, customer_id=?, amount=?, status=?, trip_date=?, toll_amount=?, misc_expenses=? WHERE trip_id=?",
    [fromCity, toCity, truckId, driverId, customerId, amount, status, tripDate, tollAmount, miscExpenses, id]
  );
  return result;
}

async function deleteTrip(id) {
  const [result] = await pool.query("DELETE FROM trips WHERE trip_id = ?", [id]);
  return result;
}

module.exports = {
  getTrips,
  getTripsCount,
  createTrip,
  getTripCustomerById,
  updateTrip,
  deleteTrip,
};
