const express = require("express");
const router = express.Router();
const { loginAdmin, verifyToken } = require("../controllers/authController");
const { authenticate, adminOnly } = require("./authMiddleware");

// Admin login
router.post("/admin/login", loginAdmin);

// Token verification (for both users and admins)
router.get("/verify", authenticate, verifyToken);

// Admin-only routes
router.get("/admin/verify", authenticate, adminOnly, verifyToken);

module.exports = router;
