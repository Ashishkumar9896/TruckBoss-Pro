const express = require("express");
const {
  listDrivers,
  getDriver,
  addDriver,
  editDriver,
  removeDriver,
  getPerformance,
} = require("../controllers/driverController");
const asyncHandler = require("../middleware/asyncHandler");
const { validateDriver, handleValidationErrors } = require("../middleware/validation");

const router = express.Router();

router.get("/drivers/performance", asyncHandler(getPerformance));
router.get("/drivers", asyncHandler(listDrivers));
router.get("/drivers/:id", asyncHandler(getDriver));
router.post(
  "/drivers",
  validateDriver,
  handleValidationErrors,
  asyncHandler(addDriver)
);
router.put("/drivers/:id", asyncHandler(editDriver));
router.delete("/drivers/:id", asyncHandler(removeDriver));

module.exports = router;
