const User = require("../models/user_model");
const createError = require("http-errors");

const getUsers = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const skip = (page - 1) * limit;
    let query = {};

    // Search functionality
    if (search) {
      query = {
        $or: [
          { fullName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { username: { $regex: search, $options: "i" } },
        ],
      };
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    const users = await User.find(query)
      .select("-password")
      .populate("children")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const totalUsers = await User.countDocuments(query);
    const totalPages = Math.ceil(totalUsers / limit);

    // Get user statistics
    const userStats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: {
            $sum: {
              $cond: [
                {
                  $gte: [
                    "$lastLoginAt",
                    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                  ],
                },
                1,
                0,
              ],
            },
          },
          newUsersThisMonth: {
            $sum: {
              $cond: [
                {
                  $gte: [
                    "$createdAt",
                    new Date(
                      new Date().getFullYear(),
                      new Date().getMonth(),
                      1
                    ),
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalUsers,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
        statistics: userStats[0] || {
          totalUsers: 0,
          activeUsers: 0,
          newUsersThisMonth: 0,
        },
      },
    });
  } catch (error) {
    console.error("Get users error:", error);
    next(error);
  }
};

// Get single user details
const getUserDetails = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .select("-password")
      .populate("children");

    if (!user) {
      return next(createError(404, "User not found"));
    }

    res.json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    console.error("Get user details error:", error);
    next(error);
  }
};

// Update user status (activate/deactivate)
const updateUserStatus = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { isActive, reason } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return next(createError(404, "User not found"));
    }

    user.isActive = isActive;
    if (reason) {
      user.statusUpdateReason = reason;
    }
    user.statusUpdatedBy = req.user._id;
    user.statusUpdatedAt = new Date();

    await user.save();

    res.json({
      success: true,
      message: `User ${isActive ? "activated" : "deactivated"} successfully`,
      data: { userId, isActive },
    });
  } catch (error) {
    console.error("Update user status error:", error);
    next(error);
  }
};

const getDashboardOverview = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get overview statistics
    const [
      totalUsers,
      totalOrders,
      todayOrders,
      weeklyOrders,
      monthlyRevenue,
      pendingOrders,
      recentOrders,
    ] = await Promise.all([
      // Total users
      User.countDocuments(),

      // Total orders
      Order.countDocuments(),

      // Today's orders
      Order.countDocuments({
        createdAt: { $gte: startOfToday },
      }),

      // Weekly orders
      Order.countDocuments({
        createdAt: { $gte: startOfWeek },
      }),

      // Monthly revenue
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfMonth },
            paymentStatus: "succeeded",
          },
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: "$totalAmount" },
          },
        },
      ]),

      // Pending orders
      Order.countDocuments({ status: "pending" }),

      // Recent orders
      Order.find()
        .populate("user", "username email")
        .sort({ createdAt: -1 })
        .limit(10),
    ]);

    // Status distribution
    const statusDistribution = await Order.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalOrders,
          todayOrders,
          weeklyOrders,
          monthlyRevenue: monthlyRevenue[0]?.revenue || 0,
          pendingOrders,
        },
        recentOrders,
        statusDistribution,
        lastUpdated: new Date(),
      },
    });
  } catch (error) {
    console.error("Get dashboard overview error:", error);
    next(error);
  }
};

module.exports = {
  // User management
  getUsers,
  getUserDetails,
  updateUserStatus,

  // Dashboard
  getDashboardOverview,
};
