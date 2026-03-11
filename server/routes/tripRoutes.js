const express = require("express");
const {
  listTrips,
  addTrip,
  editTrip,
  removeTrip,
} = require("../controllers/tripController");
const asyncHandler = require("../middleware/asyncHandler");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const {
  validateTrip,
  handleValidationErrors,
} = require("../middleware/validation");

const router = express.Router();

router.get("/trips", authorizeRoles("admin", "manager", "driver"), asyncHandler(listTrips));
router.post(
  "/trips",
  authorizeRoles("admin", "manager"),
  validateTrip,
  handleValidationErrors,
  asyncHandler(addTrip)
);
router.put("/trips/:id", authorizeRoles("admin", "manager"), asyncHandler(editTrip));
router.delete("/trips/:id", authorizeRoles("admin", "manager"), asyncHandler(removeTrip));

module.exports = router;
