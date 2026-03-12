const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function setup() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'ashish9896',
    database: 'trucks',
    port: 3307
  });

  const hash = await bcrypt.hash('password123', 10);
  
  // Admin
  await conn.execute(`INSERT IGNORE INTO users (full_name, email, password, role, status) VALUES ('Admin User', 'admin@tb.com', ?, 'admin', 'active')`, [hash]);
  
  // Manager
  await conn.execute(`INSERT IGNORE INTO users (full_name, email, password, role, status) VALUES ('Manager User', 'manager@tb.com', ?, 'manager', 'active')`, [hash]);

  // Driver Row 
  try {
    await conn.execute(`INSERT IGNORE INTO driver_details (name, licence_no, phone_no, status, salary) VALUES ('Test Driver', 'DL12345', '9999999999', 'active', 50000)`);
  } catch (e) {}
  
  const [drivers] = await conn.execute(`SELECT driver_id FROM driver_details WHERE name='Test Driver'`);
  const dId = drivers[0] ? drivers[0].driver_id : null;

  if (dId !== null) {
    // Driver User
    await conn.execute(`INSERT IGNORE INTO users (full_name, email, password, role, driver_id, status) VALUES ('Driver User', 'driver@tb.com', ?, 'driver', ?, 'active')`, [hash, dId]);
  }

  console.log("Test users setup complete:");
  console.log("Admin: admin@tb.com / password123");
  console.log("Manager: manager@tb.com / password123");
  console.log("Driver: driver@tb.com / password123");
  
  await conn.end();
}

setup().catch(console.error);
