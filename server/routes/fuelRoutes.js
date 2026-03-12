const express = require("express");
const {
  listFuel,
  addFuel,
  removeFuel,
} = require("../controllers/fuelController");
const asyncHandler = require("../middleware/asyncHandler");
const {
  validateFuel,
  handleValidationErrors,
} = require("../middleware/validation");

const router = express.Router();

router.get("/fuel", asyncHandler(listFuel));
router.post(
  "/fuel",
  validateFuel,
  handleValidationErrors,
  asyncHandler(addFuel)
);
router.delete("/fuel/:id", asyncHandler(removeFuel));

module.exports = router;
