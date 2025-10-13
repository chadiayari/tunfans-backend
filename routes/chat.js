const express = require("express");
const router = express.Router();
const {
  getConversations,
  getMessages,
  sendMessage,
  startConversation,
} = require("../controllers/chatController");
const { authenticate } = require("../middleware/authMiddleware");

// All chat routes require authentication
router.use(authenticate);

// Get all conversations for the authenticated user
router.get("/conversations", getConversations);

// Get messages in a specific conversation
router.get("/conversations/:conversationId/messages", getMessages);

// Send a message
router.post("/messages", sendMessage);

// Start a new conversation
router.post("/conversations", startConversation);

module.exports = router;
