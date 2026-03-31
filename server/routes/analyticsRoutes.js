const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const { getTripProfitability, getRouteProfitability } = require("../controllers/analyticsController");

const router = express.Router();

router.get(
  "/analytics/trip-profitability",
  asyncHandler(getTripProfitability)
);
router.get(
  "/analytics/route-profitability",
  asyncHandler(getRouteProfitability)
);

module.exports = router;
