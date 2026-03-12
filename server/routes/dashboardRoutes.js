const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const {
  getStats,
  getRevenueChartData,
  getDashboardMetrics,
  getDashboardAnalytics,
  getFuelEfficiency,
  getMaintenanceForecast
} = require("../controllers/dashboardController");

const router = express.Router();

router.get("/dashboard/stats", authorizeRoles("admin", "manager"), asyncHandler(getStats));
router.get(
  "/dashboard/revenue-chart",
  authorizeRoles("admin", "manager"),
  asyncHandler(getRevenueChartData)
);

router.get(
  "/dashboard/metrics",
  authorizeRoles("admin", "manager"),
  asyncHandler(getDashboardMetrics)
);

router.get(
  "/dashboard/analytics",
  authorizeRoles("admin", "manager"),
  asyncHandler(getDashboardAnalytics)
);

router.get(
  "/dashboard/efficiency",
  authorizeRoles("admin", "manager"),
  asyncHandler(getFuelEfficiency)
);

router.get(
  "/dashboard/maintenance-forecast",
  authorizeRoles("admin", "manager"),
  asyncHandler(getMaintenanceForecast)
);

module.exports = router;
