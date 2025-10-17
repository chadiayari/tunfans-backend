# Notifications API Documentation

## Overview
The Notifications API provides a comprehensive system for managing user notifications in the TunFans platform. It supports various types of notifications like messages, subscriptions, likes, and system notifications.

## Endpoints

### 1. Get All Notifications
**GET** `/api/notifications`

Get all notifications for the authenticated user with filtering and pagination.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `type` (optional): Filter by notification type
- `isRead` (optional): Filter by read status (true/false)
- `priority` (optional): Filter by priority (low/normal/high/urgent)

**Response:**
```json
{
  "success": true,
  "notifications": [
    {
      "_id": "notification_id",
      "recipient": "user_id",
      "sender": {
        "_id": "sender_id",
        "username": "sender_username",
        "firstName": "John",
        "lastName": "Doe",
        "profileImage": "profile_url"
      },
      "type": "message",
      "title": "New Message",
      "message": "John sent you a message",
      "data": {
        "conversationId": "conversation_id"
      },
      "isRead": false,
      "actionUrl": "/chat/conversations/conversation_id",
      "priority": "normal",
      "createdAt": "2025-10-17T...",
      "updatedAt": "2025-10-17T..."
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  },
  "unreadCount": 12
}
```

### 2. Get Unread Count
**GET** `/api/notifications/unread-count`

Get the count of unread notifications for the authenticated user.

**Response:**
```json
{
  "success": true,
  "unreadCount": 12
}
```

### 3. Get Notification Statistics
**GET** `/api/notifications/stats`

Get notification statistics grouped by type.

**Response:**
```json
{
  "success": true,
  "stats": {
    "total": 45,
    "unread": 12,
    "byType": [
      {
        "_id": "message",
        "total": 20,
        "unread": 5
      },
      {
        "_id": "subscription",
        "total": 15,
        "unread": 3
      }
    ]
  }
}
```

### 4. Mark Notification as Read
**PUT** `/api/notifications/:notificationId/read`

Mark a specific notification as read.

**Response:**
```json
{
  "success": true,
  "message": "Notification marked as read",
  "notification": {
    "_id": "notification_id",
    "isRead": true,
    "readAt": "2025-10-17T..."
  }
}
```

### 5. Mark Multiple Notifications as Read
**PUT** `/api/notifications/read-multiple`

Mark multiple notifications as read.

**Request Body:**
```json
{
  "notificationIds": ["id1", "id2", "id3"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "3 notifications marked as read",
  "modifiedCount": 3
}
```

### 6. Mark All Notifications as Read
**PUT** `/api/notifications/read-all`

Mark all notifications as read for the authenticated user.

**Response:**
```json
{
  "success": true,
  "message": "12 notifications marked as read",
  "modifiedCount": 12
}
```

### 7. Delete Notification
**DELETE** `/api/notifications/:notificationId`

Delete a specific notification.

**Response:**
```json
{
  "success": true,
  "message": "Notification deleted successfully"
}
```

### 8. Delete Multiple Notifications
**DELETE** `/api/notifications/delete-multiple`

Delete multiple notifications.

**Request Body:**
```json
{
  "notificationIds": ["id1", "id2", "id3"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "3 notifications deleted",
  "deletedCount": 3
}
```

### 9. Create Notification (Admin Only)
**POST** `/api/notifications`

Create a new notification (admin only).

**Request Body:**
```json
{
  "recipient": "user_id",
  "type": "system",
  "title": "System Maintenance",
  "message": "Scheduled maintenance will occur tonight",
  "data": {
    "custom": {
      "maintenanceTime": "2025-10-18T02:00:00Z"
    }
  },
  "actionUrl": "/maintenance-info",
  "priority": "high"
}
```

## Notification Types

- `message`: New chat message
- `subscription`: New subscription
- `subscription_expired`: Subscription expired
- `post_like`: Post liked
- `content_like`: Content liked
- `new_content`: New content posted
- `new_post`: New post created
- `payment_received`: Payment received
- `payout_completed`: Payout completed
- `system`: System notification

## Priority Levels

- `low`: Low priority (likes, etc.)
- `normal`: Normal priority (messages, posts)
- `high`: High priority (subscriptions, payments)
- `urgent`: Urgent priority (system alerts)

## Frontend Integration Example

```javascript
// Fetch notifications
const fetchNotifications = async (page = 1, filters = {}) => {
  const params = new URLSearchParams({
    page,
    limit: 20,
    ...filters
  });
  
  const response = await fetch(`/api/notifications?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return await response.json();
};

// Mark notification as read when clicked
const markAsRead = async (notificationId) => {
  await fetch(`/api/notifications/${notificationId}/read`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
};

// Get unread count for badge
const getUnreadCount = async () => {
  const response = await fetch('/api/notifications/unread-count', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  return data.unreadCount;
};

// Mark all as read
const markAllAsRead = async () => {
  await fetch('/api/notifications/read-all', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
};
```

## Automatic Notification Creation

The system automatically creates notifications for:

1. **New Messages**: When a user receives a chat message
2. **New Subscriptions**: When someone subscribes to a creator
3. **Subscription Expiry**: When a subscription expires
4. **Likes**: When content or posts are liked
5. **New Content**: When a creator posts new content (notifies subscribers)
6. **Payments**: When payments are received

These are handled automatically by the `NotificationService` class.