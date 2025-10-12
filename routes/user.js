const express = require("express");
const router = express.Router();
const {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
} = require("../controllers/userController");
const { authenticate, userOrAdmin } = require("../middleware/authMiddleware");
const {
  userRegistrationValidation,
  userLoginValidation,
  userUpdateValidation,
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

module.exports = router;
