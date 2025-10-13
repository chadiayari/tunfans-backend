const Subscription = require("../models/subscription_model");
const createError = require("http-errors");

// Middleware to check if user has active subscription to access creator's content
const checkSubscriptionAccess = async (req, res, next) => {
  try {
    const { creatorId } = req.params;
    const userId = req.user._id;

    // If accessing own content, allow
    if (userId.toString() === creatorId.toString()) {
      return next();
    }

    // Check for active subscription
    const subscription = await Subscription.findActiveSubscription(
      userId,
      creatorId
    );

    if (!subscription || !subscription.hasAccess()) {
      return next(
        createError(403, "Active subscription required to access this content")
      );
    }

    // Add subscription info to request for potential use in controllers
    req.subscription = subscription;
    next();
  } catch (error) {
    console.error("Check subscription access error:", error);
    next(error);
  }
};

// Middleware to check if user is subscribed (but allow access even if subscription expired)
const checkSubscriptionHistory = async (req, res, next) => {
  try {
    const { creatorId } = req.params;
    const userId = req.user._id;

    // If accessing own content, allow
    if (userId.toString() === creatorId.toString()) {
      return next();
    }

    // Check for any subscription (active or expired)
    const subscription = await Subscription.findOne({
      subscriber: userId,
      creator: creatorId,
    }).sort({ createdAt: -1 });

    if (!subscription) {
      return next(
        createError(403, "Subscription required to access this content")
      );
    }

    req.subscription = subscription;
    next();
  } catch (error) {
    console.error("Check subscription history error:", error);
    next(error);
  }
};

module.exports = {
  checkSubscriptionAccess,
  checkSubscriptionHistory,
};
