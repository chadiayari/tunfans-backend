const jwt = require("jsonwebtoken");
const User = require("../models/user_model");
const Admin = require("../models/admins_model");
const Message = require("../models/message_model");
const Conversation = require("../models/conversation_model");

class SocketService {
  constructor(io) {
    this.io = io;
    this.connectedUsers = new Map(); // Map to store userId -> socketId
    this.userSockets = new Map(); // Map to store socketId -> user info
    this.setupSocketHandlers();
  }

  setupSocketHandlers() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error("Authentication error: No token provided"));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Get user info based on role
        let user;
        if (decoded.role === "admin") {
          user = await Admin.findById(decoded.id).select("-password");
        } else {
          user = await User.findById(decoded.id).select("-password");
        }

        if (!user) {
          return next(new Error("Authentication error: User not found"));
        }

        socket.userId = decoded.id;
        socket.userRole = decoded.role;
        socket.user = user;
        next();
      } catch (error) {
        next(new Error("Authentication error: Invalid token"));
      }
    });

    this.io.on("connection", (socket) => {
      console.log(`User connected: ${socket.user.username} (${socket.userId})`);

      // Store the connection
      this.connectedUsers.set(socket.userId, socket.id);
      this.userSockets.set(socket.id, {
        userId: socket.userId,
        userRole: socket.userRole,
        user: socket.user,
      });

      // Join user to their personal room
      socket.join(`user_${socket.userId}`);

      // Emit online status to all connected users
      this.broadcastUserStatus(socket.userId, "online");

      // Handle joining conversation rooms
      socket.on("join_conversation", (conversationId) => {
        socket.join(`conversation_${conversationId}`);
        console.log(
          `User ${socket.userId} joined conversation ${conversationId}`
        );
      });

      // Handle leaving conversation rooms
      socket.on("leave_conversation", (conversationId) => {
        socket.leave(`conversation_${conversationId}`);
        console.log(
          `User ${socket.userId} left conversation ${conversationId}`
        );
      });

      // Handle sending messages
      socket.on("send_message", async (data) => {
        try {
          await this.handleSendMessage(socket, data);
        } catch (error) {
          console.error("Send message error:", error);
          socket.emit("message_error", { error: error.message });
        }
      });

      // Handle typing indicators
      socket.on("typing_start", (data) => {
        const { conversationId } = data;
        socket.to(`conversation_${conversationId}`).emit("user_typing", {
          userId: socket.userId,
          username: socket.user.username,
          conversationId,
        });
      });

      socket.on("typing_stop", (data) => {
        const { conversationId } = data;
        socket
          .to(`conversation_${conversationId}`)
          .emit("user_stopped_typing", {
            userId: socket.userId,
            conversationId,
          });
      });

      // Handle message read status
      socket.on("mark_messages_read", async (data) => {
        try {
          await this.handleMarkMessagesRead(socket, data);
        } catch (error) {
          console.error("Mark messages read error:", error);
        }
      });

      // Handle disconnect
      socket.on("disconnect", () => {
        console.log(
          `User disconnected: ${socket.user.username} (${socket.userId})`
        );

        // Remove from connected users
        this.connectedUsers.delete(socket.userId);
        this.userSockets.delete(socket.id);

        // Emit offline status
        this.broadcastUserStatus(socket.userId, "offline");
      });
    });
  }

  async handleSendMessage(socket, data) {
    const {
      receiverId,
      receiverModel,
      content,
      messageType = "text",
      conversationId,
    } = data;
    const senderId = socket.userId;
    const senderRole = socket.userRole;
    const senderModel = senderRole === "admin" ? "Admin" : "User";

    // Validate receiver exists
    const ReceiverModel = receiverModel === "Admin" ? Admin : User;
    const receiver = await ReceiverModel.findById(receiverId);
    if (!receiver) {
      throw new Error("Receiver not found");
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

    // Emit message to conversation room
    this.io.to(`conversation_${conversation._id}`).emit("new_message", {
      message,
      conversationId: conversation._id,
    });

    // Emit to receiver's personal room (for notifications)
    this.io.to(`user_${receiverId}`).emit("message_notification", {
      message,
      conversationId: conversation._id,
      sender: message.sender,
    });

    // Confirm message sent to sender
    socket.emit("message_sent", {
      message,
      conversationId: conversation._id,
    });
  }

  async handleMarkMessagesRead(socket, data) {
    const { conversationId, messageIds } = data;
    const userId = socket.userId;

    // Update messages as read
    await Message.updateMany(
      {
        _id: { $in: messageIds },
        receiver: userId,
        isRead: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      }
    );

    // Update conversation unread count
    await Conversation.updateOne(
      {
        _id: conversationId,
        "participants.user": userId,
      },
      {
        $set: { "participants.$.unreadCount": 0 },
      }
    );

    // Emit read status to conversation
    this.io.to(`conversation_${conversationId}`).emit("messages_read", {
      messageIds,
      readBy: userId,
      readAt: new Date(),
    });
  }

  broadcastUserStatus(userId, status) {
    this.io.emit("user_status_change", {
      userId,
      status,
      timestamp: new Date(),
    });
  }

  // Method to send system messages
  async sendSystemMessage(conversationId, content) {
    this.io.to(`conversation_${conversationId}`).emit("system_message", {
      content,
      timestamp: new Date(),
      conversationId,
    });
  }

  // Get online users
  getOnlineUsers() {
    return Array.from(this.connectedUsers.keys());
  }

  // Check if user is online
  isUserOnline(userId) {
    return this.connectedUsers.has(userId.toString());
  }
}

module.exports = SocketService;
