const { body, query } = require("express-validator");

const userRegistrationValidation = [
  body("username")
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be between 3 and 30 characters")
    .matches(/^[a-zA-Z0-9\s]+$/)
    .withMessage("Username can only contain letters, numbers, and spaces"),

  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email address"),

  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
];

const userLoginValidation = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email address"),

  body("password").notEmpty().withMessage("Password is required"),
];

const userUpdateValidation = [
  body("username")
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be between 3 and 30 characters")
    .matches(/^[a-zA-Z0-9\s]+$/)
    .withMessage("Username can only contain letters, numbers, and spaces"),

  body("email")
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email address"),
];

const subscriptionPriceValidation = [
  body("price")
    .isFloat({ min: 0 })
    .withMessage("Price must be a positive number"),
];

const payoutMethodValidation = [
  body("type")
    .isIn(["paypal", "bank_account", "stripe_connect"])
    .withMessage("Invalid payout method type"),

  body("accountDetails")
    .isObject()
    .withMessage("Account details must be an object"),

  // PayPal validation
  body("accountDetails.paypalEmail")
    .if(body("type").equals("paypal"))
    .isEmail()
    .withMessage("Valid PayPal email is required"),

  // Bank account validation
  body("accountDetails.accountNumber")
    .if(body("type").equals("bank_account"))
    .notEmpty()
    .withMessage("Account number is required for bank account"),

  body("accountDetails.routingNumber")
    .if(body("type").equals("bank_account"))
    .notEmpty()
    .withMessage("Routing number is required for bank account"),

  body("accountDetails.accountHolderName")
    .if(body("type").equals("bank_account"))
    .notEmpty()
    .withMessage("Account holder name is required for bank account"),

  body("accountDetails.bankName")
    .if(body("type").equals("bank_account"))
    .notEmpty()
    .withMessage("Bank name is required for bank account"),

  // Stripe Connect validation
  body("accountDetails.stripeAccountId")
    .if(body("type").equals("stripe_connect"))
    .notEmpty()
    .withMessage("Stripe account ID is required"),
];

const searchUsersValidation = [
  query("q")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Search query must be between 2 and 100 characters"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50"),

  query("filter")
    .optional()
    .isIn(["creators", "verified", "online"])
    .withMessage("Filter must be one of: creators, verified, online"),
];

const featuredCreatorsValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50"),

  query("minSubscribers")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Minimum subscribers must be a non-negative integer"),
];

const trendingCreatorsValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50"),
];

module.exports = {
  userRegistrationValidation,
  userLoginValidation,
  userUpdateValidation,
  subscriptionPriceValidation,
  payoutMethodValidation,
  searchUsersValidation,
  featuredCreatorsValidation,
  trendingCreatorsValidation,
};
