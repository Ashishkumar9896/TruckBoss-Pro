const { body, validationResult } = require("express-validator");

const validateRegister = [
  body("email").isEmail().withMessage("Valid email is required"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
  body("full_name").optional({ nullable: true }).trim().notEmpty().withMessage("Name is required"),
  body("role")
    .optional({ nullable: true })
    .isIn(["admin", "manager", "driver"])
    .withMessage("Role must be one of: admin, manager, driver"),
];

const validateLogin = [
  body("email").isEmail().withMessage("Valid email is required"),
  body("password").notEmpty().withMessage("Password is required"),
];

const validateDriver = [
  body("name").notEmpty().withMessage("Name is required"),
  body("licence_no").notEmpty().withMessage("Licence number is required"),
  body("phone_no")
    .optional({ nullable: true, checkFalsy: true })
    .isMobilePhone("any")
    .withMessage("Invalid phone number"),
  body("salary")
    .optional({ nullable: true })
    .isNumeric()
    .withMessage("Salary must be numeric"),
];

const validateTruck = [
  body("truck_no").notEmpty().withMessage("Truck number is required"),
];

const validateTrip = [
  body("from_city").notEmpty().withMessage("from_city is required"),
  body("to_city").notEmpty().withMessage("to_city is required"),
  body("trip_date").isISO8601().withMessage("trip_date must be a valid date"),
  body("amount")
    .optional({ nullable: true })
    .isNumeric()
    .withMessage("amount must be numeric"),
];

const validateFuel = [
  body("liters").isNumeric().withMessage("liters must be numeric"),
  body("price").isNumeric().withMessage("price must be numeric"),
  body("fuel_date").isISO8601().withMessage("fuel_date must be a valid date"),
];

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  return next();
}

module.exports = {
  validateRegister,
  validateLogin,
  validateDriver,
  validateTruck,
  validateTrip,
  validateFuel,
  handleValidationErrors,
};