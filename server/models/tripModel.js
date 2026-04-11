const pool = require("../config/db");

/**
 * Utility: Dynamically constructs the SQL WHERE clause based on provided filters.
 * @param {Object} filters - Filter criteria (driver, truck, customer, date, status).
 * @returns {Object} { whereClause, values }
 */
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

/**
 * Data Access: Retrieves a paginated list of trips from the database.
 * @param {Object} filters - Filtering criteria.
 * @param {number} limit - Number of records to return.
 * @param {number} offset - Starting record offset.
 * @returns {Promise<Array>} List of trip records.
 */
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
     ORDER BY tr.trip_date DESC, tr.trip_id DESC
     LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  );
  return rows;
}

/**
 * Data Access: Counts total trips matching the filter criteria for pagination.
 */
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

/**
 * Data Access: Persists a new trip record.
 */
async function createTrip(truckId, driverId, customerId, amount, status, tripDate, materialType = null, quantity = null, destination = null, manualCustomerName = null) {
  const [result] = await pool.query(
    "INSERT INTO trips (truck_id, driver_id, customer_id, amount, status, trip_date, material_type, quantity, destination, manual_customer_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [truckId, driverId, customerId, amount, status, tripDate, materialType, quantity, destination, manualCustomerName]
  );
  return result;
}

/**
 * Data Access: Retrieves the associated customer ID for a specific trip.
 */
async function getTripCustomerById(tripId) {
  const [rows] = await pool.query("SELECT customer_id FROM trips WHERE trip_id = ?", [tripId]);
  return rows;
}

/**
 * Data Access: Updates an existing trip record and adjusts payment flags.
 */
async function updateTrip(id, truckId, driverId, customerId, amount, status, tripDate, materialType = null, quantity = null, destination = null, manualCustomerName = null) {
  const [result] = await pool.query(
    `UPDATE trips
     SET truck_id=?,
         driver_id=?,
         customer_id=?,
         amount=?,
         status=?,
         trip_date=?,
         material_type=?,
         quantity=?,
         destination=?,
         manual_customer_name=?,
         amount_received = LEAST(COALESCE(amount_received, 0), ?),
         payment_received = CASE
           WHEN LEAST(COALESCE(amount_received, 0), ?) >= ? THEN 1
           ELSE 0
         END
     WHERE trip_id=?`,
    [
      truckId,
      driverId,
      customerId,
      amount,
      status,
      tripDate,
      materialType,
      quantity,
      destination,
      manualCustomerName,
      amount,
      amount,
      amount,
      id,
    ]
  );
  return result;
}

/**
 * Data Access: Permanently deletes a trip record.
 */
async function deleteTrip(id) {
  const [result] = await pool.query("DELETE FROM trips WHERE trip_id = ?", [id]);
  return result;
}

/**
 * Validation: Checks if an entity (driver, truck, or customer) has active trips.
 */
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
