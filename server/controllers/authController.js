const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const {
  findUserByEmail,
  findUserIdByEmail,
  createUser,
  updateUserPassword,
} = require("../models/userModel");

async function register(req, res, next) {
  try {
    const { email, password, full_name, role: reqRole } = req.body;
    const role = reqRole === "manager" ? "manager" : "admin";
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const existing = await findUserIdByEmail(email);
    if (existing.length > 0) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await createUser(email, passwordHash, full_name || null, role);

    const token = jwt.sign(
      { user_id: result.insertId, email, role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    return res.status(201).json({
      token,
      user: {
        user_id: result.insertId,
        email,
        full_name: full_name || null,
        role,
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const users = await findUserByEmail(email);
    if (users.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = users[0];
    const storedPassword = user.password || "";
    const isHash = /^\$2[aby]\$/.test(storedPassword);
    const isValidPassword = isHash
      ? await bcrypt.compare(password, storedPassword)
      : password === storedPassword;

    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (!isHash) {
      const passwordHash = await bcrypt.hash(password, 12);
      await updateUserPassword(user.user_id, passwordHash);
    }

    const token = jwt.sign(
      { user_id: user.user_id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    return res.json({
      token,
      user: {
        user_id: user.user_id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        driver_id: user.driver_id || null,
      },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  register,
  login,
};
