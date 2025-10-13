const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          refPath: "participants.userModel",
          required: true,
        },
        userModel: {
          type: String,
          required: true,
          enum: ["User", "Admin"],
        },
        lastSeen: {
          type: Date,
          default: Date.now,
        },
        unreadCount: {
          type: Number,
          default: 0,
        },
      },
    ],
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    lastActivity: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
conversationSchema.index({ "participants.user": 1 });
conversationSchema.index({ lastActivity: -1 });

// Method to find conversation between two users
conversationSchema.statics.findBetweenUsers = function (
  user1Id,
  user1Model,
  user2Id,
  user2Model
) {
  return this.findOne({
    $and: [
      {
        "participants.user": user1Id,
        "participants.userModel": user1Model,
      },
      {
        "participants.user": user2Id,
        "participants.userModel": user2Model,
      },
    ],
  });
};

module.exports = mongoose.model("Conversation", conversationSchema);
