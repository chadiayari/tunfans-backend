const jwt = require("jsonwebtoken");
const User = require("../models/user_model");
const createError = require("http-errors");
const { validationResult } = require("express-validator");

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

const registerUser = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, errors.array()[0].msg));
    }

    const { firstName, lastName, dateOfBirth, username, email, password } =
      req.body;

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
      lastName,
      firstName,
      dateOfBirth,
      email,
      password,
      role: "user",
      isActive: true,
    });

    await user.save();

    const token = generateToken(user._id, user.role);

    res.status(201).json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      dateOfBirth: user.dateOfBirth,
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
      firstName: user.firstName,
      lastName: user.lastName,
      dateOfBirth: user.dateOfBirth,
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

// Update subscription price
const updateSubscriptionPrice = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, errors.array()[0].msg));
    }

    const { price } = req.body;
    const userId = req.user._id;

    const user = await User.findById(userId).select("-password");
    if (!user) {
      return next(createError(404, "User not found"));
    }

    user.subscriptionPrice = price;
    await user.save();

    res.json({
      success: true,
      message: "Subscription price updated successfully",
      subscriptionPrice: user.subscriptionPrice,
    });
  } catch (error) {
    console.error("Update subscription price error:", error);
    next(error);
  }
};

// Add payout method
const addPayoutMethod = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, errors.array()[0].msg));
    }

    const { type, accountDetails } = req.body;
    const userId = req.user._id;

    let validationError = null;

    switch (type) {
      case "paypal":
        if (!accountDetails.paypalEmail) {
          validationError = "PayPal email is required";
        }
        break;
      case "bank_account":
        if (
          !accountDetails.accountNumber ||
          !accountDetails.routingNumber ||
          !accountDetails.accountHolderName ||
          !accountDetails.bankName
        ) {
          validationError = "All bank account details are required";
        }
        break;
      case "stripe_connect":
        if (!accountDetails.stripeAccountId) {
          validationError = "Stripe account ID is required";
        }
        break;
    }

    if (validationError) {
      return next(createError(400, validationError));
    }

    const user = await User.findById(userId);
    if (!user) {
      return next(createError(404, "User not found"));
    }

    // If this is the first payout method, make it default
    const isFirstMethod = user.payoutMethods.length === 0;

    const newPayoutMethod = {
      type,
      accountDetails,
      isDefault: isFirstMethod,
      isVerified: false, // Will be verified through external service
    };

    user.payoutMethods.push(newPayoutMethod);
    await user.save();

    // Get the newly added method
    const addedMethod = user.payoutMethods[user.payoutMethods.length - 1];

    res.status(201).json({
      success: true,
      message: "Payout method added successfully",
      payoutMethod: {
        _id: addedMethod._id,
        type: addedMethod.type,
        isDefault: addedMethod.isDefault,
        isVerified: addedMethod.isVerified,
        createdAt: addedMethod.createdAt,
        // Only return safe account details (masked sensitive info)
        accountDetails: maskAccountDetails(
          addedMethod.type,
          addedMethod.accountDetails
        ),
      },
    });
  } catch (error) {
    console.error("Add payout method error:", error);
    next(error);
  }
};

// Get all payout methods
const getPayoutMethods = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).select("payoutMethods");
    if (!user) {
      return next(createError(404, "User not found"));
    }

    // Format payout methods with masked sensitive data
    const formattedMethods = user.payoutMethods.map((method) => ({
      _id: method._id,
      type: method.type,
      isDefault: method.isDefault,
      isVerified: method.isVerified,
      createdAt: method.createdAt,
      accountDetails: maskAccountDetails(method.type, method.accountDetails),
    }));

    res.json({
      success: true,
      payoutMethods: formattedMethods,
    });
  } catch (error) {
    console.error("Get payout methods error:", error);
    next(error);
  }
};

// Set default payout method
const setDefaultPayoutMethod = async (req, res, next) => {
  try {
    const { id: methodId } = req.params;
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return next(createError(404, "User not found"));
    }

    // Find the payout method
    const methodIndex = user.payoutMethods.findIndex(
      (method) => method._id.toString() === methodId
    );

    if (methodIndex === -1) {
      return next(createError(404, "Payout method not found"));
    }

    // Set all methods to non-default
    user.payoutMethods.forEach((method) => {
      method.isDefault = false;
    });

    // Set the selected method as default
    user.payoutMethods[methodIndex].isDefault = true;

    await user.save();

    res.json({
      success: true,
      message: "Default payout method updated successfully",
      defaultMethodId: methodId,
    });
  } catch (error) {
    console.error("Set default payout method error:", error);
    next(error);
  }
};

// Helper function to mask sensitive account details
const maskAccountDetails = (type, accountDetails) => {
  const masked = { ...accountDetails };

  switch (type) {
    case "paypal":
      if (masked.paypalEmail) {
        const [localPart, domain] = masked.paypalEmail.split("@");
        masked.paypalEmail = `${localPart.substring(0, 2)}***@${domain}`;
      }
      break;
    case "bank_account":
      if (masked.accountNumber) {
        masked.accountNumber = `***${masked.accountNumber.slice(-4)}`;
      }
      if (masked.routingNumber) {
        masked.routingNumber = `***${masked.routingNumber.slice(-4)}`;
      }
      break;
    case "stripe_connect":
      if (masked.stripeAccountId) {
        masked.stripeAccountId = `acct_***${masked.stripeAccountId.slice(-4)}`;
      }
      break;
  }

  return masked;
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  updateSubscriptionPrice,
  addPayoutMethod,
  getPayoutMethods,
  setDefaultPayoutMethod,
};
