// useSocket.js - React Hook for Socket.IO
import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const useSocket = (token) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});

  const socketRef = useRef(null);

  useEffect(() => {
    if (!token) return;

    // Initialize socket connection
    const newSocket = io(
      process.env.REACT_APP_SERVER_URL || "http://localhost:5000",
      {
        auth: {
          token: token,
        },
        transports: ["websocket", "polling"],
      }
    );

    socketRef.current = newSocket;
    setSocket(newSocket);

    // Connection event handlers
    newSocket.on("connect", () => {
      console.log("Connected to server");
      setIsConnected(true);
    });

    newSocket.on("disconnect", () => {
      console.log("Disconnected from server");
      setIsConnected(false);
    });

    newSocket.on("connect_error", (error) => {
      console.error("Connection error:", error);
      setIsConnected(false);
    });

    // Message event handlers
    newSocket.on("new_message", (data) => {
      console.log("New message received:", data);
      setMessages((prev) => [...prev, data.message]);
      // Update conversations list with new message
      updateConversationWithMessage(data.message, data.conversationId);
    });

    newSocket.on("message_sent", (data) => {
      console.log("Message sent successfully:", data);
      // Message already added optimistically, just confirm
    });

    newSocket.on("message_notification", (data) => {
      console.log("Message notification:", data);
      // Show notification for new message
      showNotification(data);
    });

    newSocket.on("messages_read", (data) => {
      console.log("Messages marked as read:", data);
      // Update message read status
      updateMessageReadStatus(data.messageIds, data.readBy, data.readAt);
    });

    // User status handlers
    newSocket.on("user_status_change", (data) => {
      console.log("User status changed:", data);
      updateUserOnlineStatus(data.userId, data.status);
    });

    // Typing indicators
    newSocket.on("user_typing", (data) => {
      setTypingUsers((prev) => ({
        ...prev,
        [data.conversationId]: {
          ...prev[data.conversationId],
          [data.userId]: data.username,
        },
      }));
    });

    newSocket.on("user_stopped_typing", (data) => {
      setTypingUsers((prev) => {
        const updated = { ...prev };
        if (updated[data.conversationId]) {
          delete updated[data.conversationId][data.userId];
          if (Object.keys(updated[data.conversationId]).length === 0) {
            delete updated[data.conversationId];
          }
        }
        return updated;
      });
    });

    // System messages
    newSocket.on("system_message", (data) => {
      console.log("System message:", data);
      // Handle system messages (user joined, left, etc.)
    });

    // Error handlers
    newSocket.on("message_error", (data) => {
      console.error("Message error:", data);
      // Handle message sending errors
    });

    return () => {
      newSocket.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [token]);

  // Helper functions
  const updateConversationWithMessage = (message, conversationId) => {
    setConversations((prev) =>
      prev.map((conv) =>
        conv._id === conversationId
          ? { ...conv, lastMessage: message, lastActivity: message.createdAt }
          : conv
      )
    );
  };

  const updateMessageReadStatus = (messageIds, readBy, readAt) => {
    setMessages((prev) =>
      prev.map((msg) =>
        messageIds.includes(msg._id) ? { ...msg, isRead: true, readAt } : msg
      )
    );
  };

  const updateUserOnlineStatus = (userId, status) => {
    if (status === "online") {
      setOnlineUsers((prev) => [...new Set([...prev, userId])]);
    } else {
      setOnlineUsers((prev) => prev.filter((id) => id !== userId));
    }
  };

  const showNotification = (data) => {
    // Implement your notification logic here
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(`New message from ${data.sender.username}`, {
        body: data.message.content,
        icon: data.sender.profileImage || "/default-avatar.png",
      });
    }
  };

  // Socket methods
  const joinConversation = (conversationId) => {
    if (socket) {
      socket.emit("join_conversation", conversationId);
    }
  };

  const leaveConversation = (conversationId) => {
    if (socket) {
      socket.emit("leave_conversation", conversationId);
    }
  };

  const sendMessage = (messageData) => {
    if (socket) {
      // Add message optimistically
      const optimisticMessage = {
        ...messageData,
        _id: `temp_${Date.now()}`,
        createdAt: new Date(),
        isRead: false,
        sender: {
          /* current user data */
        },
      };
      setMessages((prev) => [...prev, optimisticMessage]);

      socket.emit("send_message", messageData);
    }
  };

  const startTyping = (conversationId) => {
    if (socket) {
      socket.emit("typing_start", { conversationId });
    }
  };

  const stopTyping = (conversationId) => {
    if (socket) {
      socket.emit("typing_stop", { conversationId });
    }
  };

  const markMessagesRead = (conversationId, messageIds) => {
    if (socket) {
      socket.emit("mark_messages_read", { conversationId, messageIds });
    }
  };

  return {
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
  };
};

export default useSocket;
