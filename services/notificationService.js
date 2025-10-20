const Notification = require("../models/notification_model");

class NotificationService {
  // Create a new message notification
  static async createMessageNotification(
    senderId,
    recipientId,
    conversationId
  ) {
    try {
      const User = require("../models/user_model");
      const sender = await User.findById(senderId).select(
        "username firstName lastName"
      );

      if (!sender) return null;

      return await Notification.createNotification({
        recipient: recipientId,
        sender: senderId,
        senderModel: "User",
        type: "message",
        title: "New Message",
        message: `${sender.firstName || sender.username} sent you a message`,
        data: {
          conversationId,
        },
        actionUrl: `/chat/conversations/${conversationId}`,
        priority: "normal",
      });
    } catch (error) {
      console.error("Error creating message notification:", error);
      return null;
    }
  }

  // Create a new subscription notification
  static async createSubscriptionNotification(
    subscriberId,
    creatorId,
    subscriptionId
  ) {
    try {
      const User = require("../models/user_model");
      const subscriber = await User.findById(subscriberId).select(
        "username firstName lastName"
      );

      if (!subscriber) return null;

      return await Notification.createNotification({
        recipient: creatorId,
        sender: subscriberId,
        senderModel: "User",
        type: "subscription",
        title: "New Subscriber!",
        message: `${
          subscriber.firstName || subscriber.username
        } subscribed to your content`,
        data: {
          subscriptionId,
        },
        actionUrl: `/profile/subscribers`,
        priority: "high",
      });
    } catch (error) {
      console.error("Error creating subscription notification:", error);
      return null;
    }
  }

  // Create a subscription expired notification
  static async createSubscriptionExpiredNotification(
    subscriberId,
    creatorId,
    subscriptionId
  ) {
    try {
      const User = require("../models/user_model");
      const creator = await User.findById(creatorId).select(
        "username firstName lastName"
      );

      if (!creator) return null;

      return await Notification.createNotification({
        recipient: subscriberId,
        sender: creatorId,
        senderModel: "User",
        type: "subscription_expired",
        title: "Subscription Expired",
        message: `Your subscription to ${
          creator.firstName || creator.username
        } has expired`,
        data: {
          subscriptionId,
        },
        actionUrl: `/profile/${creator.username}`,
        priority: "normal",
      });
    } catch (error) {
      console.error("Error creating subscription expired notification:", error);
      return null;
    }
  }

  // Create a post like notification
  static async createPostLikeNotification(likerId, postAuthorId, postId) {
    try {
      const User = require("../models/user_model");
      const liker = await User.findById(likerId).select(
        "username firstName lastName"
      );

      if (!liker || likerId.toString() === postAuthorId.toString()) return null;

      return await Notification.createNotification({
        recipient: postAuthorId,
        sender: likerId,
        senderModel: "User",
        type: "post_like",
        title: "Post Liked",
        message: `${liker.firstName || liker.username} liked your post`,
        data: {
          postId,
        },
        actionUrl: `/posts/${postId}`,
        priority: "low",
      });
    } catch (error) {
      console.error("Error creating post like notification:", error);
      return null;
    }
  }

  // Create a post comment notification
  static async createPostCommentNotification(
    commenterId,
    postAuthorId,
    postId,
    commentContent
  ) {
    try {
      const User = require("../models/user_model");
      const commenter = await User.findById(commenterId).select(
        "username firstName lastName"
      );

      if (!commenter || commenterId.toString() === postAuthorId.toString())
        return null;

      // Truncate comment content for notification
      const truncatedContent =
        commentContent.length > 50
          ? commentContent.substring(0, 50) + "..."
          : commentContent;

      return await Notification.createNotification({
        recipient: postAuthorId,
        sender: commenterId,
        senderModel: "User",
        type: "post_comment",
        title: "New Comment",
        message: `${
          commenter.firstName || commenter.username
        } commented: "${truncatedContent}"`,
        data: {
          postId,
          commentId: null, // Will be set by the caller if needed
        },
        actionUrl: `/posts/${postId}`,
        priority: "normal",
      });
    } catch (error) {
      console.error("Error creating post comment notification:", error);
      return null;
    }
  }

  // Create a content like notification
  static async createContentLikeNotification(
    likerId,
    contentAuthorId,
    contentId
  ) {
    try {
      const User = require("../models/user_model");
      const liker = await User.findById(likerId).select(
        "username firstName lastName"
      );

      if (!liker || likerId.toString() === contentAuthorId.toString())
        return null;

      return await Notification.createNotification({
        recipient: contentAuthorId,
        sender: likerId,
        senderModel: "User",
        type: "content_like",
        title: "Content Liked",
        message: `${liker.firstName || liker.username} liked your content`,
        data: {
          contentId,
        },
        actionUrl: `/content/${contentId}`,
        priority: "low",
      });
    } catch (error) {
      console.error("Error creating content like notification:", error);
      return null;
    }
  }

  // Create a new content notification for subscribers
  static async createNewContentNotification(creatorId, contentId) {
    try {
      const User = require("../models/user_model");
      const Subscription = require("../models/subscription_model");
      const Content = require("../models/content_model");

      const [creator, content, subscribers] = await Promise.all([
        User.findById(creatorId).select("username firstName lastName"),
        Content.findById(contentId).select("title"),
        Subscription.find({
          creator: creatorId,
          status: "active",
          endDate: { $gt: new Date() },
        }).select("subscriber"),
      ]);

      if (!creator || !content || !subscribers.length) return [];

      const notifications = await Promise.all(
        subscribers.map(async (subscription) => {
          return await Notification.createNotification({
            recipient: subscription.subscriber,
            sender: creatorId,
            senderModel: "User",
            type: "new_content",
            title: "New Content Available",
            message: `${
              creator.firstName || creator.username
            } posted new content: ${content.title}`,
            data: {
              contentId,
            },
            actionUrl: `/content/${contentId}`,
            priority: "normal",
          });
        })
      );

      return notifications.filter(Boolean);
    } catch (error) {
      console.error("Error creating new content notifications:", error);
      return [];
    }
  }

  // Create a payment received notification
  static async createPaymentReceivedNotification(
    creatorId,
    amount,
    subscriberId
  ) {
    try {
      const User = require("../models/user_model");
      const subscriber = await User.findById(subscriberId).select(
        "username firstName lastName"
      );

      if (!subscriber) return null;

      return await Notification.createNotification({
        recipient: creatorId,
        sender: subscriberId,
        senderModel: "User",
        type: "payment_received",
        title: "Payment Received",
        message: `You received $${amount.toFixed(2)} from ${
          subscriber.firstName || subscriber.username
        }`,
        data: {
          amount,
        },
        actionUrl: `/earnings`,
        priority: "high",
      });
    } catch (error) {
      console.error("Error creating payment received notification:", error);
      return null;
    }
  }

  // Create a system notification
  static async createSystemNotification(
    recipientId,
    title,
    message,
    actionUrl = null,
    priority = "normal"
  ) {
    try {
      return await Notification.createNotification({
        recipient: recipientId,
        sender: recipientId, // System notifications can have self as sender
        senderModel: "User",
        type: "system",
        title,
        message,
        actionUrl,
        priority,
      });
    } catch (error) {
      console.error("Error creating system notification:", error);
      return null;
    }
  }

  // Bulk create notifications
  static async createBulkNotifications(notifications) {
    try {
      const validNotifications = notifications.filter(
        (notification) =>
          notification.recipient &&
          notification.sender &&
          notification.type &&
          notification.title &&
          notification.message
      );

      if (validNotifications.length === 0) return [];

      return await Notification.insertMany(validNotifications);
    } catch (error) {
      console.error("Error creating bulk notifications:", error);
      return [];
    }
  }
}

module.exports = NotificationService;
