const Subscription = require("../models/subscription_model");
const User = require("../models/user_model");
const createError = require("http-errors");
const { validationResult } = require("express-validator");

// Subscribe to a creator
const subscribeToCreator = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, errors.array()[0].msg));
    }

    const { creatorId, paymentMethod = "stripe" } = req.body;
    const subscriberId = req.user._id;

    // Prevent self-subscription
    if (subscriberId.toString() === creatorId.toString()) {
      return next(createError(400, "You cannot subscribe to yourself"));
    }

    // Check if creator exists and has subscription price set
    const creator = await User.findById(creatorId);
    if (!creator) {
      return next(createError(404, "Creator not found"));
    }

    if (!creator.subscriptionPrice || creator.subscriptionPrice <= 0) {
      return next(createError(400, "Creator has not set a subscription price"));
    }

    // Check if already subscribed
    const existingSubscription = await Subscription.findActiveSubscription(
      subscriberId,
      creatorId
    );

    if (existingSubscription) {
      return next(
        createError(400, "You are already subscribed to this creator")
      );
    }

    // Calculate subscription end date (1 month from now)
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    const nextBillingDate = new Date(endDate);

    // Create subscription
    const subscription = new Subscription({
      subscriber: subscriberId,
      creator: creatorId,
      subscriptionPrice: creator.subscriptionPrice,
      status: "active", // In real implementation, this would be "pending" until payment
      endDate,
      nextBillingDate,
      paymentMethod,
      totalPaid: creator.subscriptionPrice,
      lastPaymentDate: new Date(),
    });

    await subscription.save();
    await subscription.populate(
      "creator",
      "username firstName lastName profileImage subscriptionPrice"
    );
    await subscription.populate(
      "subscriber",
      "username firstName lastName profileImage"
    );

    // Update creator's earnings (in a real app, this would happen after payment confirmation)
    await User.findByIdAndUpdate(creatorId, {
      $inc: {
        totalEarnings: creator.subscriptionPrice,
        availableBalance: creator.subscriptionPrice,
      },
    });

    res.status(201).json({
      success: true,
      message: "Successfully subscribed to creator",
      subscription: {
        _id: subscription._id,
        creator: subscription.creator,
        subscriptionPrice: subscription.subscriptionPrice,
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        nextBillingDate: subscription.nextBillingDate,
        autoRenew: subscription.autoRenew,
        daysRemaining: subscription.daysRemaining(),
      },
    });
  } catch (error) {
    console.error("Subscribe to creator error:", error);
    next(error);
  }
};

// Unsubscribe from a creator
const unsubscribeFromCreator = async (req, res, next) => {
  try {
    const { username } = req.params;
    const subscriberId = req.user._id;

    // Find creator by username
    const creator = await User.findOne({ username, isActive: true }).select(
      "_id"
    );
    if (!creator) {
      return next(createError(404, "Creator not found"));
    }

    const creatorId = creator._id;

    const subscription = await Subscription.findActiveSubscription(
      subscriberId,
      creatorId
    );

    if (!subscription) {
      return next(createError(404, "Active subscription not found"));
    }

    // Update subscription status
    subscription.status = "cancelled";
    subscription.cancelledAt = new Date();
    subscription.autoRenew = false;
    subscription.cancelReason = "User requested cancellation";

    await subscription.save();

    res.json({
      success: true,
      message: "Successfully unsubscribed from creator",
      subscription: {
        _id: subscription._id,
        status: subscription.status,
        cancelledAt: subscription.cancelledAt,
        endDate: subscription.endDate, // Access remains until end date
      },
    });
  } catch (error) {
    console.error("Unsubscribe from creator error:", error);
    next(error);
  }
};

// Get user's subscriptions
const getMySubscriptions = async (req, res, next) => {
  try {
    const subscriberId = req.user._id;
    const { status = "all", page = 1, limit = 10 } = req.query;

    let query = { subscriber: subscriberId };

    if (status !== "all") {
      query.status = status;
    }

    const subscriptions = await Subscription.find(query)
      .populate(
        "creator",
        "username firstName lastName profileImage subscriptionPrice"
      )
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Subscription.countDocuments(query);

    const formattedSubscriptions = subscriptions.map((sub) => ({
      _id: sub._id,
      creator: sub.creator,
      subscriptionPrice: sub.subscriptionPrice,
      status: sub.status,
      startDate: sub.startDate,
      endDate: sub.endDate,
      nextBillingDate: sub.nextBillingDate,
      autoRenew: sub.autoRenew,
      daysRemaining: sub.daysRemaining(),
      hasAccess: sub.hasAccess(),
      cancelledAt: sub.cancelledAt,
      totalPaid: sub.totalPaid,
    }));

    res.json({
      success: true,
      subscriptions: formattedSubscriptions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get my subscriptions error:", error);
    next(error);
  }
};

// Get creator's subscribers
const getMySubscribers = async (req, res, next) => {
  try {
    const creatorId = req.user._id;
    const { status = "active", page = 1, limit = 10 } = req.query;

    let query = { creator: creatorId };

    if (status !== "all") {
      if (status === "active") {
        query.status = "active";
        query.endDate = { $gt: new Date() };
      } else {
        query.status = status;
      }
    }

    const subscriptions = await Subscription.find(query)
      .populate("subscriber", "username firstName lastName profileImage")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Subscription.countDocuments(query);

    const formattedSubscriptions = subscriptions.map((sub) => ({
      _id: sub._id,
      subscriber: sub.subscriber,
      subscriptionPrice: sub.subscriptionPrice,
      status: sub.status,
      startDate: sub.startDate,
      endDate: sub.endDate,
      nextBillingDate: sub.nextBillingDate,
      daysRemaining: sub.daysRemaining(),
      hasAccess: sub.hasAccess(),
      totalPaid: sub.totalPaid,
      lastPaymentDate: sub.lastPaymentDate,
    }));

    // Calculate earnings summary
    const totalEarnings = await Subscription.aggregate([
      { $match: { creator: creatorId, status: "active" } },
      { $group: { _id: null, total: { $sum: "$totalPaid" } } },
    ]);

    const monthlyEarnings = await Subscription.aggregate([
      {
        $match: {
          creator: creatorId,
          status: "active",
          startDate: {
            $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      },
      { $group: { _id: null, total: { $sum: "$subscriptionPrice" } } },
    ]);

    res.json({
      success: true,
      subscribers: formattedSubscriptions,
      summary: {
        totalSubscribers: total,
        activeSubscribers: formattedSubscriptions.filter((sub) => sub.hasAccess)
          .length,
        totalEarnings: totalEarnings[0]?.total || 0,
        monthlyEarnings: monthlyEarnings[0]?.total || 0,
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get my subscribers error:", error);
    next(error);
  }
};

// Check subscription status
const checkSubscriptionStatus = async (req, res, next) => {
  try {
    const { username } = req.params;
    const subscriberId = req.user._id;

    // Find creator by username
    const creator = await User.findOne({ username, isActive: true }).select(
      "_id"
    );
    if (!creator) {
      return next(createError(404, "Creator not found"));
    }

    const creatorId = creator._id;

    const subscription = await Subscription.findOne({
      subscriber: subscriberId,
      creator: creatorId,
    })
      .populate(
        "creator",
        "username firstName lastName profileImage subscriptionPrice"
      )
      .sort({ createdAt: -1 }); // Get the most recent subscription

    if (!subscription) {
      return res.json({
        success: true,
        hasSubscription: false,
        hasAccess: false,
        subscription: null,
      });
    }

    res.json({
      success: true,
      hasSubscription: true,
      hasAccess: subscription.hasAccess(),
      subscription: {
        _id: subscription._id,
        creator: subscription.creator,
        subscriptionPrice: subscription.subscriptionPrice,
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        daysRemaining: subscription.daysRemaining(),
        autoRenew: subscription.autoRenew,
        cancelledAt: subscription.cancelledAt,
      },
    });
  } catch (error) {
    console.error("Check subscription status error:", error);
    next(error);
  }
};

// Toggle auto-renewal
const toggleAutoRenewal = async (req, res, next) => {
  try {
    const { subscriptionId } = req.params;
    const subscriberId = req.user._id;

    const subscription = await Subscription.findOne({
      _id: subscriptionId,
      subscriber: subscriberId,
      status: "active",
    });

    if (!subscription) {
      return next(createError(404, "Active subscription not found"));
    }

    subscription.autoRenew = !subscription.autoRenew;
    await subscription.save();

    res.json({
      success: true,
      message: `Auto-renewal ${
        subscription.autoRenew ? "enabled" : "disabled"
      }`,
      autoRenew: subscription.autoRenew,
    });
  } catch (error) {
    console.error("Toggle auto-renewal error:", error);
    next(error);
  }
};

module.exports = {
  subscribeToCreator,
  unsubscribeFromCreator,
  getMySubscriptions,
  getMySubscribers,
  checkSubscriptionStatus,
  toggleAutoRenewal,
};
