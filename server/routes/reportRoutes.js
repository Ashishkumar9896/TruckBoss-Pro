const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const {
  exportTripsPdf,
  exportTripsExcel,
  exportFuelExcel,
  exportMonthlyRevenueExcel,
  exportMonthlyRevenuePdf,
  exportDailyRevenuePdf,
  exportDailyRevenueExcel,
  getCustomerOutstandingReport,
  getCustomerLedgerReport,
  getDailyCollectionReport,
  getMonthlyCollectionReport,
  getTruckProfitabilityReport,
  getDriverPerformanceReport,
  getFuelConsumptionReport,
  getMaintenanceExpenseReport,
  getDocumentExpiryReport,
  getMonthlyBusinessSummary,
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
router.get(
  "/reports/revenue/daily/pdf",
  asyncHandler(exportDailyRevenuePdf)
);
router.get(
  "/reports/revenue/daily/excel",
  asyncHandler(exportDailyRevenueExcel)
);

router.get(
  "/reports/revenue/pdf",
  asyncHandler(exportMonthlyRevenuePdf)
);

router.get("/reports/customer-outstanding", asyncHandler(getCustomerOutstandingReport));
router.get("/reports/customer-ledger", asyncHandler(getCustomerLedgerReport));
router.get("/reports/collection/daily", asyncHandler(getDailyCollectionReport));
router.get("/reports/collection/monthly", asyncHandler(getMonthlyCollectionReport));
router.get("/reports/truck-profitability", asyncHandler(getTruckProfitabilityReport));
router.get("/reports/driver-performance", asyncHandler(getDriverPerformanceReport));
router.get("/reports/fuel-consumption", asyncHandler(getFuelConsumptionReport));
router.get("/reports/maintenance-expense", asyncHandler(getMaintenanceExpenseReport));
router.get("/reports/document-expiry", asyncHandler(getDocumentExpiryReport));
router.get("/reports/business-summary", asyncHandler(getMonthlyBusinessSummary));

module.exports = router;
