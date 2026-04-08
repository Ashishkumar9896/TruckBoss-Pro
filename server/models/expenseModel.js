const pool = require("../config/db");

const getUnifiedExpenses = async () => {
  const query = `
    SELECT 
      *
    FROM (
      -- 1. Daily Manual Expenses
      SELECT 
        expense_id as id, 
        date, 
        person_name, 
        type, 
        amount, 
        remarks, 
        created_at, 
        'manual' as source 
      FROM daily_expenses

      UNION ALL

      -- 2. Customer Payments Received
      SELECT 
        ct.transaction_id as id, 
        ct.payment_date as date, 
        c.name as person_name, 
        'Received' as type, 
        ct.amount, 
        CONCAT('Customer Payment', IF(ct.notes IS NOT NULL AND ct.notes != '', CONCAT(' - ', ct.notes), '')) as remarks, 
        ct.created_at, 
        'customer' as source
      FROM customer_transactions ct
      JOIN customers c ON ct.customer_id = c.customer_id

      UNION ALL

      -- 3. Fuel Expenses
      SELECT 
        f.fuel_id as id, 
        f.fuel_date as date, 
        COALESCE(d.name, t.truck_no, 'Fuel Station') as person_name, 
        'Given' as type, 
        f.price as amount, 
        'Fuel Cost' as remarks, 
        f.created_at, 
        'fuel' as source
      FROM fuel_details f
      LEFT JOIN driver_details d ON f.driver_id = d.driver_id
      LEFT JOIN truck_details t ON f.truck_id = t.truck_id

      UNION ALL

      -- 4. Maintenance Expenses
      SELECT 
        m.maintenance_id as id, 
        m.service_date as date, 
        COALESCE(t.truck_no, 'Vendor') as person_name, 
        'Given' as type, 
        m.cost as amount, 
        COALESCE(m.description, 'Maintenance Cost') as remarks, 
        m.created_at, 
        'maintenance' as source
      FROM maintenance_records m
      LEFT JOIN truck_details t ON m.truck_id = t.truck_id
      WHERE m.cost > 0

      UNION ALL

      -- 5. Trip Bills — Owed until marked as Received
      SELECT 
        tr.trip_id as id, 
        tr.trip_date as date, 
        COALESCE(c.name, tr.manual_customer_name, 'Unknown Customer') as person_name, 
        CASE WHEN tr.payment_received = 1 THEN 'Received' ELSE 'Owed' END as type, 
        tr.amount, 
        CONCAT(
          'Trip Freight Bill',
          CASE WHEN tr.destination IS NOT NULL AND tr.destination != '' THEN CONCAT(' to ', tr.destination) ELSE '' END,
          CASE WHEN tr.payment_received = 1 THEN ' [Paid]' ELSE '' END
        ) as remarks, 
        tr.created_at, 
        'trip' as source
      FROM trips tr
      LEFT JOIN customers c ON tr.customer_id = c.customer_id
      WHERE tr.amount > 0
    ) as unified_ledger
    ORDER BY date DESC, created_at DESC;
  `;

  const [rows] = await pool.query(query);
  return rows;
};

const markTripPaymentReceived = async (tripId) => {
  const [result] = await pool.query(
    "UPDATE trips SET payment_received = 1 WHERE trip_id = ?",
    [tripId]
  );
  return result.affectedRows;
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
  markTripPaymentReceived,
  createExpense,
  deleteExpense,
};
