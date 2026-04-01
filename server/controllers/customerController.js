const {
  getCustomers,
  getCustomerById,
  getOneTimeCustomers,
  createCustomer,
  updateCustomer,
  addCustomerPayment,
  getCustomerTransactions,
  getCustomerLedger,
  getCustomerInsights,
  deleteCustomer,
  recalculateCustomerBalance,
  getCustomerHistory,
  getCustomerTripHistory,
  getCustomerMaterialStats,
} = require("../models/customerModel");

const { checkActiveTrips } = require("../models/tripModel");

async function listCustomers(req, res, next) {
  try {
    const rows = await getCustomers();
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
}

async function listOneTimeCustomers(req, res, next) {
  try {
    const rows = await getOneTimeCustomers();
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
}

async function getCustomer(req, res, next) {
  try {
    const rows = await getCustomerById(req.params.id);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }
    return res.json(rows[0]);
  } catch (err) {
    return next(err);
  }
}

async function addCustomer(req, res, next) {
  try {
    const { name, phone_no, address, amount_paid = 0, balance = 0, due_date, follow_up_notes } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const result = await createCustomer(
      name,
      phone_no || null,
      address || null,
      amount_paid,
      balance,
      due_date || null,
      follow_up_notes || null
    );
    return res.status(201).json({ customer_id: result.insertId, message: "Customer created" });
  } catch (err) {
    return next(err);
  }
}

async function editCustomer(req, res, next) {
  try {
    const { name, phone_no, address, amount_paid, balance, due_date, follow_up_notes } = req.body;
    const result = await updateCustomer(
      req.params.id,
      name,
      phone_no || null,
      address || null,
      amount_paid,
      balance,
      due_date || null,
      follow_up_notes || null
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }

    await recalculateCustomerBalance(req.params.id);
    return res.json({ message: "Customer updated" });
  } catch (err) {
    return next(err);
  }
}

async function addCustomerPaymentHandler(req, res, next) {
  try {
    const { amount, payment_method, notes, payment_date } = req.body;
    const normalizedAmount = Number(amount);

    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      return res.status(400).json({ error: "Payment amount must be greater than 0" });
    }

    const paymentDate = payment_date || new Date().toISOString().split("T")[0];
    const result = await addCustomerPayment(
      req.params.id,
      normalizedAmount,
      payment_method || "Cash",
      notes,
      paymentDate
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }

    return res.status(201).json({ message: "Payment added" });
  } catch (err) {
    return next(err);
  }
}

async function listCustomerTransactions(req, res, next) {
  try {
    const customer = await getCustomerById(req.params.id);
    if (customer.length === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const rows = await getCustomerTransactions(req.params.id);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
}

async function getCustomerLedgerHandler(req, res, next) {
  try {
    const ledger = await getCustomerLedger(req.params.id);
    if (!ledger) {
      return res.status(404).json({ error: "Customer not found" });
    }
    return res.json(ledger);
  } catch (err) {
    return next(err);
  }
}

async function getCustomerInsightsHandler(req, res, next) {
  try {
    const insights = await getCustomerInsights();
    return res.json(insights);
  } catch (err) {
    return next(err);
  }
}

async function removeCustomer(req, res, next) {
  try {
    const result = await deleteCustomer(req.params.id);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }
    return res.json({ message: "Customer deleted" });
  } catch (err) {
    return next(err);
  }
}

async function listCustomerHistory(req, res, next) {
  try {
    const rows = await getCustomerHistory();
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
}

async function getCustomerTripHistoryHandler(req, res, next) {
  try {
    const rows = await getCustomerTripHistory(req.params.id);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
}

async function getCustomerMaterialStatsHandler(req, res, next) {
  try {
    const rows = await getCustomerMaterialStats(req.params.id);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
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
};
