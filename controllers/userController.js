const jwt = require("jsonwebtoken");
const User = require("../models/user_model");
const createError = require("http-errors");
const { validationResult } = require("express-validator");

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

// Register new user
const registerUser = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, errors.array()[0].msg));
    }

    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      return next(
        createError(400, "User already exists with this email or username")
      );
    }

    // Create new user
    const user = new User({
      username,
      email,
      password,
    });

    await user.save();

    const token = generateToken(user._id, user.role);

    res.status(201).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      token: token,
      success: true,
    });
  } catch (error) {
    console.error("Registration error:", error);
    next(error);
  }
};

// Login user
const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user || !user.isActive) {
      return next(createError(401, "Invalid credentials"));
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return next(createError(401, "Invalid credentials"));
    }

    const token = generateToken(user._id, user.role);

    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      token: token,
      success: true,
    });
  } catch (error) {
    console.error("Login error:", error);
    next(error);
  }
};

// Get user profile with children and orders
const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("-password");

    if (!user) {
      return next(createError(404, "User not found"));
    }

    res.json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    next(error);
  }
};

const updateUserProfile = async (req, res, next) => {
  try {
    const { username, email } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return next(createError(404, "User not found"));
    }

    // Check if username or email is already taken by another user
    if (username && username !== user.username) {
      const existingUser = await User.findOne({
        username,
        _id: { $ne: user._id },
      });
      if (existingUser) {
        return next(createError(400, "Username already taken"));
      }
      user.username = username;
    }

    if (email && email !== user.email) {
      const existingUser = await User.findOne({
        email,
        _id: { $ne: user._id },
      });
      if (existingUser) {
        return next(createError(400, "Email already taken"));
      }
      user.email = email;
    }

    await user.save();

    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      success: true,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    next(error);
  }
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
};
