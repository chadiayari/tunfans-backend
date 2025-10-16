const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    images: [
      {
        url: {
          type: String,
          required: true,
        },
        key: {
          type: String,
          required: true,
        },
        caption: {
          type: String,
          maxlength: 500,
        },
      },
    ],
    videos: [
      {
        url: {
          type: String,
          required: true,
        },
        key: {
          type: String,
          required: true,
        },
        thumbnail: {
          type: String,
        },
        duration: {
          type: Number, // in seconds
        },
        caption: {
          type: String,
          maxlength: 500,
        },
      },
    ],
    isExclusive: {
      type: Boolean,
      default: false,
    },
    likes: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        likedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    comments: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        content: {
          type: String,
          required: true,
          trim: true,
          maxlength: 500,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        isDeleted: {
          type: Boolean,
          default: false,
        },
      },
    ],
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    visibility: {
      type: String,
      enum: ["public", "subscribers", "private"],
      default: "public",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    viewCount: {
      type: Number,
      default: 0,
    },
    shareCount: {
      type: Number,
      default: 0,
    },
    scheduledAt: {
      type: Date,
      default: null,
    },
    publishedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ isActive: 1, publishedAt: -1 });
postSchema.index({ tags: 1 });
postSchema.index({ visibility: 1 });

// Virtual for like count
postSchema.virtual("likeCount").get(function () {
  return this.likes.length;
});

// Virtual for comment count
postSchema.virtual("commentCount").get(function () {
  return this.comments.filter((comment) => !comment.isDeleted).length;
});

// Include virtuals when converting to JSON
postSchema.set("toJSON", { virtuals: true });
postSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Post", postSchema);
