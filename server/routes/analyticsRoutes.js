const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const { getTripProfitability } = require("../controllers/analyticsController");

const router = express.Router();

router.get(
  "/analytics/trip-profitability",
  authorizeRoles("admin", "manager"),
  asyncHandler(getTripProfitability)
);

module.exports = router;
