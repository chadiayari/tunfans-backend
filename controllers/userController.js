const jwt = require("jsonwebtoken");
const User = require("../models/user_model");
const Subscription = require("../models/subscription_model");
const Post = require("../models/post_model");
const createError = require("http-errors");
const { validationResult } = require("express-validator");

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

// Helper function to get real-time subscriber count
const getSubscriberCount = async (userId) => {
  try {
    const count = await Subscription.countDocuments({
      creator: userId,
      status: "active",
      endDate: { $gt: new Date() }, // Not expired
    });
    return count;
  } catch (error) {
    console.error("Error getting subscriber count:", error);
    return 0;
  }
};

// Helper function to get real-time subscription count (how many creators the user is subscribed to)
const getSubscriptionCount = async (userId) => {
  try {
    const count = await Subscription.countDocuments({
      subscriber: userId,
      status: "active",
      endDate: { $gt: new Date() }, // Not expired
    });
    return count;
  } catch (error) {
    console.error("Error getting subscription count:", error);
    return 0;
  }
};

// Helper function to check if user is subscribed to a creator
const checkSubscriptionStatus = async (subscriberId, creatorId) => {
  try {
    if (!subscriberId || !creatorId) {
      return false;
    }

    const subscription = await Subscription.findOne({
      subscriber: subscriberId,
      creator: creatorId,
      status: "active",
      endDate: { $gt: new Date() }, // Not expired
    });

    return !!subscription;
  } catch (error) {
    console.error("Error checking subscription status:", error);
    return false;
  }
};

// Helper function to get real-time post count
const getPostCount = async (userId) => {
  try {
    const count = await Post.countDocuments({
      author: userId,
    });
    return count;
  } catch (error) {
    console.error("Error getting post count:", error);
    return 0;
  }
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
      profileImage: user.profileImage,
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

// Get user profile by username (for viewing other users' profiles)
const getUserProfile = async (req, res, next) => {
  try {
    const { username } = req.params;

    if (!username) {
      return next(createError(400, "Username is required"));
    }

    const user = await User.findOne({
      username: username,
      isActive: true,
    }).select("-password -payoutMethods -totalEarnings -availableBalance");

    if (!user) {
      return next(createError(404, "User not found"));
    }

    // Get real-time counts
    const subscriberCount = await getSubscriberCount(user._id);
    const subscriptionCount = await getSubscriptionCount(user._id);
    const postCount = await getPostCount(user._id);

    // Check if current user is subscribed to this profile (only if user is authenticated)
    let isSubscribed = false;
    console.log("req.user:", req.user);
    console.log("user:", user);
    if (req.user && req.user._id.toString() !== user._id.toString()) {
      isSubscribed = await checkSubscriptionStatus(req.user._id, user._id);
    }

    res.json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImage: user.profileImage,
        coverImage: user.coverImage,
        bio: user.bio,
        subscriptionPrice: user.subscriptionPrice,
        subscriberCount,
        subscriptionCount,
        postCount,
        isSubscribed,
        role: user.role,
        createdAt: user.createdAt,
        // Only show email if it's the current user or an admin
        ...(req.user &&
        (req.user._id.toString() === user._id.toString() ||
          req.user.role === "admin")
          ? { email: user.email }
          : {}),
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

// Upload profile image
const uploadProfileImage = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const uploadResult = req.uploadResult; // Set by processProfileImageUpload middleware

    if (!uploadResult) {
      return next(createError(400, "No upload result found"));
    }

    // Update user's profile image URL
    const user = await User.findById(userId);
    if (!user) {
      return next(createError(404, "User not found"));
    }

    user.profileImage = uploadResult.url;
    await user.save();

    res.json({
      success: true,
      message: "Profile image uploaded successfully",
      profileImage: user.profileImage,
      uploadDetails: {
        filename: uploadResult.filename,
        originalname: uploadResult.originalname,
        size: uploadResult.size,
      },
    });
  } catch (error) {
    console.error("Upload profile image error:", error);
    next(error);
  }
};

// Upload cover image
const uploadCoverImage = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const uploadResult = req.uploadResult; // Set by processCoverImageUpload middleware

    if (!uploadResult) {
      return next(createError(400, "No upload result found"));
    }

    // Update user's cover image URL
    const user = await User.findById(userId);
    if (!user) {
      return next(createError(404, "User not found"));
    }

    user.coverImage = uploadResult.url;
    await user.save();

    res.json({
      success: true,
      message: "Cover image uploaded successfully",
      coverImage: user.coverImage,
      uploadDetails: {
        filename: uploadResult.filename,
        originalname: uploadResult.originalname,
        size: uploadResult.size,
      },
    });
  } catch (error) {
    console.error("Upload cover image error:", error);
    next(error);
  }
};

// Search users
const searchUsers = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, errors.array()[0].msg));
    }

    const { q, page = 1, limit = 20, filter } = req.query;

    const searchQuery = q.trim();
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build search criteria
    let searchCriteria = {
      isActive: true, // Only show active users
      $or: [
        { username: { $regex: searchQuery, $options: "i" } },
        { firstName: { $regex: searchQuery, $options: "i" } },
        { lastName: { $regex: searchQuery, $options: "i" } },
        {
          $expr: {
            $regexMatch: {
              input: { $concat: ["$firstName", " ", "$lastName"] },
              regex: searchQuery,
              options: "i",
            },
          },
        },
      ],
    };

    // Apply additional filters
    if (filter) {
      switch (filter) {
        case "creators":
          searchCriteria.subscriptionPrice = { $gt: 0 };
          break;
        case "verified":
          searchCriteria.isVerified = true;
          break;
        case "online":
          // Add online status filter if you have this field
          searchCriteria.lastLoginAt = {
            $gte: new Date(Date.now() - 30 * 60 * 1000),
          }; // Active in last 30 mins
          break;
      }
    }

    // Execute search with pagination
    const [users, totalCount] = await Promise.all([
      User.find(searchCriteria)
        .select(
          "username firstName lastName profileImage coverImage subscriptionPrice createdAt lastLoginAt"
        )
        .sort({
          // Prioritize exact username matches, then by creation date
          username:
            searchQuery.toLowerCase() === searchQuery.toLowerCase() ? -1 : 1,
          createdAt: -1,
        })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(searchCriteria),
    ]);

    // Format user data for response
    const formattedUsers = users.map((user) => ({
      _id: user._id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      profileImage: user.profileImage,
      coverImage: user.coverImage,
      subscriptionPrice: user.subscriptionPrice || 0,
      joinedAt: user.createdAt,
      // Don't expose sensitive information like lastLoginAt to other users
    }));

    const totalPages = Math.ceil(totalCount / limitNum);

    res.json({
      success: true,
      query: searchQuery,
      users: formattedUsers,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        limit: limitNum,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("Search users error:", error);
    next(error);
  }
};

// Get user profile by username (public profile)
const getUserByUsername = async (req, res, next) => {
  try {
    const { username } = req.params;

    if (!username) {
      return next(createError(400, "Username is required"));
    }

    const user = await User.findOne({
      username: username,
      isActive: true,
    }).select("-password -payoutMethods -totalEarnings -availableBalance");

    if (!user) {
      return next(createError(404, "User not found"));
    }

    // Get real-time counts
    const subscriberCount = await getSubscriberCount(user._id);
    const subscriptionCount = await getSubscriptionCount(user._id);

    // Check if current user is subscribed to this profile (only if user is authenticated)
    let isSubscribed = false;
    if (req.user && req.user._id.toString() !== user._id.toString()) {
      isSubscribed = await checkSubscriptionStatus(req.user._id, user._id);
    }

    // Return public profile information
    res.json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImage: user.profileImage,
        coverImage: user.coverImage,
        subscriptionPrice: user.subscriptionPrice,
        subscriberCount,
        subscriptionCount,
        isSubscribed,
        role: user.role,
        createdAt: user.createdAt,
        // Only show email if it's the current user or an admin
        ...(req.user &&
        (req.user._id.toString() === user._id.toString() ||
          req.user.role === "admin")
          ? { email: user.email }
          : {}),
      },
    });
  } catch (error) {
    console.error("Get user by username error:", error);
    next(error);
  }
};

// Get current logged-in user info
const getCurrentUser = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).select("-password");

    if (!user) {
      return next(createError(404, "User not found"));
    }

    // Get real-time counts
    const subscriberCount = await getSubscriberCount(user._id);
    const subscriptionCount = await getSubscriptionCount(user._id);
    const postCount = await getPostCount(user._id);

    res.json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        profileImage: user.profileImage,
        coverImage: user.coverImage,
        subscriptionPrice: user.subscriptionPrice,
        subscriberCount,
        subscriptionCount,
        postCount,
        isSubscribed: false, // User cannot be subscribed to themselves
        totalEarnings: user.totalEarnings,
        availableBalance: user.availableBalance,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        payoutMethods: user.payoutMethods
          ? user.payoutMethods.map((method) => ({
              _id: method._id,
              type: method.type,
              isDefault: method.isDefault,
              isVerified: method.isVerified,
              createdAt: method.createdAt,
              accountDetails: maskAccountDetails(
                method.type,
                method.accountDetails
              ),
            }))
          : [],
      },
    });
  } catch (error) {
    console.error("Get current user error:", error);
    next(error);
  }
};

// Get featured creators based on subscriber count
const getFeaturedCreators = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, minSubscribers = 0 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get all active creators who have at least one subscription or content
    const creators = await User.find({
      isActive: true,
      role: { $in: ["user", "creator"] }, // Both users and creators can create content
      subscriptionPrice: { $gt: 0 }, // Only users who have set a subscription price
    })
      .select("-password -payoutMethods -totalEarnings -availableBalance")
      .lean();

    // Get subscriber counts for all creators
    const creatorsWithCounts = await Promise.all(
      creators.map(async (creator) => {
        const subscriberCount = await getSubscriberCount(creator._id);
        const subscriptionCount = await getSubscriptionCount(creator._id);
        const postCount = await getPostCount(creator._id);

        return {
          ...creator,
          subscriberCount,
          subscriptionCount,
          postCount,
        };
      })
    );

    // Filter creators with minimum subscriber count
    const filteredCreators = creatorsWithCounts.filter(
      (creator) => creator.subscriberCount >= parseInt(minSubscribers)
    );

    // Sort by subscriber count (descending) and creation date
    filteredCreators.sort((a, b) => {
      if (b.subscriberCount !== a.subscriberCount) {
        return b.subscriberCount - a.subscriberCount;
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    // Apply pagination
    const totalCount = filteredCreators.length;
    const paginatedCreators = filteredCreators.slice(skip, skip + limitNum);

    // Format creators for response
    const formattedCreators = paginatedCreators.map((creator) => ({
      _id: creator._id,
      username: creator.username,
      firstName: creator.firstName,
      lastName: creator.lastName,
      profileImage: creator.profileImage,
      coverImage: creator.coverImage,
      bio: creator.bio,
      subscriptionPrice: creator.subscriptionPrice,
      subscriberCount: creator.subscriberCount,
      subscriptionCount: creator.subscriptionCount,
      postCount: creator.postCount,
      role: creator.role,
      createdAt: creator.createdAt,
      // Add featured rank based on position
      featuredRank: skip + paginatedCreators.indexOf(creator) + 1,
    }));

    const totalPages = Math.ceil(totalCount / limitNum);

    res.json({
      success: true,
      creators: formattedCreators,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        limit: limitNum,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
      filters: {
        minSubscribers: parseInt(minSubscribers),
      },
    });
  } catch (error) {
    console.error("Get featured creators error:", error);
    next(error);
  }
};

// Get trending creators (most new subscribers in the last 30 days)
const getTrendingCreators = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Aggregate subscriptions from the last 30 days
    const trendingData = await Subscription.aggregate([
      {
        $match: {
          status: "active",
          startDate: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: "$creator",
          recentSubscribers: { $sum: 1 },
        },
      },
      {
        $sort: { recentSubscribers: -1 },
      },
      {
        $skip: skip,
      },
      {
        $limit: limitNum,
      },
    ]);

    // Get creator details
    const creatorIds = trendingData.map((item) => item._id);

    if (creatorIds.length === 0) {
      return res.json({
        success: true,
        creators: [],
        pagination: {
          currentPage: pageNum,
          totalPages: 0,
          totalCount: 0,
          limit: limitNum,
          hasNext: false,
          hasPrev: false,
        },
        period: "last_30_days",
      });
    }

    const creators = await User.find({
      _id: { $in: creatorIds },
      isActive: true,
    })
      .select("-password -payoutMethods -totalEarnings -availableBalance")
      .lean();

    // Combine creator data with trending data
    const trendingCreators = await Promise.all(
      creators.map(async (creator) => {
        const trendingInfo = trendingData.find(
          (item) => item._id.toString() === creator._id.toString()
        );
        const totalSubscriberCount = await getSubscriberCount(creator._id);
        const subscriptionCount = await getSubscriptionCount(creator._id);
        const postCount = await getPostCount(creator._id);

        return {
          _id: creator._id,
          username: creator.username,
          firstName: creator.firstName,
          lastName: creator.lastName,
          profileImage: creator.profileImage,
          coverImage: creator.coverImage,
          bio: creator.bio,
          subscriptionPrice: creator.subscriptionPrice,
          subscriberCount: totalSubscriberCount,
          subscriptionCount,
          postCount,
          recentSubscribers: trendingInfo?.recentSubscribers || 0,
          role: creator.role,
          createdAt: creator.createdAt,
          trendingRank:
            trendingData.findIndex(
              (item) => item._id.toString() === creator._id.toString()
            ) +
            1 +
            skip,
        };
      })
    );

    // Sort by recent subscribers to maintain order
    trendingCreators.sort((a, b) => b.recentSubscribers - a.recentSubscribers);

    // Get total count for pagination
    const totalTrendingCount = await Subscription.aggregate([
      {
        $match: {
          status: "active",
          startDate: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: "$creator",
          recentSubscribers: { $sum: 1 },
        },
      },
      {
        $count: "total",
      },
    ]);

    const totalCount = totalTrendingCount[0]?.total || 0;
    const totalPages = Math.ceil(totalCount / limitNum);

    res.json({
      success: true,
      creators: trendingCreators,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        limit: limitNum,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
      period: "last_30_days",
    });
  } catch (error) {
    console.error("Get trending creators error:", error);
    next(error);
  }
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
  uploadProfileImage,
  uploadCoverImage,
  searchUsers,
  getUserByUsername,
  getCurrentUser,
  getFeaturedCreators,
  getTrendingCreators,
};
