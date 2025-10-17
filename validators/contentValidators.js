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
