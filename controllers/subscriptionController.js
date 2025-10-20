const Subscription = require("../models/subscription_model");
const User = require("../models/user_model");
const createError = require("http-errors");
const { validationResult } = require("express-validator");
const NotificationService = require("../services/notificationService");

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

    // Create notification for new subscription
    try {
      await NotificationService.createSubscriptionNotification(
        subscriberId,
        creatorId,
        subscription._id
      );
    } catch (notificationError) {
      console.error(
        "Error creating subscription notification:",
        notificationError
      );
      // Don't fail the subscription operation if notification fails
    }

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
  checkSubscriptionStatus,
  toggleAutoRenewal,
};
