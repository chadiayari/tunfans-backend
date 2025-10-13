const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
  {
    subscriber: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    subscriptionPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["active", "cancelled", "expired", "pending"],
      default: "pending",
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: true,
    },
    renewalDate: {
      type: Date,
    },
    autoRenew: {
      type: Boolean,
      default: true,
    },
    paymentMethod: {
      type: String,
      enum: ["stripe", "paypal", "bank_transfer"],
      default: "stripe",
    },
    stripeSubscriptionId: {
      type: String,
      sparse: true,
    },
    paymentIntentId: {
      type: String,
      sparse: true,
    },
    cancelledAt: {
      type: Date,
    },
    cancelReason: {
      type: String,
    },
    totalPaid: {
      type: Number,
      default: 0,
    },
    lastPaymentDate: {
      type: Date,
    },
    nextBillingDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
subscriptionSchema.index({ subscriber: 1, creator: 1 });
subscriptionSchema.index({ creator: 1, status: 1 });
subscriptionSchema.index({ subscriber: 1, status: 1 });
subscriptionSchema.index({ endDate: 1, status: 1 });

// Compound unique index to prevent duplicate active subscriptions
subscriptionSchema.index(
  { subscriber: 1, creator: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "active" },
  }
);

// Virtual for checking if subscription is currently active
subscriptionSchema.virtual("isActive").get(function () {
  return this.status === "active" && this.endDate > new Date();
});

// Method to check if subscription has access
subscriptionSchema.methods.hasAccess = function () {
  return this.status === "active" && this.endDate > new Date();
};

// Method to calculate days remaining
subscriptionSchema.methods.daysRemaining = function () {
  if (this.status !== "active") return 0;
  const now = new Date();
  const timeDiff = this.endDate - now;
  return Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));
};

// Static method to find active subscription between users
subscriptionSchema.statics.findActiveSubscription = function (
  subscriberId,
  creatorId
) {
  return this.findOne({
    subscriber: subscriberId,
    creator: creatorId,
    status: "active",
    endDate: { $gt: new Date() },
  });
};

module.exports = mongoose.model("Subscription", subscriptionSchema);
