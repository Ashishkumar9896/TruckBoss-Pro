const mysql = require("mysql2/promise");

const dbUrl = process.env.DATABASE_URL || process.env.MYSQL_URL;
let pool;

if (dbUrl) {
  // If a connection string is provided, we use it.
  // We append dateStrings=true to ensure proper date handling if not already present.
  const separator = dbUrl.includes('?') ? '&' : '?';
  pool = mysql.createPool(dbUrl + separator + "dateStrings=true");
} else {
  const poolConfig = {
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "trucks",
    port: Number(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true,
  };

  if (process.env.DB_SSL === "true") {
    // For many cloud providers, we need to enable SSL.
    poolConfig.ssl = { rejectUnauthorized: true };
  }
  
  pool = mysql.createPool(poolConfig);
}

(async () => {
  try {
    // Basic connectivity check
    await pool.query("SELECT 1");
    console.log("MySQL connected successfully");

    // For migrations, we might need the database name.
    // We try to get it from the pool itself if possible, or from ENV.
    const dbName = process.env.DB_NAME || "trucks";

    const [columns] = await pool.query("SHOW COLUMNS FROM trips");
    const columnNames = columns.map((c) => c.Field);

    const [customerColumns] = await pool.query("SHOW COLUMNS FROM customers");
    const customerColumnNames = customerColumns.map((c) => c.Field);

    const [maintenanceColumns] = await pool.query("SHOW COLUMNS FROM maintenance_records");
    const maintenanceColumnNames = maintenanceColumns.map((c) => c.Field);

    if (!columnNames.includes("material_type")) {
      await pool.query("ALTER TABLE trips ADD COLUMN material_type VARCHAR(255) DEFAULT NULL");
      console.log("Migration: Added material_type to trips table");
    }

    if (!columnNames.includes("quantity")) {
      await pool.query("ALTER TABLE trips ADD COLUMN quantity DECIMAL(12, 2) DEFAULT NULL");
      console.log("Migration: Added quantity to trips table");
    }

    if (!columnNames.includes("manual_customer_name")) {
      await pool.query("ALTER TABLE trips ADD COLUMN manual_customer_name VARCHAR(255) DEFAULT NULL");
      console.log("Migration: Added manual_customer_name to trips table");
    }

    const removedTripColumns = ["from_city", "to_city", "toll_amount", "misc_expenses", "freight_amount"];
    const staleTripColumns = removedTripColumns.filter((name) => columnNames.includes(name));

    const [tripCustomerFks] = await pool.query(`
      SELECT CONSTRAINT_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'trips'
        AND COLUMN_NAME = 'customer_id'
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `, [dbName]);

    for (const fk of tripCustomerFks) {
      await pool.query(`ALTER TABLE trips DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``);
      console.log(`Migration: Dropped trips.customer_id foreign key ${fk.CONSTRAINT_NAME}`);
    }

    if (staleTripColumns.length) {
      await pool.query(`ALTER TABLE trips ${staleTripColumns.map((name) => `DROP COLUMN \`${name}\``).join(", ")}`);
      console.log(`Migration: Dropped obsolete trip columns: ${staleTripColumns.join(", ")}`);
    }

    const [tripIndexes] = await pool.query("SHOW INDEX FROM trips");
    if (tripIndexes.some((row) => row.Key_name === "fk_trip_customer")) {
      await pool.query("ALTER TABLE trips DROP INDEX `fk_trip_customer`");
      console.log("Migration: Dropped obsolete trips.customer_id index fk_trip_customer");
    }

    if (!customerColumnNames.includes("due_date")) {
      await pool.query("ALTER TABLE customers ADD COLUMN due_date DATE DEFAULT NULL");
      console.log("Migration: Added due_date to customers table");
    }

    if (!customerColumnNames.includes("follow_up_notes")) {
      await pool.query("ALTER TABLE customers ADD COLUMN follow_up_notes TEXT DEFAULT NULL");
      console.log("Migration: Added follow_up_notes to customers table");
    }

    if (!maintenanceColumnNames.includes("proof_document")) {
      await pool.query("ALTER TABLE maintenance_records ADD COLUMN proof_document VARCHAR(255) DEFAULT NULL");
      console.log("Migration: Added proof_document to maintenance_records table");
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS customer_transactions (
        transaction_id INT NOT NULL AUTO_INCREMENT,
        customer_id INT NOT NULL,
        amount DECIMAL(12, 2) NOT NULL,
        payment_method VARCHAR(50) NOT NULL DEFAULT 'Cash',
        notes VARCHAR(255) DEFAULT NULL,
        payment_date DATE NOT NULL,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (transaction_id),
        KEY idx_customer_transactions_customer_id (customer_id),
        CONSTRAINT fk_customer_transactions_customer
          FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
          ON DELETE CASCADE
      )
    `);
    console.log("Migration: Ensured customer_transactions table exists");

    const [transactionColumns] = await pool.query("SHOW COLUMNS FROM customer_transactions");
    const transactionColumnNames = transactionColumns.map((c) => c.Field);

    if (!transactionColumnNames.includes("payment_method")) {
      await pool.query(
        "ALTER TABLE customer_transactions ADD COLUMN payment_method VARCHAR(50) NOT NULL DEFAULT 'Cash' AFTER amount"
      );
      console.log("Migration: Added payment_method to customer_transactions table");
    }

    await pool.query(`
      INSERT INTO customer_transactions (customer_id, amount, notes, payment_date)
      SELECT c.customer_id,
             c.amount_paid,
             'Opening amount received',
             DATE(COALESCE(c.created_at, CURRENT_TIMESTAMP))
      FROM customers c
      LEFT JOIN (
        SELECT customer_id, COUNT(*) AS tx_count
        FROM customer_transactions
        GROUP BY customer_id
      ) tx ON tx.customer_id = c.customer_id
      WHERE c.amount_paid > 0
        AND COALESCE(tx.tx_count, 0) = 0
    `);
    console.log("Migration: Seeded customer opening payments where missing");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS daily_expenses (
        expense_id INT NOT NULL AUTO_INCREMENT,
        date DATE NOT NULL,
        person_name VARCHAR(100) NOT NULL,
        type ENUM('Received', 'Given', 'Advance') NOT NULL,
        amount DECIMAL(12, 2) NOT NULL,
        remarks VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (expense_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);
    console.log("Migration: Ensured daily_expenses table exists");

    // Add payment_received flag to trips if not present
    const [tripCols] = await pool.query(`SHOW COLUMNS FROM trips LIKE 'payment_received'`);
    if (tripCols.length === 0) {
      await pool.query(`ALTER TABLE trips ADD COLUMN payment_received TINYINT(1) NOT NULL DEFAULT 0`);
      console.log("Migration: Added payment_received column to trips");
    }

    const [tripAmountReceivedCols] = await pool.query(`SHOW COLUMNS FROM trips LIKE 'amount_received'`);
    if (tripAmountReceivedCols.length === 0) {
      await pool.query(`ALTER TABLE trips ADD COLUMN amount_received DECIMAL(12, 2) NOT NULL DEFAULT 0.00`);
      console.log("Migration: Added amount_received column to trips");
    }

    // --- Performance Optimization Indices ---
    const [existingIndexes] = await pool.query(`
      SELECT INDEX_NAME, TABLE_NAME 
      FROM information_schema.STATISTICS 
      WHERE TABLE_SCHEMA = ?
    `, [dbName]);

    const hasIndex = (table, name) => existingIndexes.some(idx => idx.TABLE_NAME === table && idx.INDEX_NAME === name);

    // Trips table indices
    if (!hasIndex('trips', 'idx_trips_date')) {
      await pool.query("CREATE INDEX idx_trips_date ON trips(trip_date)");
      console.log("Migration: Added index on trips(trip_date)");
    }
    if (!hasIndex('trips', 'idx_trips_status')) {
      await pool.query("CREATE INDEX idx_trips_status ON trips(status)");
      console.log("Migration: Added index on trips(status)");
    }
    if (!hasIndex('trips', 'idx_trips_customer_id')) {
      await pool.query("CREATE INDEX idx_trips_customer_id ON trips(customer_id)");
      console.log("Migration: Added index on trips(customer_id)");
    }

    // Daily Expenses table index
    if (!hasIndex('daily_expenses', 'idx_expenses_date')) {
      await pool.query("CREATE INDEX idx_expenses_date ON daily_expenses(date)");
      console.log("Migration: Added index on daily_expenses(date)");
    }

    // Customers table indices
    if (!hasIndex('customers', 'idx_customers_due_date')) {
      await pool.query("CREATE INDEX idx_customers_due_date ON customers(due_date)");
      console.log("Migration: Added index on customers(due_date)");
    }

    // Maintenance Records index
    if (!hasIndex('maintenance_records', 'idx_mtn_service_date')) {
      await pool.query("CREATE INDEX idx_mtn_service_date ON maintenance_records(service_date)");
      console.log("Migration: Added index on maintenance_records(service_date)");
    }
    // -----------------------------------------

  } catch (err) {
    console.error("MySQL connection/migration failed:", err.message);
  }
})();

module.exports = pool;
