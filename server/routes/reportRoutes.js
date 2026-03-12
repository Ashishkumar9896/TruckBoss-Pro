const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const {
  exportTripsPdf,
  exportTripsExcel,
  exportFuelExcel,
  exportMonthlyRevenueExcel,
  exportMonthlyRevenuePdf,
} = require("../controllers/reportController");

const router = express.Router();

router.get("/reports/trips/pdf", asyncHandler(exportTripsPdf));
router.get("/reports/trips/excel", asyncHandler(exportTripsExcel));
router.get("/reports/fuel/excel", asyncHandler(exportFuelExcel));
router.get(
  "/reports/revenue/monthly/excel",
  asyncHandler(exportMonthlyRevenueExcel)
);
router.get(
  "/reports/revenue/monthly/pdf",
  asyncHandler(exportMonthlyRevenuePdf)
);

// Alias for clients expecting the simplified revenue PDF path.
router.get(
  "/reports/revenue/pdf",
  asyncHandler(exportMonthlyRevenuePdf)
);

module.exports = router;
