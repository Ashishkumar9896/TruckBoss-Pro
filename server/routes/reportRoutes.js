const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const {
  exportTripsPdf,
  exportTripsExcel,
  exportFuelExcel,
  exportMonthlyRevenueExcel,
  exportMonthlyRevenuePdf,
} = require("../controllers/reportController");

const router = express.Router();

router.get("/reports/trips/pdf", authorizeRoles("admin", "manager"), asyncHandler(exportTripsPdf));
router.get("/reports/trips/excel", authorizeRoles("admin", "manager"), asyncHandler(exportTripsExcel));
router.get("/reports/fuel/excel", authorizeRoles("admin", "manager"), asyncHandler(exportFuelExcel));
router.get(
  "/reports/revenue/monthly/excel",
  authorizeRoles("admin", "manager"),
  asyncHandler(exportMonthlyRevenueExcel)
);
router.get(
  "/reports/revenue/monthly/pdf",
  authorizeRoles("admin", "manager"),
  asyncHandler(exportMonthlyRevenuePdf)
);

module.exports = router;
