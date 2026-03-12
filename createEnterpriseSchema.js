require("dotenv").config();
const mysql = require("mysql2/promise");

async function run() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "trucks",
    port: Number(process.env.DB_PORT) || 3306,
  });

  try {
    console.log("Adding status and driver_id to users...");
    try {
      await pool.query("ALTER TABLE users ADD COLUMN driver_id INT DEFAULT NULL;");
    } catch (e) { console.log(e.message); } // Exists
    
    try {
      await pool.query("ALTER TABLE users ADD COLUMN status ENUM('active','suspended') DEFAULT 'active';");
    } catch (e) { console.log(e.message); }

    try {
      await pool.query("ALTER TABLE users ADD CONSTRAINT fk_user_driver FOREIGN KEY (driver_id) REFERENCES driver_details(driver_id) ON DELETE SET NULL;");
    } catch (e) { console.log(e.message); }

    console.log("Creating enterprise RBAC tables...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_name VARCHAR(50) NOT NULL,
        permission_id INT NOT NULL,
        PRIMARY KEY (role_name, permission_id),
        FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        action VARCHAR(100) NOT NULL,
        entity VARCHAR(100) NOT NULL,
        entity_id INT,
        ip_address VARCHAR(45),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("Seeding default permissions...");
    const perms = [
      "create_truck", "edit_truck", "view_truck", "delete_truck",
      "create_trip", "edit_trip", "view_trip", "delete_trip", "view_own_trip",
      "view_dashboard", "view_performance", "create_customer", "view_customer",
      "edit_driver", "view_driver"
    ];

    for (let p of perms) {
      await pool.query("INSERT IGNORE INTO permissions (name) VALUES (?)", [p]);
    }

    // Seed Role Maps Base
    // Admin gets everything
    await pool.query("INSERT IGNORE INTO role_permissions (role_name, permission_id) SELECT 'admin', id FROM permissions;");
    
    // Manager
    const mgrPerms = ['view_truck', 'edit_truck', 'create_truck', 'view_trip', 'edit_trip', 'create_trip', 'view_dashboard', 'view_customer', 'view_driver'];
    for (let p of mgrPerms) {
      await pool.query("INSERT IGNORE INTO role_permissions (role_name, permission_id) SELECT 'manager', id FROM permissions WHERE name=?", [p]);
    }
    
    // Driver
    await pool.query("INSERT IGNORE INTO role_permissions (role_name, permission_id) SELECT 'driver', id FROM permissions WHERE name='view_own_trip';");

    console.log("Migration successful!");
  } catch (err) {
    console.error("Migration error:", err.message);
  } finally {
    pool.end();
  }
}
run();
