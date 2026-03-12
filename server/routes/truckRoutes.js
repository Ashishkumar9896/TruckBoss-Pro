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
const { validateTruck, handleValidationErrors } = require("../middleware/validation");

const router = express.Router();

router.get("/trucks/summary/status", asyncHandler(getStatusSummary));
router.get("/trucks", asyncHandler(listTrucks));
router.get("/trucks/:id", asyncHandler(getTruck));
router.post(
  "/trucks",
  validateTruck,
  handleValidationErrors,
  asyncHandler(addTruck)
);
router.put("/trucks/:id", asyncHandler(editTruck));
router.delete("/trucks/:id", asyncHandler(removeTruck));

module.exports = router;
