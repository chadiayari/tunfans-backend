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
  uploadProfileImage: userUploadProfileImage,
  uploadCoverImage,
  searchUsers,
  getUserByUsername,
  getCurrentUser,
  getFeaturedCreators,
  getTrendingCreators,
} = require("../controllers/userController");
const {
  uploadProfileImage,
  createContent,
  getMyContent,
  getUserContent,
  getContentByCreator,
  updateExclusiveContent,
  deleteExclusiveContent,
  toggleContentLike,
} = require("../controllers/contentController");
const {
  subscribeToCreator,
  unsubscribeFromCreator,
  getMySubscriptions,
  getMySubscribers,
  checkSubscriptionStatus,
  toggleAutoRenewal,
} = require("../controllers/subscriptionController");
const { authenticate, userOrAdmin } = require("../middleware/authMiddleware");
const {
  userRegistrationValidation,
  userLoginValidation,
  userUpdateValidation,
  subscriptionPriceValidation,
  payoutMethodValidation,
  searchUsersValidation,
  featuredCreatorsValidation,
  trendingCreatorsValidation,
} = require("../validators/userValidators");
const {
  createContentValidation,
  updateContentValidation,
  contentIdValidation,
  creatorIdValidation,
} = require("../validators/contentValidators");
const {
  subscribeToCreatorValidation,
  creatorIdParamValidation,
  subscriptionIdParamValidation,
  subscriptionQueryValidation,
} = require("../validators/subscriptionValidators");
const {
  uploadProfileImage: uploadProfileImageMiddleware,
  uploadCoverImage: uploadCoverImageMiddleware,
  uploadExclusiveContent,
  uploadMultipleExclusiveContent,
  processProfileImageUpload,
  processCoverImageUpload,
  processExclusiveContentUpload,
  processMultipleExclusiveContentUpload,
  getPrivateContentUrl,
  handleUploadError,
} = require("../utils/contentUpload");
const {
  checkSubscriptionAccess,
  checkSubscriptionHistory,
} = require("../middleware/subscriptionMiddleware");

// Public routes
router.post("/register", userRegistrationValidation, registerUser);
router.post("/login", userLoginValidation, loginUser);

// Protected routes (requires authentication)
router.get("/me", authenticate, getCurrentUser);
router.get("/profile/:username", authenticate, userOrAdmin, getUserProfile);
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

// Content upload routes
router.post(
  "/profile-image",
  authenticate,
  userOrAdmin,
  uploadProfileImageMiddleware,
  processProfileImageUpload,
  uploadProfileImage,
  handleUploadError
);

router.post(
  "/content",
  authenticate,
  userOrAdmin,
  uploadExclusiveContent,
  processExclusiveContentUpload,
  createContentValidation,
  createContent,
  handleUploadError
);

router.post(
  "/content/multiple",
  authenticate,
  userOrAdmin,
  uploadMultipleExclusiveContent,
  processMultipleExclusiveContentUpload,
  handleUploadError
);

// Content management routes
router.get("/content", authenticate, userOrAdmin, getMyContent);
router.get("/:username/content", authenticate, userOrAdmin, getUserContent);
router.put(
  "/content/:contentId",
  authenticate,
  userOrAdmin,
  updateContentValidation,
  updateExclusiveContent
);
router.delete(
  "/content/:contentId",
  authenticate,
  userOrAdmin,
  contentIdValidation,
  deleteExclusiveContent
);
router.post(
  "/content/:contentId/like",
  authenticate,
  userOrAdmin,
  contentIdValidation,
  toggleContentLike
);

// Public content routes (for viewing other creators) - requires subscription
router.get(
  "/creators/:creatorId/content",
  authenticate,
  userOrAdmin,
  checkSubscriptionAccess,
  creatorIdValidation,
  getContentByCreator
);

// Private content access URL generation
router.get(
  "/content/access/:key",
  authenticate,
  userOrAdmin,
  getPrivateContentUrl
);

// Profile and Cover Image Upload routes
router.post(
  "/profile-image",
  authenticate,
  userOrAdmin,
  uploadProfileImageMiddleware,
  handleUploadError,
  processProfileImageUpload,
  userUploadProfileImage
);

router.post(
  "/cover-image",
  authenticate,
  userOrAdmin,
  uploadCoverImageMiddleware,
  handleUploadError,
  processCoverImageUpload,
  uploadCoverImage
);

// Search users endpoint
router.get("/search", authenticate, searchUsersValidation, searchUsers);

// Subscription endpoints
router.post(
  "/subscribe",
  authenticate,
  userOrAdmin,
  subscribeToCreatorValidation,
  subscribeToCreator
);

router.delete(
  "/unsubscribe/:creatorId",
  authenticate,
  userOrAdmin,
  creatorIdParamValidation,
  unsubscribeFromCreator
);

router.get(
  "/subscriptions",
  authenticate,
  userOrAdmin,
  subscriptionQueryValidation,
  getMySubscriptions
);

router.get(
  "/subscribers",
  authenticate,
  userOrAdmin,
  subscriptionQueryValidation,
  getMySubscribers
);

router.get(
  "/subscription-status/:creatorId",
  authenticate,
  userOrAdmin,
  creatorIdParamValidation,
  checkSubscriptionStatus
);

router.put(
  "/subscriptions/:subscriptionId/auto-renewal",
  authenticate,
  userOrAdmin,
  subscriptionIdParamValidation,
  toggleAutoRenewal
);

// Public routes for discovery
router.get(
  "/discover/featured",
  featuredCreatorsValidation,
  getFeaturedCreators
);
router.get(
  "/discover/trending",
  trendingCreatorsValidation,
  getTrendingCreators
);

// Public profile route - Get user by username
// Note: This should be at the end to avoid conflicts with other routes
router.get("/:username", getUserByUsername);

module.exports = router;
