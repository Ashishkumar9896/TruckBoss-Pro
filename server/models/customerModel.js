const pool = require("../config/db");

async function ensureTripsCustomerDeleteUnblocked() {
  const [[dbRow]] = await pool.query("SELECT DATABASE() AS db_name");
  const dbName = dbRow?.db_name;
  if (!dbName) return;

  const [tripCustomerFks] = await pool.query(
    `SELECT CONSTRAINT_NAME
     FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = 'trips'
       AND COLUMN_NAME = 'customer_id'
       AND REFERENCED_TABLE_NAME IS NOT NULL`,
    [dbName]
  );

  for (const fk of tripCustomerFks) {
    await pool.query(`ALTER TABLE trips DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``);
  }

  const [tripIndexes] = await pool.query("SHOW INDEX FROM trips");
  if (tripIndexes.some((row) => row.Key_name === "fk_trip_customer")) {
    await pool.query("ALTER TABLE trips DROP INDEX `fk_trip_customer`");
  }
}

function normalizeCustomerRow(row) {
  if (!row) return row;

  const totalBilled = Number(row.total_billed ?? row.balance ?? 0);
  const totalReceived = Number(row.amount_paid ?? 0);
  const currentDue = Math.max(totalBilled - totalReceived, 0);
  const advanceAmount = Math.max(totalReceived - totalBilled, 0);
  const rawStatus = row.payment_status;
  const paymentStatus = rawStatus || (advanceAmount > 0 ? "Advance" : currentDue > 0 ? "Partial" : "Paid");

  return {
    ...row,
    amount_paid: totalReceived,
    balance: totalBilled,
    total_billed: totalBilled,
    current_due: Number(row.current_due ?? currentDue),
    advance_amount: Number(row.advance_amount ?? advanceAmount),
    due_age_days: row.due_age_days === null || row.due_age_days === undefined ? null : Number(row.due_age_days),
    total_trips: Number(row.total_trips || 0),
    payment_status: paymentStatus,
  };
}

const CUSTOMER_SUMMARY_QUERY = `
  SELECT
    c.customer_id,
    c.name,
    c.phone_no,
    c.address,
    c.amount_paid,
    c.balance AS total_billed,
    (c.amount_paid - c.balance) AS net,
    GREATEST(c.balance - c.amount_paid, 0) AS current_due,
    GREATEST(c.amount_paid - c.balance, 0) AS advance_amount,
    c.due_date,
    c.follow_up_notes,
    COUNT(t.trip_id) AS total_trips,
    MAX(t.trip_date) AS last_trip_date,
    MAX(tx.payment_date) AS last_payment_date,
    CASE
      WHEN c.amount_paid > c.balance THEN 'Advance'
      WHEN GREATEST(c.balance - c.amount_paid, 0) = 0 THEN 'Paid'
      WHEN c.due_date IS NOT NULL AND c.due_date < CURDATE() THEN 'Overdue'
      ELSE 'Partial'
    END AS payment_status,
    CASE
      WHEN GREATEST(c.balance - c.amount_paid, 0) <= 0 THEN 'Settled'
      WHEN DATEDIFF(CURDATE(), COALESCE(c.due_date, MAX(t.trip_date), DATE(c.created_at))) <= 7 THEN '0-7 days'
      WHEN DATEDIFF(CURDATE(), COALESCE(c.due_date, MAX(t.trip_date), DATE(c.created_at))) <= 30 THEN '8-30 days'
      ELSE '30+ days'
    END AS outstanding_age_bucket,
    CASE
      WHEN GREATEST(c.balance - c.amount_paid, 0) <= 0 THEN NULL
      ELSE GREATEST(DATEDIFF(CURDATE(), COALESCE(c.due_date, MAX(t.trip_date), DATE(c.created_at))), 0)
    END AS due_age_days
  FROM customers c
  LEFT JOIN trips t ON c.customer_id = t.customer_id
  LEFT JOIN customer_transactions tx ON c.customer_id = tx.customer_id
`;

async function recalculateCustomerBalance(customerId) {
  if (!customerId) return;
  await pool.query(
    `UPDATE customers c
     LEFT JOIN (
       SELECT customer_id,
              COALESCE(SUM(amount), 0) AS trip_total
       FROM trips
       WHERE customer_id = ?
       GROUP BY customer_id
     ) t ON c.customer_id = t.customer_id
     SET c.balance = COALESCE(t.trip_total, 0)
     WHERE c.customer_id = ?`,
    [customerId, customerId]
  );
}

async function getDashboardStats() {
  const [[customers]] = await pool.query("SELECT COUNT(*) AS count FROM customers WHERE 1");
  const [[revenue]] = await pool.query("SELECT COALESCE(SUM(amount), 0) AS total FROM trips");
  const [[trucks]] = await pool.query("SELECT COUNT(*) AS count FROM truck_details");
  const [truckStatus] = await pool.query("SELECT status, COUNT(*) AS count FROM truck_details GROUP BY status");
  const [[trips]] = await pool.query("SELECT COUNT(*) AS count FROM trips");
  const [[drivers]] = await pool.query("SELECT COUNT(*) AS count FROM driver_details");
  const [[fuel]] = await pool.query("SELECT COALESCE(SUM(price), 0) AS total FROM fuel_details");

  const profit = { total: Number(revenue.total) - Number(fuel.total) };
  return { customers, revenue, expenses: { total: 0 }, profit, balance, trucks, truckStatus, trips, drivers, fuel };
}

async function getRevenueChart() {
  const [rows] = await pool.query("SELECT name, amount_paid FROM customers ORDER BY amount_paid DESC LIMIT 10");
  return rows;
}

async function getCustomers() {
  const [rows] = await pool.query(
    `${CUSTOMER_SUMMARY_QUERY}
     GROUP BY c.customer_id
     ORDER BY c.created_at DESC`
  );
  return rows.map(normalizeCustomerRow);
}

async function getCustomerById(id) {
  const [rows] = await pool.query(
    `${CUSTOMER_SUMMARY_QUERY}
     WHERE c.customer_id = ?
     GROUP BY c.customer_id`,
    [id]
  );
  return rows.map(normalizeCustomerRow);
}

async function createCustomer(name, phoneNo, address, amountPaid, balance, dueDate, followUpNotes) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      `INSERT INTO customers (name, phone_no, address, amount_paid, balance, due_date, follow_up_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, phoneNo, address, amountPaid, balance, dueDate || null, followUpNotes || null]
    );

    if (Number(amountPaid || 0) > 0) {
      await conn.query(
        `INSERT INTO customer_transactions (customer_id, amount, payment_method, notes, payment_date)
         VALUES (?, ?, ?, ?, CURDATE())`,
        [result.insertId, amountPaid, "Cash", "Opening amount received"]
      );
    }

    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function updateCustomer(id, name, phoneNo, address, amountPaid, balance, dueDate, followUpNotes) {
  const [result] = await pool.query(
    `UPDATE customers
     SET name = ?,
         phone_no = ?,
         address = ?,
         amount_paid = COALESCE(?, amount_paid),
         balance = COALESCE(?, balance),
         due_date = ?,
         follow_up_notes = ?
     WHERE customer_id = ?`,
    [name, phoneNo, address, amountPaid, balance, dueDate || null, followUpNotes || null, id]
  );
  return result;
}

async function addCustomerPayment(customerId, amount, paymentMethod, notes, paymentDate) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [customers] = await conn.query(
      "SELECT customer_id FROM customers WHERE customer_id = ? FOR UPDATE",
      [customerId]
    );

    if (customers.length === 0) {
      await conn.rollback();
      return { affectedRows: 0 };
    }

    await conn.query(
      `INSERT INTO customer_transactions (customer_id, amount, payment_method, notes, payment_date)
       VALUES (?, ?, ?, ?, ?)`,
      [customerId, amount, paymentMethod || "Cash", notes || null, paymentDate]
    );

    const [result] = await conn.query(
      "UPDATE customers SET amount_paid = amount_paid + ? WHERE customer_id = ?",
      [amount, customerId]
    );

    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function getCustomerTransactions(customerId) {
  const [rows] = await pool.query(
    `SELECT transaction_id, customer_id, amount, payment_method, notes, payment_date, created_at
     FROM customer_transactions
     WHERE customer_id = ?
     ORDER BY payment_date DESC, transaction_id DESC`,
    [customerId]
  );
  return rows.map((row) => ({
    ...row,
    amount: Number(row.amount || 0),
  }));
}

async function getCustomerLedger(customerId) {
  const customerRows = await getCustomerById(customerId);
  if (customerRows.length === 0) {
    return null;
  }

  const [ledgerRows] = await pool.query(
    `SELECT *
     FROM (
       SELECT
         CONCAT('trip-', tr.trip_id) AS entry_id,
         'bill' AS entry_type,
         tr.trip_date AS entry_date,
         tr.created_at,
         tr.trip_id AS reference_id,
         CONCAT('Trip Bill ', tr.trip_id) AS title,
         CONCAT(
           CONCAT('Trip Bill ', tr.trip_id),
           CASE WHEN tr.material_type IS NOT NULL AND tr.material_type <> '' THEN CONCAT(' | Material: ', tr.material_type) ELSE '' END
         ) AS notes,
         COALESCE(tr.amount, 0) AS debit_amount,
         0 AS credit_amount,
         NULL AS payment_method
       FROM trips tr
       WHERE tr.customer_id = ?

       UNION ALL

       SELECT
         CONCAT('payment-', tx.transaction_id) AS entry_id,
         'payment' AS entry_type,
         tx.payment_date AS entry_date,
         tx.created_at,
         tx.transaction_id AS reference_id,
         'Payment received' AS title,
         tx.notes,
         0 AS debit_amount,
         tx.amount AS credit_amount,
         tx.payment_method
       FROM customer_transactions tx
       WHERE tx.customer_id = ?
     ) ledger
     ORDER BY entry_date ASC, created_at ASC, entry_id ASC`,
    [customerId, customerId]
  );

  let runningBalance = 0;
  const ledger = ledgerRows.map((row) => {
    const debit = Number(row.debit_amount || 0);
    const credit = Number(row.credit_amount || 0);
    runningBalance += debit - credit;
    return {
      ...row,
      debit_amount: debit,
      credit_amount: credit,
      running_balance: Number(runningBalance.toFixed(2)),
    };
  });

  const [monthlyTrend] = await pool.query(
    `SELECT month,
            SUM(billed_amount) AS billed_amount,
            SUM(received_amount) AS received_amount
     FROM (
       SELECT DATE_FORMAT(tr.trip_date, '%Y-%m') AS month,
              SUM(COALESCE(tr.amount, 0)) AS billed_amount,
              0 AS received_amount
       FROM trips tr
       WHERE tr.customer_id = ?
         AND tr.trip_date >= DATE_SUB(CURDATE(), INTERVAL 5 MONTH)
       GROUP BY DATE_FORMAT(tr.trip_date, '%Y-%m')

       UNION ALL

       SELECT DATE_FORMAT(tx.payment_date, '%Y-%m') AS month,
              0 AS billed_amount,
              SUM(tx.amount) AS received_amount
       FROM customer_transactions tx
       WHERE tx.customer_id = ?
         AND tx.payment_date >= DATE_SUB(CURDATE(), INTERVAL 5 MONTH)
       GROUP BY DATE_FORMAT(tx.payment_date, '%Y-%m')
     ) monthly
     GROUP BY month
     ORDER BY month ASC`,
    [customerId, customerId]
  );

  return {
    customer: customerRows[0],
    ledger,
    monthlyTrend: monthlyTrend.map((row) => ({
      month: row.month,
      billed_amount: Number(row.billed_amount || 0),
      received_amount: Number(row.received_amount || 0),
    })),
  };
}

async function getCustomerInsights() {
  const customers = await getCustomers();
  const [topPayingCustomers] = await pool.query(
    `SELECT customer_id, name, amount_paid
     FROM customers
     ORDER BY amount_paid DESC, name ASC
     LIMIT 5`
  );

  const highestPendingDues = customers
    .filter((row) => Number(row.current_due || 0) > 0)
    .sort((a, b) => Number(b.current_due || 0) - Number(a.current_due || 0))
    .slice(0, 5)
    .map((row) => ({
      customer_id: row.customer_id,
      name: row.name,
      current_due: Number(row.current_due || 0),
      due_date: row.due_date,
      payment_status: row.payment_status,
      outstanding_age_bucket: row.outstanding_age_bucket,
    }));

  const [inactiveCustomers] = await pool.query(
    `SELECT
       c.customer_id,
       c.name,
       MAX(tr.trip_date) AS last_trip_date,
       COUNT(CASE WHEN tr.trip_date >= DATE_SUB(CURDATE(), INTERVAL 60 DAY) THEN 1 END) AS recent_trip_count,
       DATEDIFF(CURDATE(), COALESCE(MAX(tr.trip_date), DATE(c.created_at))) AS inactive_days
     FROM customers c
     LEFT JOIN trips tr ON c.customer_id = tr.customer_id
     GROUP BY c.customer_id, c.name, c.created_at
     HAVING recent_trip_count = 0
     ORDER BY inactive_days DESC, c.name ASC
     LIMIT 5`
  );

  const [billingTrend] = await pool.query(
    `SELECT
       c.customer_id,
       c.name,
       DATE_FORMAT(tr.trip_date, '%Y-%m') AS month,
       SUM(COALESCE(tr.amount, 0)) AS billed_amount
     FROM customers c
     LEFT JOIN trips tr ON c.customer_id = tr.customer_id
     WHERE tr.trip_date >= DATE_SUB(CURDATE(), INTERVAL 5 MONTH)
     GROUP BY c.customer_id, c.name, DATE_FORMAT(tr.trip_date, '%Y-%m')
     ORDER BY c.name ASC, month ASC`
  );

  return {
    topPayingCustomers: topPayingCustomers.map((row) => ({
      customer_id: row.customer_id,
      name: row.name,
      amount_paid: Number(row.amount_paid || 0),
    })),
    highestPendingDues,
    inactiveCustomers: inactiveCustomers.map((row) => ({
      customer_id: row.customer_id,
      name: row.name,
      last_trip_date: row.last_trip_date,
      inactive_days: Number(row.inactive_days || 0),
    })),
    monthlyBillingTrend: billingTrend.map((row) => ({
      customer_id: row.customer_id,
      name: row.name,
      month: row.month,
      billed_amount: Number(row.billed_amount || 0),
    })),
    summary: {
      totalCustomers: customers.length,
      paidCustomers: customers.filter((row) => row.payment_status === "Paid").length,
      overdueCustomers: customers.filter((row) => row.payment_status === "Overdue").length,
      totalCurrentDue: customers.reduce((sum, row) => sum + Number(row.current_due || 0), 0),
    },
  };
}

async function archiveCustomerBeforeDelete(id) {
  await pool.query(
    `INSERT INTO customer_archive (customer_id, name, phone_no, address, amount_paid)
     SELECT customer_id, name, phone_no, address, amount_paid FROM customers WHERE customer_id = ?
     ON DUPLICATE KEY UPDATE
       name = VALUES(name), phone_no = VALUES(phone_no),
       address = VALUES(address), amount_paid = VALUES(amount_paid), deleted_at = CURRENT_TIMESTAMP`,
    [id]
  );
}

async function deleteCustomer(id) {
  await ensureTripsCustomerDeleteUnblocked();
  await archiveCustomerBeforeDelete(id);
  const [result] = await pool.query("DELETE FROM customers WHERE customer_id = ?", [id]);
  return result;
}

async function getCustomerHistory() {
  const [rows] = await pool.query(
    `SELECT
       base.customer_id,
       COALESCE(c.name, ca.name, CONCAT('Unknown Customer #', base.customer_id)) AS name,
       COALESCE(c.phone_no, ca.phone_no, '-') AS phone_no,
       COALESCE(c.address, ca.address, '-') AS address,
       COALESCE(trip_stats.total_trips, 0) AS total_trips,
       trip_stats.last_trip,
       COALESCE(trip_stats.total_revenue, 0) AS total_revenue,
       COALESCE(trip_stats.total_quantity, 0) AS total_quantity,
       CASE
         WHEN c.customer_id IS NULL AND ca.customer_id IS NOT NULL THEN 1
         ELSE 0
       END AS is_deleted
     FROM (
       SELECT customer_id FROM customers
       UNION
       SELECT customer_id FROM customer_archive
       UNION
       SELECT customer_id FROM trips WHERE customer_id IS NOT NULL
     ) base
     LEFT JOIN customers c ON base.customer_id = c.customer_id
     LEFT JOIN customer_archive ca ON base.customer_id = ca.customer_id
     LEFT JOIN (
       SELECT
         customer_id,
         COUNT(trip_id) AS total_trips,
         MAX(trip_date) AS last_trip,
         COALESCE(SUM(amount), 0) AS total_revenue,
         COALESCE(SUM(quantity), 0) AS total_quantity
       FROM trips
       WHERE customer_id IS NOT NULL
       GROUP BY customer_id
     ) trip_stats ON base.customer_id = trip_stats.customer_id
     ORDER BY
       CASE WHEN trip_stats.last_trip IS NULL THEN 1 ELSE 0 END,
       trip_stats.last_trip DESC,
       name ASC`
  );
  return rows;
}

async function getCustomerTripHistory(customerId) {
  const [rows] = await pool.query(
    `SELECT
       tr.trip_id,
       tr.trip_date,
       tr.amount,
       tr.material_type,
       tr.quantity,
       tr.status,
       t.truck_no,
       d.name AS driver_name
     FROM trips tr
     LEFT JOIN truck_details t ON tr.truck_id = t.truck_id
     LEFT JOIN driver_details d ON tr.driver_id = d.driver_id
     WHERE tr.customer_id = ?
     ORDER BY tr.trip_date DESC`,
    [customerId]
  );
  return rows;
}

async function getCustomerMaterialStats(customerId) {
  const [rows] = await pool.query(
    `SELECT
       material_type,
       COUNT(*) AS trip_count,
       COALESCE(SUM(quantity), 0) AS total_quantity
     FROM trips
     WHERE customer_id = ? AND material_type IS NOT NULL
     GROUP BY material_type`,
    [customerId]
  );
  return rows;
}

module.exports = {
  recalculateCustomerBalance,
  getDashboardStats,
  getRevenueChart,
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  addCustomerPayment,
  getCustomerTransactions,
  getCustomerLedger,
  getCustomerInsights,
  deleteCustomer,
  getCustomerHistory,
  getCustomerTripHistory,
  getCustomerMaterialStats,
};
