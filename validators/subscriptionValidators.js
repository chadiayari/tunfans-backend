const { body, param, query } = require("express-validator");

const subscribeToCreatorValidation = [
  body("creatorId").isMongoId().withMessage("Valid creator ID is required"),

  body("paymentMethod")
    .optional()
    .isIn(["stripe", "paypal", "bank_transfer"])
    .withMessage("Invalid payment method"),
];

const creatorIdParamValidation = [
  param("creatorId").isMongoId().withMessage("Valid creator ID is required"),
];

const subscriptionIdParamValidation = [
  param("subscriptionId")
    .isMongoId()
    .withMessage("Valid subscription ID is required"),
];

const subscriptionQueryValidation = [
  query("status")
    .optional()
    .isIn(["all", "active", "cancelled", "expired", "pending"])
    .withMessage("Invalid status filter"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
];

module.exports = {
  subscribeToCreatorValidation,
  creatorIdParamValidation,
  subscriptionIdParamValidation,
  subscriptionQueryValidation,
};
