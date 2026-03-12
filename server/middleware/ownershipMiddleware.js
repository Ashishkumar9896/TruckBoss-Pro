const pool = require("../config/db");

function checkTripOwnership() {
  return async (req, res, next) => {
    try {
      if (req.user && req.user.role === "driver") {
        const tripId = req.params.id;
        if (!tripId) return next(); // Not a specific trip route

        const [rows] = await pool.query("SELECT driver_id FROM trips WHERE trip_id = ?", [tripId]);
        if (rows.length === 0) {
          return res.status(404).json({ error: "Trip not found" });
        }

        if (rows[0].driver_id !== req.user.driver_id) {
          return res.status(403).json({ error: "Unauthorized. You do not own this trip." });
        }
      }
      next();
    } catch (err) {
      return res.status(500).json({ error: "Internal server error during ownership validation." });
    }
  };
}

module.exports = { checkTripOwnership };
