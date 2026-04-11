require("dotenv").config({ override: true });
const pool = require('../server/config/db');
const { updateTruck, getTruckById } = require('../server/models/truckModel');

(async () => {
  try {
    // 1. Find a truck with an assigned driver
    const [trucks] = await pool.query("SELECT * FROM truck_details WHERE driver_id IS NOT NULL LIMIT 1");
    if (trucks.length === 0) {
      console.log("No trucks with assigned drivers found to test unassignment.");
      process.exit(0);
    }

    const testTruck = trucks[0];
    const originalDriverId = testTruck.driver_id;
    console.log(`Testing unassignment for Truck ${testTruck.truck_no} (ID: ${testTruck.truck_id}, Current Driver: ${originalDriverId})`);

    // 2. Perform unassignment (passing null)
    await updateTruck(testTruck.truck_id, testTruck.truck_no, null, testTruck.status, testTruck.maintenance);
    console.log("Update query executed (driver_id = null).");

    // 3. Verify unassignment
    const updatedTrucks = await getTruckById(testTruck.truck_id);
    const updatedTruck = updatedTrucks[0];

    if (updatedTruck.driver_id === null) {
      console.log("SUCCESS: Driver successfully unassigned (driver_id is null).");
      
      // 4. Restore original driver (cleanup)
      await updateTruck(testTruck.truck_id, testTruck.truck_no, originalDriverId, testTruck.status, testTruck.maintenance);
      console.log("Cleanup: Restored original driver assignment.");
    } else {
      console.error(`FAILURE: Driver ID is still ${updatedTruck.driver_id}`);
    }

    process.exit(0);
  } catch (err) {
    console.error("Test failed with error:", err);
    process.exit(1);
  }
})();
