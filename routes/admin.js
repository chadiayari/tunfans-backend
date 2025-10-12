const express = require("express");
const router = express.Router();
const { authenticate, adminOnly } = require("../middleware/authMiddleware");
const {
  // User management
  getUsers,
  getUserDetails,
  updateUserStatus,

  // Dashboard
  getDashboardOverview,
} = require("../controllers/adminController");

// All admin routes require authentication and admin privileges
router.use(authenticate, adminOnly);

// ==================== DASHBOARD ====================
/**
 * @route   GET /api/admin/dashboard
 * @desc    Get admin dashboard overview with key metrics
 * @access  Admin only
 */
router.get("/dashboard", getDashboardOverview);

// ==================== USER MANAGEMENT ====================
/**
 * @route   GET /api/admin/users
 * @desc    Get all users with pagination and filters
 * @query   page, limit, search, sortBy, sortOrder
 * @access  Admin only
 */
router.get("/users", getUsers);

/**
 * @route   GET /api/admin/users/:userId
 * @desc    Get detailed information about a specific user
 * @access  Admin only
 */
router.get("/users/:userId", getUserDetails);

/**
 * @route   PUT /api/admin/users/:userId/status
 * @desc    Update user status (activate/deactivate)
 * @body    { isActive: boolean, reason?: string }
 * @access  Admin only
 */
router.put("/users/:userId/status", updateUserStatus);

module.exports = router;
