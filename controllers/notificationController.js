const Notification = require("../models/notification_model");
const User = require("../models/user_model");
const mongoose = require("mongoose");
const createError = require("http-errors");
const { validationResult } = require("express-validator");

// Get all notifications for the authenticated user
const getNotifications = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20, type, isRead, priority } = req.query;

    // Build filter object
    const filter = { recipient: userId };

    if (type) {
      filter.type = type;
    }

    if (isRead !== undefined) {
      filter.isRead = isRead === "true";
    }

    if (priority) {
      filter.priority = priority;
    }

    const skip = (page - 1) * limit;

    const notifications = await Notification.find(filter)
      .populate({
        path: "sender",
        select: "username firstName lastName profileImage email",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Notification.countDocuments(filter);
    const unreadCount = await Notification.getUnreadCount(userId);

    res.json({
      success: true,
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
      unreadCount,
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    next(error);
  }
};

// Get unread notifications count
const getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const unreadCount = await Notification.getUnreadCount(userId);

    res.json({
      success: true,
      unreadCount,
    });
  } catch (error) {
    console.error("Get unread count error:", error);
    next(error);
  }
};

// Mark notification as read
const markAsRead = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user._id;

    const notification = await Notification.findOne({
      _id: notificationId,
      recipient: userId,
    });

    if (!notification) {
      return next(createError(404, "Notification not found"));
    }

    await notification.markAsRead();

    res.json({
      success: true,
      message: "Notification marked as read",
      notification,
    });
  } catch (error) {
    console.error("Mark notification as read error:", error);
    next(error);
  }
};

// Mark multiple notifications as read
const markMultipleAsRead = async (req, res, next) => {
  try {
    const { notificationIds } = req.body;
    const userId = req.user._id;

    if (!notificationIds || !Array.isArray(notificationIds)) {
      return next(createError(400, "notificationIds must be an array"));
    }

    const result = await Notification.markMultipleAsRead(
      notificationIds,
      userId
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} notifications marked as read`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Mark multiple notifications as read error:", error);
    next(error);
  }
};

// Mark all notifications as read
const markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const result = await Notification.updateMany(
      {
        recipient: userId,
        isRead: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} notifications marked as read`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Mark all notifications as read error:", error);
    next(error);
  }
};

// Delete a notification
const deleteNotification = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user._id;

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      recipient: userId,
    });

    if (!notification) {
      return next(createError(404, "Notification not found"));
    }

    res.json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    console.error("Delete notification error:", error);
    next(error);
  }
};

// Delete multiple notifications
const deleteMultipleNotifications = async (req, res, next) => {
  try {
    const { notificationIds } = req.body;
    const userId = req.user._id;

    if (!notificationIds || !Array.isArray(notificationIds)) {
      return next(createError(400, "notificationIds must be an array"));
    }

    const result = await Notification.deleteMany({
      _id: { $in: notificationIds },
      recipient: userId,
    });

    res.json({
      success: true,
      message: `${result.deletedCount} notifications deleted`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Delete multiple notifications error:", error);
    next(error);
  }
};

// Create a notification (admin only or system use)
const createNotification = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, errors.array()[0].msg));
    }

    const {
      recipient,
      type,
      title,
      message,
      data = {},
      actionUrl,
      priority = "normal",
    } = req.body;

    const senderId = req.user._id;
    const senderModel = req.userRole === "admin" ? "Admin" : "User";

    // Validate recipient exists
    const recipientUser = await User.findById(recipient);
    if (!recipientUser) {
      return next(createError(404, "Recipient not found"));
    }

    const notification = await Notification.createNotification({
      recipient,
      sender: senderId,
      senderModel,
      type,
      title,
      message,
      data,
      actionUrl,
      priority,
    });

    await notification.populate({
      path: "sender",
      select: "username firstName lastName profileImage email",
    });

    res.status(201).json({
      success: true,
      message: "Notification created successfully",
      notification,
    });
  } catch (error) {
    console.error("Create notification error:", error);
    next(error);
  }
};

// Get notification statistics
const getNotificationStats = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const stats = await Notification.aggregate([
      {
        $match: { recipient: new mongoose.Types.ObjectId(userId) },
      },
      {
        $group: {
          _id: "$type",
          total: { $sum: 1 },
          unread: {
            $sum: {
              $cond: [{ $eq: ["$isRead", false] }, 1, 0],
            },
          },
        },
      },
      {
        $sort: { total: -1 },
      },
    ]);

    const totalNotifications = await Notification.countDocuments({
      recipient: userId,
    });

    const totalUnread = await Notification.getUnreadCount(userId);

    res.json({
      success: true,
      stats: {
        total: totalNotifications,
        unread: totalUnread,
        byType: stats,
      },
    });
  } catch (error) {
    console.error("Get notification stats error:", error);
    next(error);
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markMultipleAsRead,
  markAllAsRead,
  deleteNotification,
  deleteMultipleNotifications,
  createNotification,
  getNotificationStats,
};
