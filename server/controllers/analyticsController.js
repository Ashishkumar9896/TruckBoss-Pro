const pool = require("../config/db");
const { buildSettlementMap, getTripExpectedAmount } = require("../utils/tripSettlement");

function buildTripAnalyticsFilters(query) {
  return {
    driver: query.driver ? String(query.driver).trim() : "",
    truck: query.truck ? String(query.truck).trim() : "",
    customer: query.customer ? String(query.customer).trim() : "",
    date: query.date ? String(query.date).trim() : "",
    status: query.status ? String(query.status).trim() : "",
    settlement: query.settlement ? String(query.settlement).trim() : "",
    date_from: query.date_from ? String(query.date_from).trim() : "",
    date_to: query.date_to ? String(query.date_to).trim() : "",
  };
}

function appendTripAnalyticsWhere(filters) {
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
  if (filters.date_from) {
    whereClause += " AND DATE(tr.trip_date) >= ?";
    values.push(filters.date_from);
  }
  if (filters.date_to) {
    whereClause += " AND DATE(tr.trip_date) <= ?";
    values.push(filters.date_to);
  }
  if (filters.status) {
    whereClause += " AND tr.status = ?";
    values.push(filters.status);
  }
  return { whereClause, values };
}

async function fetchTripAnalyticsRows(filters, pagination = {}) {
  const { whereClause, values } = appendTripAnalyticsWhere(filters);
  const { limit, offset } = pagination;

  const [rows] = await pool.query(
    `SELECT 
        tr.trip_id,
        tr.trip_date,
        tr.status,
        tr.truck_id,
        tr.driver_id,
        tr.customer_id,
        t.truck_no,
        d.name AS driver_name,
        COALESCE(c.name, 'Unknown') AS customer_name,
        COALESCE(c.amount_paid, 0) AS customer_amount_paid,
        COALESCE(c.balance, 0) AS customer_total_billed,
        COALESCE(c.due_date, NULL) AS customer_due_date,
        COALESCE(tr.amount, 0) AS amount,
        tr.material_type,
        tr.quantity,
        (
          SELECT COALESCE(SUM(price), 0)
          FROM fuel_details f
          WHERE f.truck_id = tr.truck_id
            AND DATE(f.fuel_date) = DATE(tr.trip_date)
        ) AS fuel_cost
     FROM trips tr
     LEFT JOIN truck_details t ON tr.truck_id = t.truck_id
     LEFT JOIN driver_details d ON tr.driver_id = d.driver_id
     LEFT JOIN customers c ON tr.customer_id = c.customer_id
     ${whereClause}
     ORDER BY tr.trip_date DESC, tr.trip_id DESC
     ${Number.isFinite(limit) ? "LIMIT ? OFFSET ?" : ""}`,
    Number.isFinite(limit) ? [...values, limit, offset || 0] : values
  );

  return rows;
}

async function getTripProfitability(req, res, next) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
    const offset = (page - 1) * limit;
    const filters = buildTripAnalyticsFilters(req.query);
    const { whereClause, values } = appendTripAnalyticsWhere(filters);

    const [[countRow]] = await pool.query(
      `SELECT COUNT(*) AS count
       FROM trips tr
       LEFT JOIN truck_details t ON tr.truck_id = t.truck_id
       ${whereClause}`,
      values
    );

    const rows = await fetchTripAnalyticsRows(filters, { limit, offset });
    const customerIds = [...new Set(rows.map((row) => row.customer_id).filter(Boolean))];
    const [transactions] = customerIds.length
      ? await pool.query(
          `SELECT transaction_id, customer_id, amount, payment_date
           FROM customer_transactions
           WHERE customer_id IN (${customerIds.map(() => "?").join(",")})
           ORDER BY payment_date ASC, transaction_id ASC`,
          customerIds
        )
      : [[]];

    const txByCustomer = transactions.reduce((acc, tx) => {
      if (!acc[tx.customer_id]) acc[tx.customer_id] = [];
      acc[tx.customer_id].push(tx);
      return acc;
    }, {});

    const tripsByCustomer = rows.reduce((acc, row) => {
      const key = row.customer_id || `trip-${row.trip_id}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(row);
      return acc;
    }, {});

    const settlementMaps = {};
    Object.entries(tripsByCustomer).forEach(([customerKey, customerTrips]) => {
      const customerId = Number(customerKey);
      settlementMaps[customerKey] = buildSettlementMap(
        customerTrips,
        Number.isFinite(customerId) ? (txByCustomer[customerId] || []) : []
      );
    });

    let profitabilityData = rows.map((r) => {
      const baseAmount = Number(r.amount || 0);
      
      const fuel = Number(r.fuel_cost || 0);
      const expectedPayment = getTripExpectedAmount(r);
      const settlement = (settlementMaps[r.customer_id || `trip-${r.trip_id}`] || {})[r.trip_id] || {
        expected_amount: Number(expectedPayment.toFixed(2)),
        received_amount: 0,
        pending_amount: Number(expectedPayment.toFixed(2)),
        settlement_status: "Pending Settlement",
        pending_settlement_flag: expectedPayment > 0,
      };

      const totalExpenses = fuel;
      const netProfit = baseAmount - totalExpenses;
      return {
        trip_id: r.trip_id,
        trip_date: r.trip_date,
        truck_no: r.truck_no,
        truck_id: r.truck_id,
        driver_id: r.driver_id,
        customer_id: r.customer_id,
        customer_name: r.customer_name,
        material_type: r.material_type,
        quantity: r.quantity,
        driver_name: r.driver_name,
        status: r.status,
        amount: baseAmount,
        revenue: Number(expectedPayment.toFixed(2)),
        expected_payment: Number(settlement.expected_amount || 0),
        received_payment: Number(settlement.received_amount || 0),
        pending_settlement_amount: Number(settlement.pending_amount || 0),
        pending_settlement_flag: Boolean(settlement.pending_settlement_flag),
        settlement_status: settlement.settlement_status,
        due_date: r.customer_due_date,
        expenses: {
          fuel_cost: fuel,
          total: Number(totalExpenses.toFixed(2)),
        },
        net_profit: Number(netProfit.toFixed(2)),
      };
    });

    if (filters.settlement) {
      const targetPending = filters.settlement.toLowerCase() === "pending";
      profitabilityData = profitabilityData.filter((row) => row.pending_settlement_flag === targetPending);
    }

    return res.json({
      page,
      limit,
      totalRecords: countRow.count,
      totalPages: Math.max(Math.ceil(countRow.count / limit), 1),
      data: profitabilityData,
    });
  } catch (err) {
    return next(err);
  }
}

async function getRouteProfitability(req, res, next) {
  try {
    return res.json([]);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getTripProfitability,
  getRouteProfitability,
};
