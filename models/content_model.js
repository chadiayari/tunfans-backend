const mongoose = require("mongoose");

const contentSchema = new mongoose.Schema(
  {
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    filename: {
      type: String,
      required: true,
    },
    originalname: {
      type: String,
      required: true,
    },
    mimetype: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    s3Key: {
      type: String,
      required: true,
      unique: true,
    },
    // All content is now exclusive/private by default
    // Pricing for individual content access
    price: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Tags for content organization
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    // Content statistics
    views: {
      type: Number,
      default: 0,
    },
    likes: {
      type: Number,
      default: 0,
    },
    // Content status
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "published",
    },
    // Scheduling
    publishedAt: {
      type: Date,
      default: Date.now,
    },
    scheduledFor: {
      type: Date,
    },
    // Content settings
    isSubscriberOnly: {
      type: Boolean,
      default: true,
    },
    allowComments: {
      type: Boolean,
      default: true,
    },
    allowLikes: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
contentSchema.index({ creator: 1, createdAt: -1 });
contentSchema.index({ contentType: 1 });
contentSchema.index({ status: 1 });
contentSchema.index({ publishedAt: -1 });
contentSchema.index({ tags: 1 });

// Virtual for content URL (will generate signed URL when accessed)
contentSchema.virtual("accessUrl").get(function () {
  return `/api/users/exclusive-content/${this.s3Key}`;
});

// Method to increment views
contentSchema.methods.incrementViews = function () {
  this.views += 1;
  return this.save();
};

// Method to increment likes
contentSchema.methods.incrementLikes = function () {
  this.likes += 1;
  return this.save();
};

// Static method to find content by creator
contentSchema.statics.findByCreator = function (creatorId, options = {}) {
  const query = { creator: creatorId };

  if (options.status) {
    query.status = options.status;
  }

  if (options.contentType) {
    query.contentType = options.contentType;
  }

  return this.find(query)
    .sort(options.sort || { createdAt: -1 })
    .limit(options.limit || 0)
    .skip(options.skip || 0);
};

module.exports = mongoose.model("Content", contentSchema);
