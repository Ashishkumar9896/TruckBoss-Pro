const express = require("express");
const {
  getStatusSummary,
  listTrucks,
  getTruck,
  addTruck,
  editTruck,
  removeTruck,
} = require("../controllers/truckController");
const asyncHandler = require("../middleware/asyncHandler");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const { validateTruck, handleValidationErrors } = require("../middleware/validation");

const router = express.Router();

router.get("/trucks/summary/status", authorizeRoles("admin", "manager"), asyncHandler(getStatusSummary));
router.get("/trucks", authorizeRoles("admin", "manager", "driver"), asyncHandler(listTrucks));
router.get("/trucks/:id", authorizeRoles("admin", "manager", "driver"), asyncHandler(getTruck));
router.post(
  "/trucks",
  authorizeRoles("admin", "manager"),
  validateTruck,
  handleValidationErrors,
  asyncHandler(addTruck)
);
router.put("/trucks/:id", authorizeRoles("admin", "manager"), asyncHandler(editTruck));
router.delete("/trucks/:id", authorizeRoles("admin", "manager"), asyncHandler(removeTruck));

module.exports = router;
