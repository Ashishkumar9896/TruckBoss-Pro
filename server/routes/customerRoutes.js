const express = require("express");
const {
  listCustomers,
  listOneTimeCustomers,
  getCustomer,
  addCustomer,
  editCustomer,
  addCustomerPaymentHandler,
  listCustomerTransactions,
  getCustomerLedgerHandler,
  getCustomerInsightsHandler,
  removeCustomer,
  listCustomerHistory,
  getCustomerTripHistoryHandler,
  getCustomerMaterialStatsHandler,
} = require("../controllers/customerController");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

router.get("/customers", asyncHandler(listCustomers));
router.get("/customers/one-time", asyncHandler(listOneTimeCustomers));
router.get("/customers/insights", asyncHandler(getCustomerInsightsHandler));
router.get("/customers/history", asyncHandler(listCustomerHistory));
router.get("/customers/:id", asyncHandler(getCustomer));
router.get("/customers/:id/trips", asyncHandler(getCustomerTripHistoryHandler));
router.get("/customers/:id/material-stats", asyncHandler(getCustomerMaterialStatsHandler));
router.get("/customers/:id/transactions", asyncHandler(listCustomerTransactions));
router.get("/customers/:id/ledger", asyncHandler(getCustomerLedgerHandler));
router.post("/customers", asyncHandler(addCustomer));
router.post("/customers/:id/payments", asyncHandler(addCustomerPaymentHandler));
router.put("/customers/:id", asyncHandler(editCustomer));
router.delete("/customers/:id", asyncHandler(removeCustomer));

module.exports = router;
