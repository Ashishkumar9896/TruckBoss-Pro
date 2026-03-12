const express = require("express");
const {
  listCustomers,
  getCustomer,
  addCustomer,
  editCustomer,
  removeCustomer,
} = require("../controllers/customerController");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

router.get("/customers", asyncHandler(listCustomers));
router.get("/customers/:id", asyncHandler(getCustomer));
router.post("/customers", asyncHandler(addCustomer));
router.put("/customers/:id", asyncHandler(editCustomer));
router.delete("/customers/:id", asyncHandler(removeCustomer));

module.exports = router;
