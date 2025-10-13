const { body, param } = require("express-validator");

const createContentValidation = [
  body("title")
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("Title must be between 1 and 200 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description must not exceed 1000 characters"),

  body("price")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Price must be a positive number"),

  body("tags")
    .optional()
    .custom((value) => {
      if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          if (!Array.isArray(parsed)) {
            throw new Error("Tags must be an array");
          }
        } catch (e) {
          // If not JSON, check if it's comma-separated
          if (!value.includes(",") && value.length > 50) {
            throw new Error("Tags string is too long");
          }
        }
      } else if (!Array.isArray(value)) {
        throw new Error("Tags must be an array or comma-separated string");
      }
      return true;
    }),

  body("isSubscriberOnly")
    .optional()
    .isBoolean()
    .withMessage("isSubscriberOnly must be a boolean value"),
];

const updateContentValidation = [
  param("contentId").isMongoId().withMessage("Invalid content ID"),

  body("title")
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("Title must be between 1 and 200 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description must not exceed 1000 characters"),

  body("price")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Price must be a positive number"),

  body("tags")
    .optional()
    .custom((value) => {
      if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          if (!Array.isArray(parsed)) {
            throw new Error("Tags must be an array");
          }
        } catch (e) {
          // If not JSON, check if it's comma-separated
          if (!value.includes(",") && value.length > 50) {
            throw new Error("Tags string is too long");
          }
        }
      } else if (!Array.isArray(value)) {
        throw new Error("Tags must be an array or comma-separated string");
      }
      return true;
    }),

  body("isSubscriberOnly")
    .optional()
    .isBoolean()
    .withMessage("isSubscriberOnly must be a boolean value"),

  body("status")
    .optional()
    .isIn(["draft", "published", "archived"])
    .withMessage("Status must be draft, published, or archived"),
];

const contentIdValidation = [
  param("contentId").isMongoId().withMessage("Invalid content ID"),
];

const creatorIdValidation = [
  param("creatorId").isMongoId().withMessage("Invalid creator ID"),
];

module.exports = {
  createContentValidation,
  updateContentValidation,
  contentIdValidation,
  creatorIdValidation,
};
