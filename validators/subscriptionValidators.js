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

module.exports = {
  subscribeToCreatorValidation,
  creatorIdParamValidation,
  subscriptionIdParamValidation,
};
