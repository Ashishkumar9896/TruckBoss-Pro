require("dotenv").config({ override: true });
const pool = require('../server/config/db');

(async () => {
  try {
    const [columns] = await pool.query("SHOW COLUMNS FROM truck_details");
    console.log("Columns in truck_details:");
    columns.forEach(c => {
      console.log(`${c.Field}: ${c.Type} | Null: ${c.Null} | Key: ${c.Key} | Default: ${c.Default}`);
    });
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
