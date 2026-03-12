const express = require("express");
const {
  listTrips,
  addTrip,
  editTrip,
  removeTrip,
} = require("../controllers/tripController");
const asyncHandler = require("../middleware/asyncHandler");
const {
  validateTrip,
  handleValidationErrors,
} = require("../middleware/validation");

const router = express.Router();

router.get("/trips", asyncHandler(listTrips));
router.post(
  "/trips",
  validateTrip,
  handleValidationErrors,
  asyncHandler(addTrip)
);
router.put("/trips/:id", asyncHandler(editTrip));
router.delete("/trips/:id", asyncHandler(removeTrip));

module.exports = router;
