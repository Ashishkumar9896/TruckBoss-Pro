const express = require("express");
const router = express.Router();
const expenseController = require("../controllers/expenseController");

// Unified Ledger
router.get("/expenses", expenseController.getExpenses);

// Manual Expenses
router.post("/expenses", expenseController.addExpense);
router.delete("/expenses/:id", expenseController.deleteManualExpense);

// Mark Trip as Paid
router.patch("/expenses/trips/:id/mark-paid", expenseController.markTripPaid);

module.exports = router;
