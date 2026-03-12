const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const { getTripProfitability } = require("../controllers/analyticsController");

const router = express.Router();

router.get(
  "/analytics/trip-profitability",
  asyncHandler(getTripProfitability)
);

module.exports = router;
