const pool = require("../config/db");
const { buildSettlementMap, getTripExpectedAmount } = require("../utils/tripSettlement");

let tripPaymentColumnsState = {
  checked: false,
  hasAmountReceived: false,
};

async function getTripPaymentColumnsState(forceRefresh = false) {
  if (tripPaymentColumnsState.checked && !forceRefresh) {
    return tripPaymentColumnsState;
  }

  const [rows] = await pool.query("SHOW COLUMNS FROM trips LIKE 'amount_received'");
  tripPaymentColumnsState = {
    checked: true,
    hasAmountReceived: rows.length > 0,
  };
  return tripPaymentColumnsState;
}

async function ensureAmountReceivedColumn() {
  const state = await getTripPaymentColumnsState();
  if (state.hasAmountReceived) return;

  await pool.query("ALTER TABLE trips ADD COLUMN amount_received DECIMAL(12, 2) NOT NULL DEFAULT 0.00");
  tripPaymentColumnsState = {
    checked: true,
    hasAmountReceived: true,
  };
}

function buildTripPaymentNote(trip, mode) {
  const destination = trip.destination ? ` to ${trip.destination}` : "";
  if (mode === "partial") return `Partial trip payment received for Trip #${trip.trip_id}${destination}`;
  return `Trip payment received for Trip #${trip.trip_id}${destination}`;
}

function extractLinkedTripId(notes) {
  const text = String(notes || "").trim();
  const match = text.match(/^(?:partial\s+)?trip payment received for trip #(\d+)/i);
  return match ? Number(match[1]) : null;
}

function buildSettlementMapWithDirectPayments(trips, transactions) {
  return buildSettlementMap(trips, transactions);
}

async function getCustomerSettlementRows(conn) {
  const [tripRows] = await conn.query(
    `SELECT tr.trip_id, tr.trip_date, tr.created_at, tr.customer_id, tr.manual_customer_name,
            tr.amount, tr.destination,
            COALESCE(tr.payment_received, 0) AS payment_received,
            COALESCE(tr.amount_received, 0) AS amount_received,
            c.name AS customer_name
     FROM trips tr
     LEFT JOIN customers c ON tr.customer_id = c.customer_id
     WHERE tr.amount > 0
     ORDER BY tr.trip_date ASC, tr.trip_id ASC`
  );

  const [paymentRows] = await conn.query(
    `SELECT transaction_id, customer_id, amount, payment_date, notes
     FROM customer_transactions
     ORDER BY payment_date ASC, transaction_id ASC`
  );

  const txByCustomer = paymentRows.reduce((acc, tx) => {
    if (!acc[tx.customer_id]) acc[tx.customer_id] = [];
    acc[tx.customer_id].push(tx);
    return acc;
  }, {});

  const tripsByCustomer = tripRows.reduce((acc, trip) => {
    if (!trip.customer_id) return acc;
    if (!acc[trip.customer_id]) acc[trip.customer_id] = [];
    acc[trip.customer_id].push(trip);
    return acc;
  }, {});

  const settlementByTripId = {};
  Object.entries(tripsByCustomer).forEach(([customerId, customerTrips]) => {
    const settlementMap = buildSettlementMapWithDirectPayments(customerTrips, txByCustomer[customerId] || []);
    Object.entries(settlementMap).forEach(([tripId, settlement]) => {
      settlementByTripId[tripId] = settlement;
    });
  });

  return { tripRows, settlementByTripId };
}

function buildTripExpenseRowFromSettlement(trip, settlement, hasAmountReceived) {
  const totalAmount = Number(getTripExpectedAmount(trip) || 0);
  const personName = trip.customer_name || trip.manual_customer_name || "Unknown Customer";

  if (trip.customer_id && settlement) {
    const pendingAmount = Number(settlement.pending_amount || 0);
    const receivedAmount = Number(settlement.received_amount || 0);
    const fullySettled = pendingAmount <= 0.0001;

    return {
      id: trip.trip_id,
      date: trip.trip_date,
      person_name: personName,
      type: fullySettled ? "Settled" : "Owed",
      amount: totalAmount,
      pending_amount: pendingAmount,
      remarks: `Settlement: Trip Freight Bill${trip.destination ? ` to ${trip.destination}` : ""}${fullySettled ? " [Debt Settled]" : receivedAmount > 0 ? ` [Applied Advance ₹${receivedAmount.toFixed(2)}]` : ""}`,
      created_at: trip.created_at,
      source: "trip",
      exclude_from_cash_totals: 1,
      payment_received: fullySettled ? 1 : 0,
      amount_received: receivedAmount,
    };
  }

  const alreadyReceived = hasAmountReceived ? Number(trip.amount_received || 0) : 0;
  const effectiveReceived = hasAmountReceived ? Math.min(alreadyReceived, totalAmount) : 0;
  const pendingAmount = hasAmountReceived ? Math.max(totalAmount - effectiveReceived, 0) : totalAmount;
  const fullySettled = pendingAmount <= 0.0001;

  return {
    id: trip.trip_id,
    date: trip.trip_date,
    person_name: personName,
    type: fullySettled ? "Settled" : "Owed",
    amount: totalAmount,
    pending_amount: pendingAmount,
    remarks: `Trip Freight Bill${trip.destination ? ` to ${trip.destination}` : ""}${fullySettled ? " [Paid]" : ""}`,
    created_at: trip.created_at,
    source: "trip",
    exclude_from_cash_totals: 0,
    payment_received: fullySettled ? 1 : 0,
    amount_received: effectiveReceived,
  };
}

async function getTripSettlementSnapshot(conn, trip) {
  if (!trip.customer_id) {
    const totalAmount = Number(trip.amount || 0);
    const receivedAmount = Number(trip.amount_received || 0);
    return {
      expected_amount: totalAmount,
      received_amount: Math.min(receivedAmount, totalAmount),
      pending_amount: Math.max(totalAmount - receivedAmount, 0),
      settlement_status: receivedAmount >= totalAmount ? "Settled" : "Pending Settlement",
      pending_settlement_flag: receivedAmount < totalAmount,
    };
  }

  const [customerTrips] = await conn.query(
    `SELECT trip_id, trip_date, amount
     FROM trips
     WHERE customer_id = ?
       AND amount > 0
     ORDER BY trip_date ASC, trip_id ASC`,
    [trip.customer_id]
  );

  const [transactions] = await conn.query(
    `SELECT transaction_id, customer_id, amount, payment_date, notes
     FROM customer_transactions
     WHERE customer_id = ?
     ORDER BY payment_date ASC, transaction_id ASC`,
    [trip.customer_id]
  );

  const settlementMap = buildSettlementMapWithDirectPayments(customerTrips, transactions);
  return settlementMap[trip.trip_id] || {
    expected_amount: Number(trip.amount || 0),
    received_amount: 0,
    pending_amount: Number(trip.amount || 0),
    settlement_status: "Pending Settlement",
    pending_settlement_flag: true,
  };
}

const getUnifiedExpenses = async (filters = {}) => {
  const { hasAmountReceived } = await getTripPaymentColumnsState();
  const conn = await pool.getConnection();
  try {
    const whereClauses = [];
    const params = [];

    if (filters.date) {
      whereClauses.push("date = ?");
      params.push(filters.date);
    }

    const manualWhere = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const customerWhere = filters.date ? `AND ct.payment_date = ?` : "";
    const fuelWhere = filters.date ? `WHERE f.fuel_date = ?` : "";
    const maintenanceWhere = filters.date ? `AND m.service_date = ?` : "";
    
    // For payments and other tables, we can directly filter.
    // For trips, we still need to calculate settlements, but we will filter the returned rows by date.

    const [baseRows] = await conn.query(`
      SELECT 
        *
      FROM (
        SELECT 
          expense_id as id, 
          date, 
          person_name, 
          type, 
          amount, 
          remarks, 
          created_at, 
          'manual' as source,
          0 as exclude_from_cash_totals
        FROM daily_expenses
        ${manualWhere}

        UNION ALL

        SELECT 
          ct.transaction_id as id, 
          ct.payment_date as date, 
          c.name as person_name, 
          'Received' as type, 
          ct.amount, 
          CONCAT('Customer Payment', IF(ct.notes IS NOT NULL AND ct.notes != '', CONCAT(' - ', ct.notes), '')) as remarks, 
          ct.created_at, 
          'customer' as source,
          0 as exclude_from_cash_totals
        FROM customer_transactions ct
        JOIN customers c ON ct.customer_id = c.customer_id
        WHERE 1=1
        ${customerWhere}
        AND (
          ct.notes IS NULL
          OR LOWER(TRIM(ct.notes)) NOT REGEXP '^(partial )?trip payment received for trip #[0-9]+'
        )

        UNION ALL

        SELECT 
          f.fuel_id as id, 
          f.fuel_date as date, 
          COALESCE(d.name, t.truck_no, 'Fuel Station') as person_name, 
          'Given' as type, 
          f.price as amount, 
          'Fuel Cost' as remarks, 
          f.created_at, 
          'fuel' as source,
          0 as exclude_from_cash_totals
        FROM fuel_details f
        LEFT JOIN driver_details d ON f.driver_id = d.driver_id
        LEFT JOIN truck_details t ON f.truck_id = t.truck_id
        ${fuelWhere}

        UNION ALL

        SELECT 
          m.maintenance_id as id, 
          m.service_date as date, 
          COALESCE(t.truck_no, 'Vendor') as person_name, 
          'Given' as type, 
          m.cost as amount, 
          COALESCE(m.description, 'Maintenance Cost') as remarks, 
          m.created_at, 
          'maintenance' as source,
          0 as exclude_from_cash_totals
        FROM maintenance_records m
        LEFT JOIN truck_details t ON m.truck_id = t.truck_id
        WHERE m.cost > 0
        ${maintenanceWhere}
      ) base_ledger
    `, filters.date ? [filters.date, filters.date, filters.date, filters.date] : []);

    const { tripRows, settlementByTripId } = await getCustomerSettlementRows(conn);
    let filteredTripRows = tripRows;
    
    if (filters.date) {
      filteredTripRows = tripRows.filter(t => {
        const d = new Date(t.trip_date).toISOString().split('T')[0];
        return d === filters.date;
      });
    }

    const tripExpenseRows = filteredTripRows
      .map((trip) => buildTripExpenseRowFromSettlement(trip, settlementByTripId[trip.trip_id], hasAmountReceived))
      .filter((row) => Number(row.amount || 0) > 0);

    return [...baseRows, ...tripExpenseRows].sort((a, b) => {
      const dateDiff = new Date(b.date) - new Date(a.date);
      if (dateDiff !== 0) return dateDiff;
      const createdDiff = new Date(b.created_at) - new Date(a.created_at);
      if (createdDiff !== 0) return createdDiff;
      return b.id - a.id;
    });
  } finally {
    conn.release();
  }
};

async function resolveTripCustomerForPayment(conn, trip) {
  if (trip.customer_id) {
    const [[customer]] = await conn.query(
      "SELECT customer_id, name FROM customers WHERE customer_id = ? FOR UPDATE",
      [trip.customer_id]
    );
    return customer || null;
  }

  const manualName = String(trip.manual_customer_name || "").trim();
  if (!manualName) return null;

  const [matches] = await conn.query(
    `SELECT customer_id, name
     FROM customers
     WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))
     ORDER BY customer_id ASC`,
    [manualName]
  );

  if (matches.length !== 1) return null;

  const customer = matches[0];
  await conn.query(
    `UPDATE trips
     SET customer_id = ?, manual_customer_name = NULL
     WHERE trip_id = ? AND customer_id IS NULL`,
    [customer.customer_id, trip.trip_id]
  );

  return customer;
}

async function recordTripPayment(tripId, requestedAmount, options = {}) {
  await ensureAmountReceivedColumn();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[trip]] = await conn.query(
      `SELECT trip_id, customer_id, manual_customer_name, amount, destination,
              COALESCE(payment_received, 0) AS payment_received,
              COALESCE(amount_received, 0) AS amount_received
       FROM trips
       WHERE trip_id = ?
       FOR UPDATE`,
      [tripId]
    );

    if (!trip) {
      await conn.rollback();
      return { ok: false, code: "not_found", message: "Trip not found." };
    }

    const customer = await resolveTripCustomerForPayment(conn, trip);
    if (customer && !trip.customer_id) {
      trip.customer_id = customer.customer_id;
      trip.manual_customer_name = null;
    }

    const settlement = await getTripSettlementSnapshot(conn, trip);
    const pendingAmount = Math.max(Number(settlement.pending_amount || 0), 0);

    if (pendingAmount <= 0.0001) {
      await conn.query(
        "UPDATE trips SET payment_received = 1, amount_received = amount WHERE trip_id = ?",
        [tripId]
      );
      await conn.commit();
      return { ok: false, code: "already_paid", message: "Trip is already settled by advance/receipts." };
    }

    let paymentAmount = Number(requestedAmount || 0);
    if (options.markFullyPaid) paymentAmount = pendingAmount;

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      await conn.rollback();
      return { ok: false, code: "invalid_amount", message: "Payment amount must be greater than 0." };
    }

    if (paymentAmount > pendingAmount) {
      await conn.rollback();
      return {
        ok: false,
        code: "exceeds_due",
        message: `Payment exceeds remaining due of ${pendingAmount.toFixed(2)}.`,
      };
    }

    if (trip.customer_id) {
      const paymentDate = options.paymentDate || new Date().toISOString().split("T")[0];
      const paymentMethod = options.paymentMethod || "Cash";
      const paymentNote = options.notes || buildTripPaymentNote(trip, options.markFullyPaid ? "full" : "partial");

      const [existingTripPaymentRows] = await conn.query(
        `SELECT transaction_id, amount
         FROM customer_transactions
         WHERE customer_id = ?
           AND LOWER(TRIM(notes)) REGEXP ?
         ORDER BY transaction_id DESC
         LIMIT 1
         FOR UPDATE`,
        [trip.customer_id, `^(partial )?trip payment received for trip #${trip.trip_id}([[:space:]]|$)`]
      );

      if (existingTripPaymentRows.length > 0) {
        const existingTx = existingTripPaymentRows[0];
        await conn.query(
          `UPDATE customer_transactions
           SET amount = ?,
               payment_method = ?,
               notes = ?,
               payment_date = ?
           WHERE transaction_id = ?`,
          [
            Number(existingTx.amount || 0) + paymentAmount,
            paymentMethod,
            paymentNote,
            paymentDate,
            existingTx.transaction_id,
          ]
        );
      } else {
        await conn.query(
          `INSERT INTO customer_transactions (customer_id, amount, payment_method, notes, payment_date)
           VALUES (?, ?, ?, ?, ?)`,
          [trip.customer_id, paymentAmount, paymentMethod, paymentNote, paymentDate]
        );
      }

      await conn.query(
        "UPDATE customers SET amount_paid = amount_paid + ? WHERE customer_id = ?",
        [paymentAmount, trip.customer_id]
      );

      const refreshedSettlement = await getTripSettlementSnapshot(conn, trip);
      const refreshedReceived = Number(refreshedSettlement.received_amount || 0);
      const refreshedPending = Math.max(Number(refreshedSettlement.pending_amount || 0), 0);

      const [result] = await conn.query(
        `UPDATE trips
         SET amount_received = ?,
             payment_received = CASE WHEN ? <= 0.0001 THEN 1 ELSE 0 END
         WHERE trip_id = ?`,
        [refreshedReceived, refreshedPending, tripId]
      );

      await conn.commit();
      return {
        ok: result.affectedRows > 0,
        code: refreshedPending <= 0.0001 ? "paid" : "partial",
        message: refreshedPending <= 0.0001
          ? "Trip payment recorded and customer balance updated."
          : "Partial trip payment recorded.",
        appliedAmount: paymentAmount,
      };
    }

    const totalAmount = Number(trip.amount || 0);
    const nextReceived = Number(trip.amount_received || 0) + paymentAmount;
    const nextPending = Math.max(totalAmount - nextReceived, 0);
    const [result] = await conn.query(
      `UPDATE trips
       SET amount_received = ?,
           payment_received = CASE WHEN ? <= 0.0001 THEN 1 ELSE 0 END
       WHERE trip_id = ?`,
      [nextReceived, nextPending, tripId]
    );

    await conn.commit();
    return {
      ok: result.affectedRows > 0,
      code: nextPending <= 0.0001 ? "paid" : "partial",
      message: nextPending <= 0.0001 ? "Trip marked as received." : "Partial trip payment recorded.",
      appliedAmount: paymentAmount,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

const markTripPaymentReceived = async (tripId) => {
  return recordTripPayment(tripId, null, { markFullyPaid: true });
};

const createExpense = async (expenseData) => {
  const { date, person_name, type, amount, remarks } = expenseData;
  const [result] = await pool.query(
    "INSERT INTO daily_expenses (date, person_name, type, amount, remarks) VALUES (?, ?, ?, ?, ?)",
    [date, person_name, type, amount, remarks]
  );
  return result.insertId;
};

const deleteExpense = async (id) => {
  const [result] = await pool.query(
    "DELETE FROM daily_expenses WHERE expense_id = ?",
    [id]
  );
  return result.affectedRows;
};

module.exports = {
  getUnifiedExpenses,
  recordTripPayment,
  markTripPaymentReceived,
  createExpense,
  deleteExpense,
};
