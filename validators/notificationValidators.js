const { body } = require("express-validator");

const createNotificationValidation = [
  body("recipient")
    .notEmpty()
    .withMessage("Recipient ID is required")
    .isMongoId()
    .withMessage("Invalid recipient ID"),

  body("type")
    .notEmpty()
    .withMessage("Notification type is required")
    .isIn([
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
    ])
    .withMessage("Invalid notification type"),

  body("title")
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ max: 100 })
    .withMessage("Title cannot exceed 100 characters"),

  body("message")
    .notEmpty()
    .withMessage("Message is required")
    .isLength({ max: 500 })
    .withMessage("Message cannot exceed 500 characters"),

  body("priority")
    .optional()
    .isIn(["low", "normal", "high", "urgent"])
    .withMessage("Invalid priority level"),

  body("actionUrl")
    .optional()
    .isURL()
    .withMessage("Action URL must be a valid URL"),
];

const markMultipleAsReadValidation = [
  body("notificationIds")
    .isArray({ min: 1 })
    .withMessage("notificationIds must be a non-empty array")
    .custom((value) => {
      if (!value.every((id) => typeof id === "string" && id.length === 24)) {
        throw new Error("All notification IDs must be valid MongoDB ObjectIds");
      }
      return true;
    }),
];

const deleteMultipleNotificationsValidation = [
  body("notificationIds")
    .isArray({ min: 1 })
    .withMessage("notificationIds must be a non-empty array")
    .custom((value) => {
      if (!value.every((id) => typeof id === "string" && id.length === 24)) {
        throw new Error("All notification IDs must be valid MongoDB ObjectIds");
      }
      return true;
    }),
];

module.exports = {
  createNotificationValidation,
  markMultipleAsReadValidation,
  deleteMultipleNotificationsValidation,
};
