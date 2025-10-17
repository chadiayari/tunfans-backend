const express = require("express");
const router = express.Router();
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markMultipleAsRead,
  markAllAsRead,
  deleteNotification,
  deleteMultipleNotifications,
  createNotification,
  getNotificationStats,
} = require("../controllers/notificationController");
const {
  authenticate,
  userOrAdmin,
  adminOnly,
} = require("../middleware/authMiddleware");
const {
  createNotificationValidation,
  markMultipleAsReadValidation,
  deleteMultipleNotificationsValidation,
} = require("../validators/notificationValidators");

// All notification routes require authentication
router.use(authenticate);

// Get all notifications for the authenticated user
router.get("/", userOrAdmin, getNotifications);

// Get unread notifications count
router.get("/unread-count", userOrAdmin, getUnreadCount);

// Get notification statistics
router.get("/stats", userOrAdmin, getNotificationStats);

// Mark notification as read
router.put("/:notificationId/read", userOrAdmin, markAsRead);

// Mark multiple notifications as read
router.put(
  "/read-multiple",
  userOrAdmin,
  markMultipleAsReadValidation,
  markMultipleAsRead
);

// Mark all notifications as read
router.put("/read-all", userOrAdmin, markAllAsRead);

// Delete a notification
router.delete("/:notificationId", userOrAdmin, deleteNotification);

// Delete multiple notifications
router.delete(
  "/delete-multiple",
  userOrAdmin,
  deleteMultipleNotificationsValidation,
  deleteMultipleNotifications
);

// Create a notification (admin only)
router.post("/", adminOnly, createNotificationValidation, createNotification);

module.exports = router;
