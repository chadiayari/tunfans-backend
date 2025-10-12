const express = require("express");
const router = express.Router();
const {
  loginAdmin,
  verifyToken,
  checkAuth,
} = require("../controllers/authController");
const { authenticate, adminOnly } = require("./authMiddleware");

// Admin login
router.post("/admin/login", loginAdmin);

// Authentication check (returns user info)
router.get("/check", authenticate, checkAuth);

// Token verification (for both users and admins)
router.get("/verify", authenticate, verifyToken);

// Admin-only routes
router.get("/admin/verify", authenticate, adminOnly, verifyToken);

module.exports = router;
