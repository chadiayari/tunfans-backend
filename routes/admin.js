const express = require("express");
const router = express.Router();
const { authenticate, adminOnly } = require("../middleware/authMiddleware");
const {
  // User management
  getUsers,
  getUserDetails,
  updateUserStatus,

  // Order management
  getOrders,
  getOrderDetails,
  updateOrderStatus,

  // Payment management
  getPaymentAnalytics,
  getFailedPayments,

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

// ==================== ORDER MANAGEMENT ====================
/**
 * @route   GET /api/admin/orders
 * @desc    Get all orders with pagination and filters
 * @query   page, limit, status, paymentStatus, dateFrom, dateTo, search, sortBy, sortOrder
 * @access  Admin only
 */
router.get("/orders", getOrders);

/**
 * @route   GET /api/admin/orders/:orderId
 * @desc    Get detailed information about a specific order
 * @access  Admin only
 */
router.get("/orders/:orderId", getOrderDetails);

/**
 * @route   PUT /api/admin/orders/:orderId/status
 * @desc    Update order status
 * @body    { status: string, notes?: string }
 * @access  Admin only
 */
router.put("/orders/:orderId/status", updateOrderStatus);

// ==================== PAYMENT MANAGEMENT ====================
/**
 * @route   GET /api/admin/payments/analytics
 * @desc    Get payment analytics and revenue data
 * @query   period (7d|30d|90d|1y), currency
 * @access  Admin only
 */
router.get("/payments/analytics", getPaymentAnalytics);

/**
 * @route   GET /api/admin/payments/failed
 * @desc    Get failed payments for review
 * @query   page, limit
 * @access  Admin only
 */
router.get("/payments/failed", getFailedPayments);

module.exports = router;
