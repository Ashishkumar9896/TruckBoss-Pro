const express = require("express");
const {
  listTrips,
  addTrip,
  editTrip,
  removeTrip,
} = require("../controllers/tripController");
const asyncHandler = require("../middleware/asyncHandler");
const {
  validateTrip,
  handleValidationErrors,
} = require("../middleware/validation");
const { recordTripPayment } = require("../models/expenseModel");

const router = express.Router();

router.get("/trips", asyncHandler(listTrips));
router.post(
  "/trips",
  validateTrip,
  handleValidationErrors,
  asyncHandler(addTrip)
);
router.put("/trips/:id", asyncHandler(editTrip));
router.put("/trips/:id/payment", asyncHandler(async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount_received_add } = req.body;
    const result = await recordTripPayment(id, amount_received_add, {
      markFullyPaid: false,
    });
    if (!result.ok) {
      if (result.code === "not_found") return res.status(404).json({ error: result.message });
      return res.status(400).json({ error: result.message || "Payment could not be recorded." });
    }
    return res.json({ message: result.message, appliedAmount: result.appliedAmount });
  } catch (err) {
    next(err);
  }
}));
router.delete("/trips/:id", asyncHandler(removeTrip));

module.exports = router;
