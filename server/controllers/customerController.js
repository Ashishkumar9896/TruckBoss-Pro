const {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  recalculateCustomerBalance,
} = require("../models/customerModel");

async function listCustomers(req, res, next) {
  try {
    const rows = await getCustomers();
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
    const { name, phone_no, address, amount_paid = 0, balance = 0 } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const result = await createCustomer(name, phone_no || null, address || null, amount_paid, balance);
    return res.status(201).json({ customer_id: result.insertId, message: "Customer created" });
  } catch (err) {
    return next(err);
  }
}

async function editCustomer(req, res, next) {
  try {
    const { name, phone_no, address, amount_paid, balance } = req.body;
    const result = await updateCustomer(
      req.params.id,
      name,
      phone_no || null,
      address || null,
      amount_paid,
      balance
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

module.exports = {
  listCustomers,
  getCustomer,
  addCustomer,
  editCustomer,
  removeCustomer,
};
