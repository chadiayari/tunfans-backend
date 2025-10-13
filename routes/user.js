const express = require("express");
const router = express.Router();
const {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  updateSubscriptionPrice,
  addPayoutMethod,
  getPayoutMethods,
  setDefaultPayoutMethod,
} = require("../controllers/userController");
const { authenticate, userOrAdmin } = require("../middleware/authMiddleware");
const {
  userRegistrationValidation,
  userLoginValidation,
  userUpdateValidation,
  subscriptionPriceValidation,
  payoutMethodValidation,
} = require("../validators/userValidators");

// Public routes
router.post("/register", userRegistrationValidation, registerUser);
router.post("/login", userLoginValidation, loginUser);

// Protected routes (requires authentication)
router.get("/profile", authenticate, userOrAdmin, getUserProfile);
router.put(
  "/profile",
  authenticate,
  userOrAdmin,
  userUpdateValidation,
  updateUserProfile
);

// Subscription-related routes
router.put(
  "/subscription-price",
  authenticate,
  userOrAdmin,
  subscriptionPriceValidation,
  updateSubscriptionPrice
);
router.post(
  "/payout-methods",
  authenticate,
  userOrAdmin,
  payoutMethodValidation,
  addPayoutMethod
);
router.get("/payout-methods", authenticate, userOrAdmin, getPayoutMethods);
router.put(
  "/payout-methods/:id",
  authenticate,
  userOrAdmin,
  setDefaultPayoutMethod
);

module.exports = router;
