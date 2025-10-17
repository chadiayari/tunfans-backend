const Message = require("../models/message_model");
const Conversation = require("../models/conversation_model");
const User = require("../models/user_model");
const Admin = require("../models/admins_model");
const createError = require("http-errors");

// Get all conversations for a user
const getConversations = async (req, res, next) => {
  try {
    const { id: userId } = req.user;
    const userRole = req.userRole;
    const userModel = userRole === "admin" ? "Admin" : "User";

    const conversations = await Conversation.find({
      "participants.user": userId,
      "participants.userModel": userModel,
      isActive: true,
    })
      .populate({
        path: "lastMessage",
        select: "content messageType createdAt sender senderModel",
      })
      .populate({
        path: "participants.user",
        select: "username email firstName lastName profileImage",
      })
      .sort({ lastActivity: -1 });

    // Format conversations for frontend
    const formattedConversations = conversations.map((conv) => {
      const otherParticipant = conv.participants.find(
        (p) => p.user._id.toString() !== userId.toString()
      );

      const currentUserParticipant = conv.participants.find(
        (p) => p.user._id.toString() === userId.toString()
      );

      return {
        _id: conv._id,
        participant: otherParticipant.user,
        participantModel: otherParticipant.userModel,
        lastMessage: conv.lastMessage,
        lastActivity: conv.lastActivity,
        unreadCount: currentUserParticipant?.unreadCount || 0,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      };
    });

    res.json({
      success: true,
      conversations: formattedConversations,
    });
  } catch (error) {
    console.error("Get conversations error:", error);
    next(error);
  }
};

// Get total unread messages count for user
const getUnreadMessagesCount = async (req, res, next) => {
  try {
    const { id: userId } = req.user;
    const userRole = req.userRole;
    const userModel = userRole === "admin" ? "Admin" : "User";

    // Get all conversations for the user
    const conversations = await Conversation.find({
      "participants.user": userId,
      "participants.userModel": userModel,
      isActive: true,
    });

    // Calculate total unread count
    let totalUnreadCount = 0;
    for (const conversation of conversations) {
      const currentUserParticipant = conversation.participants.find(
        (p) => p.user.toString() === userId.toString()
      );
      if (currentUserParticipant) {
        totalUnreadCount += currentUserParticipant.unreadCount || 0;
      }
    }

    res.json({
      success: true,
      unreadCount: totalUnreadCount,
    });
  } catch (error) {
    console.error("Get unread messages count error:", error);
    next(error);
  }
};

// Get messages in a conversation
const getMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const { id: userId } = req.user;
    const userRole = req.userRole;
    const userModel = userRole === "admin" ? "Admin" : "User";

    // Verify user is part of this conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      "participants.user": userId,
      "participants.userModel": userModel,
    });

    if (!conversation) {
      return next(createError(404, "Conversation not found"));
    }

    const messages = await Message.find({
      $or: [
        {
          sender: userId,
          receiver: { $in: conversation.participants.map((p) => p.user) },
        },
        {
          receiver: userId,
          sender: { $in: conversation.participants.map((p) => p.user) },
        },
      ],
      isDeleted: false,
    })
      .populate("sender", "username email firstName lastName profileImage")
      .populate("receiver", "username email firstName lastName profileImage")
      .sort({ createdAt: -1 })
      .limit(limit * page)
      .skip((page - 1) * limit);

    // Mark messages as read
    await Message.updateMany(
      {
        receiver: userId,
        sender: { $in: conversation.participants.map((p) => p.user) },
        isRead: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      }
    );

    // Update unread count in conversation
    await Conversation.updateOne(
      {
        _id: conversationId,
        "participants.user": userId,
      },
      {
        $set: { "participants.$.unreadCount": 0 },
      }
    );

    res.json({
      success: true,
      messages: messages.reverse(),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: messages.length === parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Get messages error:", error);
    next(error);
  }
};

// Send a message
const sendMessage = async (req, res, next) => {
  try {
    const {
      receiverId,
      receiverModel,
      content,
      messageType = "text",
    } = req.body;
    const { id: senderId } = req.user;
    const senderRole = req.userRole;
    const senderModel = senderRole === "admin" ? "Admin" : "User";

    // Validate receiver exists
    const ReceiverModel = receiverModel === "Admin" ? Admin : User;
    const receiver = await ReceiverModel.findById(receiverId);
    if (!receiver) {
      return next(createError(404, "Receiver not found"));
    }

    // Find or create conversation
    let conversation = await Conversation.findBetweenUsers(
      senderId,
      senderModel,
      receiverId,
      receiverModel
    );

    if (!conversation) {
      conversation = new Conversation({
        participants: [
          { user: senderId, userModel: senderModel },
          { user: receiverId, userModel: receiverModel },
        ],
      });
      await conversation.save();
    }

    // Create message
    const message = new Message({
      sender: senderId,
      senderModel,
      receiver: receiverId,
      receiverModel,
      content,
      messageType,
    });

    await message.save();
    await message.populate(
      "sender",
      "username email firstName lastName profileImage"
    );
    await message.populate(
      "receiver",
      "username email firstName lastName profileImage"
    );

    // Update conversation
    conversation.lastMessage = message._id;
    conversation.lastActivity = new Date();

    // Increment unread count for receiver
    const receiverParticipant = conversation.participants.find(
      (p) => p.user.toString() === receiverId.toString()
    );
    if (receiverParticipant) {
      receiverParticipant.unreadCount += 1;
    }

    await conversation.save();

    res.json({
      success: true,
      message,
    });
  } catch (error) {
    console.error("Send message error:", error);
    next(error);
  }
};

// Start conversation with a user
const startConversation = async (req, res, next) => {
  try {
    const { userId, userModel } = req.body;
    const { id: currentUserId } = req.user;
    const currentUserRole = req.userRole;
    const currentUserModel = currentUserRole === "admin" ? "Admin" : "User";

    // Validate target user exists
    const TargetUserModel = userModel === "Admin" ? Admin : User;
    const targetUser = await TargetUserModel.findById(userId);
    if (!targetUser) {
      return next(createError(404, "User not found"));
    }

    // Find or create conversation
    let conversation = await Conversation.findBetweenUsers(
      currentUserId,
      currentUserModel,
      userId,
      userModel
    );

    if (!conversation) {
      conversation = new Conversation({
        participants: [
          { user: currentUserId, userModel: currentUserModel },
          { user: userId, userModel: userModel },
        ],
      });
      await conversation.save();
    }

    await conversation.populate({
      path: "participants.user",
      select: "username email firstName lastName profileImage",
    });

    const otherParticipant = conversation.participants.find(
      (p) => p.user._id.toString() !== currentUserId.toString()
    );

    res.json({
      success: true,
      conversation: {
        _id: conversation._id,
        participant: otherParticipant.user,
        participantModel: otherParticipant.userModel,
        lastMessage: null,
        lastActivity: conversation.lastActivity,
        unreadCount: 0,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
    });
  } catch (error) {
    console.error("Start conversation error:", error);
    next(error);
  }
};

// Get or create a conversation between users
const getOrCreateConversation = async (req, res, next) => {
  try {
    const { userId: targetUserId, userModel = "User" } = req.params;
    const { id: currentUserId } = req.user;
    const currentUserRole = req.userRole;
    const currentUserModel = currentUserRole === "admin" ? "Admin" : "User";

    // Validate target user exists
    const TargetUserModel = userModel === "Admin" ? Admin : User;
    const targetUser = await TargetUserModel.findById(targetUserId);
    if (!targetUser) {
      return next(createError(404, "User not found"));
    }

    // Find or create conversation
    let conversation = await Conversation.findBetweenUsers(
      currentUserId,
      currentUserModel,
      targetUserId,
      userModel
    );

    if (!conversation) {
      conversation = new Conversation({
        participants: [
          { user: currentUserId, userModel: currentUserModel },
          { user: targetUserId, userModel: userModel },
        ],
      });
      await conversation.save();
    }

    await conversation.populate({
      path: "participants.user",
      select: "username email firstName lastName profileImage",
    });

    // Get the other participant
    const otherParticipant = conversation.participants.find(
      (p) => p.user._id.toString() !== currentUserId.toString()
    );

    res.json({
      success: true,
      conversation: {
        _id: conversation._id,
        participant: otherParticipant.user,
        participantModel: otherParticipant.userModel,
        lastMessage: conversation.lastMessage,
        lastActivity: conversation.lastActivity,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
    });
  } catch (error) {
    console.error("Get or create conversation error:", error);
    next(error);
  }
};

module.exports = {
  getConversations,
  getUnreadMessagesCount,
  getMessages,
  sendMessage,
  startConversation,
  getOrCreateConversation,
};
