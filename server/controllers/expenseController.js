const expenseModel = require("../models/expenseModel");

const getExpenses = async (req, res) => {
  try {
    const { date } = req.query;
    const expenses = await expenseModel.getUnifiedExpenses({ date });
    
    // Calculate summary metrics (Received, Given)
    // "Advance" is usually treated as a type of given/receivable, but let's separate it for clarity if needed. 
    // Usually given and advance are money out. Received is money in.
    let totalReceived = 0;
    let totalGiven = 0;
    
    // We can calculate daily metrics or total metrics here if frontend needs it
    // For simplicity, let's just return the list and let frontend do calculations or just do total
    expenses.forEach((exp) => {
      const amount = parseFloat(exp.amount) || 0;
      if (exp.type === "Received") {
        totalReceived += amount;
      } else if (exp.type === "Given" || exp.type === "Advance") {
        totalGiven += amount;
      }
    });

    res.status(200).json({
      success: true,
      data: expenses,
      summary: {
        totalReceived,
        totalGiven,
        netBalance: totalReceived - totalGiven
      }
    });
  } catch (err) {
    console.error("Error fetching expenses:", err);
    res.status(500).json({
      success: false,
      message: err.sqlMessage || err.message || "Failed to load expenses.",
      code: err.code || undefined,
    });
  }
};

const addExpense = async (req, res) => {
  try {
    const { date, person_name, type, amount, remarks } = req.body;
    if (!date || !person_name || !type || amount === undefined) {
      return res.status(400).json({ success: false, message: "Missing required fields." });
    }

    const expenseId = await expenseModel.createExpense({
      date,
      person_name,
      type,
      amount,
      remarks,
    });

    res.status(201).json({ success: true, message: "Expense added successfully", expenseId });
  } catch (err) {
    console.error("Error adding expense:", err);
    res.status(500).json({ success: false, message: "Failed to add expense." });
  }
};

const deleteManualExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const affectedRows = await expenseModel.deleteExpense(id);
    
    if (affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Expense not found or unable to delete." });
    }
    
    res.status(200).json({ success: true, message: "Expense deleted successfully" });
  } catch (err) {
    console.error("Error deleting expense:", err);
    res.status(500).json({ success: false, message: "Failed to delete expense." });
  }
};

const markTripPaid = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await expenseModel.markTripPaymentReceived(id);
    if (!result.ok) {
      if (result.code === "already_paid") {
        return res.status(409).json({ success: false, message: result.message });
      }
      if (result.code === "not_found") {
        return res.status(404).json({ success: false, message: result.message });
      }
      return res.status(400).json({ success: false, message: result.message || "Failed to update trip." });
    }
    res.status(200).json({ success: true, message: result.message || "Trip marked as received." });
  } catch (err) {
    console.error("Error marking trip paid:", err);
    res.status(500).json({ success: false, message: "Failed to update trip." });
  }
};

module.exports = {
  getExpenses,
  addExpense,
  deleteManualExpense,
  markTripPaid,
};
