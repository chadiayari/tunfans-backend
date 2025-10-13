const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "senderModel",
      required: true,
    },
    senderModel: {
      type: String,
      required: true,
      enum: ["User", "Admin"],
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "receiverModel",
      required: true,
    },
    receiverModel: {
      type: String,
      required: true,
      enum: ["User", "Admin"],
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    messageType: {
      type: String,
      enum: ["text", "image", "file"],
      default: "text",
    },
    fileUrl: {
      type: String,
      default: null,
    },
    fileName: {
      type: String,
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
messageSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Message", messageSchema);
