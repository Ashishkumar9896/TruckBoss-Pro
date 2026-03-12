require('dotenv').config();
const mysql = require('mysql2/promise');

async function check() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'ashish9896',
    port: process.env.DB_PORT || 3307
  });
  
  const [dbs] = await conn.execute('SHOW DATABASES');
  console.log("Databases:");
  console.log(dbs.map(d => d.Database));

  const [users] = await conn.execute('SELECT email, role FROM trucks.users LIMIT 5');
  console.log("Users in trucks database:");
  console.log(users);
  
  await conn.end();
}
check().catch(e => console.error(e));
