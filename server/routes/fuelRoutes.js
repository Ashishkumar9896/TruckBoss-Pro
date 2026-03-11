const express = require("express");
const {
  listFuel,
  addFuel,
  removeFuel,
} = require("../controllers/fuelController");
const asyncHandler = require("../middleware/asyncHandler");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const {
  validateFuel,
  handleValidationErrors,
} = require("../middleware/validation");

const router = express.Router();

router.get("/fuel", authorizeRoles("admin", "manager", "driver"), asyncHandler(listFuel));
router.post(
  "/fuel",
  authorizeRoles("admin", "manager"),
  validateFuel,
  handleValidationErrors,
  asyncHandler(addFuel)
);
router.delete("/fuel/:id", authorizeRoles("admin", "manager"), asyncHandler(removeFuel));

module.exports = router;
