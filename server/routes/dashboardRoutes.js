const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const {
  getStats,
  getRevenueChartData,
  getDashboardMetrics,
  getDashboardAnalytics,
  getFuelEfficiency,
  getMaintenanceForecast
} = require("../controllers/dashboardController");

const router = express.Router();

router.get("/dashboard/stats", asyncHandler(getStats));
router.get(
  "/dashboard/revenue-chart",
  asyncHandler(getRevenueChartData)
);

router.get(
  "/dashboard/metrics",
  asyncHandler(getDashboardMetrics)
);

router.get(
  "/dashboard/analytics",
  asyncHandler(getDashboardAnalytics)
);

router.get(
  "/dashboard/efficiency",
  asyncHandler(getFuelEfficiency)
);

router.get(
  "/dashboard/maintenance-forecast",
  asyncHandler(getMaintenanceForecast)
);

module.exports = router;
