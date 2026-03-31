const express = require("express");
const { register, login } = require("../controllers/authController");
const asyncHandler = require("../middleware/asyncHandler");
const {
	validateRegister,
	validateLogin,
	handleValidationErrors,
} = require("../middleware/validation");

const router = express.Router();

router.post("/register", validateRegister, handleValidationErrors, asyncHandler(register));
router.post("/login", validateLogin, handleValidationErrors, asyncHandler(login));

module.exports = router;
