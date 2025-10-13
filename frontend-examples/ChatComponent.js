// ChatComponent.js - React Chat Component Example
import React, { useState, useEffect, useRef } from "react";
import useSocket from "./useSocket";
import axios from "axios";

const ChatComponent = ({ token, currentUser }) => {
  const {
    socket,
    isConnected,
    onlineUsers,
    messages,
    conversations,
    typingUsers,
    setMessages,
    setConversations,
    joinConversation,
    leaveConversation,
    sendMessage,
    startTyping,
    stopTyping,
    markMessagesRead,
  } = useSocket(token);

  const [activeConversation, setActiveConversation] = useState(null);
  const [messageInput, setMessageInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // API base URL
  const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

  // Fetch conversations on component mount
  useEffect(() => {
    fetchConversations();
  }, [token]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Join/leave conversation rooms
  useEffect(() => {
    if (activeConversation) {
      joinConversation(activeConversation._id);
      fetchMessages(activeConversation._id);

      return () => {
        leaveConversation(activeConversation._id);
      };
    }
  }, [activeConversation]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/chat/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setConversations(response.data.conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId) => {
    try {
      const response = await axios.get(
        `${API_BASE}/chat/conversations/${conversationId}/messages`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setMessages(response.data.messages);

      // Mark messages as read
      const unreadMessages = response.data.messages
        .filter((msg) => !msg.isRead && msg.receiver._id === currentUser.id)
        .map((msg) => msg._id);

      if (unreadMessages.length > 0) {
        markMessagesRead(conversationId, unreadMessages);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageInput.trim() || !activeConversation) return;

    const messageData = {
      receiverId: activeConversation.participant._id,
      receiverModel: activeConversation.participantModel,
      content: messageInput.trim(),
      messageType: "text",
      conversationId: activeConversation._id,
    };

    sendMessage(messageData);
    setMessageInput("");
    handleStopTyping();
  };

  const handleInputChange = (e) => {
    setMessageInput(e.target.value);
    handleStartTyping();
  };

  const handleStartTyping = () => {
    if (!isTyping && activeConversation) {
      setIsTyping(true);
      startTyping(activeConversation._id);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      handleStopTyping();
    }, 1000);
  };

  const handleStopTyping = () => {
    if (isTyping && activeConversation) {
      setIsTyping(false);
      stopTyping(activeConversation._id);
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const startNewConversation = async (userId, userModel) => {
    try {
      const response = await axios.post(
        `${API_BASE}/chat/conversations`,
        {
          userId,
          userModel,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const newConversation = response.data.conversation;
      setConversations((prev) => [newConversation, ...prev]);
      setActiveConversation(newConversation);
    } catch (error) {
      console.error("Error starting conversation:", error);
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isUserOnline = (userId) => {
    return onlineUsers.includes(userId);
  };

  if (loading) {
    return <div className="chat-loading">Loading chat...</div>;
  }

  return (
    <div className="chat-container">
      {/* Connection Status */}
      <div
        className={`connection-status ${
          isConnected ? "connected" : "disconnected"
        }`}
      >
        {isConnected ? "🟢 Connected" : "🔴 Disconnected"}
      </div>

      <div className="chat-layout">
        {/* Conversations Sidebar */}
        <div className="conversations-sidebar">
          <h3>Conversations</h3>
          <div className="conversations-list">
            {conversations.map((conversation) => (
              <div
                key={conversation._id}
                className={`conversation-item ${
                  activeConversation?._id === conversation._id ? "active" : ""
                }`}
                onClick={() => setActiveConversation(conversation)}
              >
                <div className="conversation-avatar">
                  <img
                    src={
                      conversation.participant.profileImage ||
                      "/default-avatar.png"
                    }
                    alt={conversation.participant.username}
                  />
                  {isUserOnline(conversation.participant._id) && (
                    <div className="online-indicator"></div>
                  )}
                </div>
                <div className="conversation-info">
                  <div className="conversation-name">
                    {conversation.participant.username ||
                      conversation.participant.firstName}
                  </div>
                  {conversation.lastMessage && (
                    <div className="last-message">
                      {conversation.lastMessage.content}
                    </div>
                  )}
                  {conversation.unreadCount > 0 && (
                    <div className="unread-badge">
                      {conversation.unreadCount}
                    </div>
                  )}
                </div>
                <div className="conversation-time">
                  {conversation.lastActivity &&
                    formatTime(conversation.lastActivity)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className="chat-area">
          {activeConversation ? (
            <>
              {/* Chat Header */}
              <div className="chat-header">
                <div className="chat-user-info">
                  <img
                    src={
                      activeConversation.participant.profileImage ||
                      "/default-avatar.png"
                    }
                    alt={activeConversation.participant.username}
                  />
                  <div>
                    <div className="chat-username">
                      {activeConversation.participant.username ||
                        activeConversation.participant.firstName}
                    </div>
                    <div className="chat-status">
                      {isUserOnline(activeConversation.participant._id)
                        ? "Online"
                        : "Offline"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Messages Area */}
              <div className="messages-container">
                {messages.map((message) => (
                  <div
                    key={message._id}
                    className={`message ${
                      message.sender._id === currentUser.id
                        ? "sent"
                        : "received"
                    }`}
                  >
                    <div className="message-content">
                      <div className="message-text">{message.content}</div>
                      <div className="message-meta">
                        <span className="message-time">
                          {formatTime(message.createdAt)}
                        </span>
                        {message.sender._id === currentUser.id && (
                          <span
                            className={`message-status ${
                              message.isRead ? "read" : "sent"
                            }`}
                          >
                            {message.isRead ? "✓✓" : "✓"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Typing Indicators */}
                {typingUsers[activeConversation._id] && (
                  <div className="typing-indicator">
                    {Object.values(typingUsers[activeConversation._id]).join(
                      ", "
                    )}{" "}
                    typing...
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <form className="message-input-form" onSubmit={handleSendMessage}>
                <input
                  type="text"
                  value={messageInput}
                  onChange={handleInputChange}
                  placeholder="Type a message..."
                  className="message-input"
                />
                <button
                  type="submit"
                  className="send-button"
                  disabled={!messageInput.trim()}
                >
                  Send
                </button>
              </form>
            </>
          ) : (
            <div className="no-conversation">
              <p>Select a conversation to start chatting</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatComponent;
