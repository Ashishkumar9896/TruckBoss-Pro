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
    const pool = require("../config/db");
    const [result] = await pool.query("UPDATE trips SET amount_received = amount_received + ? WHERE trip_id = ?", [Number(amount_received_add) || 0, id]);
    if (result.affectedRows === 0) return res.status(404).json({error: "Trip not found"});
    return res.json({message: "Payment recorded successfully"});
  } catch (err) {
    next(err);
  }
}));
router.delete("/trips/:id", asyncHandler(removeTrip));

module.exports = router;
