const express = require("express");
const {
  listCustomers,
  getCustomer,
  addCustomer,
  editCustomer,
  removeCustomer,
} = require("../controllers/customerController");
const asyncHandler = require("../middleware/asyncHandler");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

router.get("/customers", authorizeRoles("admin", "manager"), asyncHandler(listCustomers));
router.get("/customers/:id", authorizeRoles("admin", "manager"), asyncHandler(getCustomer));
router.post("/customers", authorizeRoles("admin", "manager"), asyncHandler(addCustomer));
router.put("/customers/:id", authorizeRoles("admin", "manager"), asyncHandler(editCustomer));
router.delete("/customers/:id", authorizeRoles("admin", "manager"), asyncHandler(removeCustomer));

module.exports = router;
