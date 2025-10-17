const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "senderModel",
      required: true,
    },
    senderModel: {
      type: String,
      required: true,
      enum: ["User", "Admin"],
      default: "User",
    },
    type: {
      type: String,
      required: true,
      enum: [
        "message",
        "subscription",
        "subscription_expired",
        "post_like",
        "content_like",
        "new_content",
        "new_post",
        "payment_received",
        "payout_completed",
        "system",
      ],
    },
    title: {
      type: String,
      required: true,
      maxlength: 100,
    },
    message: {
      type: String,
      required: true,
      maxlength: 500,
    },
    data: {
      // Additional data specific to notification type
      postId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Post",
      },
      contentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Content",
      },
      subscriptionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Subscription",
      },
      conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Conversation",
      },
      amount: {
        type: Number,
      },
      // Generic data object for custom data
      custom: {
        type: mongoose.Schema.Types.Mixed,
      },
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
    },
    actionUrl: {
      type: String, // Deep link or URL for the notification action
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
    },
    expiresAt: {
      type: Date,
      // Auto-expire notifications after 30 days
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ recipient: 1, type: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Static method to create different types of notifications
notificationSchema.statics.createNotification = async function (
  notificationData
) {
  const {
    recipient,
    sender,
    senderModel = "User",
    type,
    title,
    message,
    data = {},
    actionUrl,
    priority = "normal",
  } = notificationData;

  const notification = new this({
    recipient,
    sender,
    senderModel,
    type,
    title,
    message,
    data,
    actionUrl,
    priority,
  });

  return await notification.save();
};

// Instance method to mark as read
notificationSchema.methods.markAsRead = async function () {
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
    return await this.save();
  }
  return this;
};

// Static method to mark multiple notifications as read
notificationSchema.statics.markMultipleAsRead = async function (
  notificationIds,
  userId
) {
  return await this.updateMany(
    {
      _id: { $in: notificationIds },
      recipient: userId,
      isRead: false,
    },
    {
      isRead: true,
      readAt: new Date(),
    }
  );
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = async function (userId) {
  return await this.countDocuments({
    recipient: userId,
    isRead: false,
  });
};

module.exports = mongoose.model("Notification", notificationSchema);
