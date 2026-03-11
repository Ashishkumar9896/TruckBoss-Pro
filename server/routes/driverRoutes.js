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
const { authorizeRoles } = require("../middleware/roleMiddleware");
const { validateDriver, handleValidationErrors } = require("../middleware/validation");

const router = express.Router();

router.get("/drivers/performance", authorizeRoles("admin", "manager"), asyncHandler(getPerformance));
router.get("/drivers", authorizeRoles("admin", "manager"), asyncHandler(listDrivers));
router.get("/drivers/:id", authorizeRoles("admin", "manager"), asyncHandler(getDriver));
router.post(
  "/drivers",
  authorizeRoles("admin", "manager"),
  validateDriver,
  handleValidationErrors,
  asyncHandler(addDriver)
);
router.put("/drivers/:id", authorizeRoles("admin", "manager"), asyncHandler(editDriver));
router.delete("/drivers/:id", authorizeRoles("admin", "manager"), asyncHandler(removeDriver));

module.exports = router;
