const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  firstName: {
    type: String,
    required: true,
    trim: true,
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
  },
  dateOfBirth: {
    type: Date,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  role: {
    type: String,
    default: "user",
    enum: ["user", "admin", "creator"],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  lastLoginAt: {
    type: Date,
  },
  statusUpdateReason: {
    type: String,
  },
  statusUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
  },
  statusUpdatedAt: {
    type: Date,
  },
  // Profile information
  profileImage: {
    type: String, // URL to the profile image
    default: null,
  },
  coverImage: {
    type: String, // URL to the cover image
    default: null,
  },
  bio: {
    type: String,
    maxlength: 500,
    default: "",
  },
  // Subscription-related fields
  subscriptionPrice: {
    type: Number,
    default: 0,
    min: 0,
  },
  payoutMethods: [
    {
      type: {
        type: String,
        enum: ["paypal", "bank_account", "stripe_connect"],
        required: true,
      },
      accountDetails: {
        // For PayPal
        paypalEmail: String,
        // For Bank Account
        accountNumber: String,
        routingNumber: String,
        accountHolderName: String,
        bankName: String,
        // For Stripe Connect
        stripeAccountId: String,
      },
      isDefault: {
        type: Boolean,
        default: false,
      },
      isVerified: {
        type: Boolean,
        default: false,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  totalEarnings: {
    type: Number,
    default: 0,
  },
  availableBalance: {
    type: Number,
    default: 0,
  },
  // Subscription stats
  subscriberCount: {
    type: Number,
    default: 0,
  },
  subscriptionCount: {
    type: Number,
    default: 0,
  },
});

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to check password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);
module.exports = User;
