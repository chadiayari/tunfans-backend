const Post = require("../models/post_model");
const User = require("../models/user_model");
const Subscription = require("../models/subscription_model");
const createError = require("http-errors");
const { validationResult } = require("express-validator");

// Helper function to get real-time subscriber count
const getSubscriberCount = async (userId) => {
  try {
    const count = await Subscription.countDocuments({
      creator: userId,
      status: "active",
      endDate: { $gt: new Date() }, // Not expired
    });
    return count;
  } catch (error) {
    console.error("Error getting subscriber count:", error);
    return 0;
  }
};

// Get current user's posts
const getMyPosts = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10, visibility } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query = {
      author: userId,
      isActive: true,
    };

    // Add filters if provided
    if (
      visibility &&
      ["public", "subscribers", "private"].includes(visibility)
    ) {
      query.visibility = visibility;
    }

    // Get total count for pagination
    const totalCount = await Post.countDocuments(query);

    // Get posts with author info
    const posts = await Post.find(query)
      .populate("author", "username firstName lastName profileImage")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Format posts for response
    const formattedPosts = posts.map((post) => ({
      _id: post._id,
      content: post.content,
      images: post.images,
      videos: post.videos,
      visibility: post.visibility,
      tags: post.tags,
      likeCount: post.likes?.length || 0,
      commentCount: post.comments?.filter((c) => !c.isDeleted).length || 0,
      author: post.author,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      publishedAt: post.publishedAt,
      scheduledAt: post.scheduledAt,
    }));

    const totalPages = Math.ceil(totalCount / limitNum);

    res.json({
      success: true,
      posts: formattedPosts,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        limit: limitNum,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("Get my posts error:", error);
    next(error);
  }
};

// Create a new post
const createPost = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, errors.array()[0].msg));
    }

    const {
      content,
      images = [],
      videos = [],
      visibility = "public",
      tags = [],
      scheduledAt = null,
    } = req.body;

    const userId = req.user._id;

    // Create new post
    const post = new Post({
      author: userId,
      content,
      images,
      videos,
      visibility,
      tags: tags.map((tag) => tag.toLowerCase().trim()),
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      publishedAt: scheduledAt ? null : new Date(),
    });

    await post.save();
    await post.populate("author", "username firstName lastName profileImage");

    res.status(201).json({
      success: true,
      message: "Post created successfully",
      post: {
        _id: post._id,
        content: post.content,
        images: post.images,
        videos: post.videos,
        visibility: post.visibility,
        tags: post.tags,
        likeCount: 0,
        commentCount: 0,
        author: post.author,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        publishedAt: post.publishedAt,
        scheduledAt: post.scheduledAt,
      },
    });
  } catch (error) {
    console.error("Create post error:", error);
    next(error);
  }
};

// Toggle post like
const togglePostLike = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const userId = req.user._id;

    const post = await Post.findById(postId);
    if (!post) {
      return next(createError(404, "Post not found"));
    }

    // Check if user already liked the post
    const existingLikeIndex = post.likes.findIndex(
      (like) => like.user.toString() === userId.toString()
    );

    let isLiked;
    if (existingLikeIndex > -1) {
      // Unlike the post
      post.likes.splice(existingLikeIndex, 1);
      isLiked = false;
    } else {
      // Like the post
      post.likes.push({ user: userId });
      isLiked = true;
    }

    await post.save();

    res.json({
      success: true,
      isLiked,
      likeCount: post.likes.length,
    });
  } catch (error) {
    console.error("Toggle post like error:", error);
    next(error);
  }
};

// Delete a post
const deletePost = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const userId = req.user._id;

    const post = await Post.findOne({
      _id: postId,
      author: userId,
    });

    if (!post) {
      return next(
        createError(404, "Post not found or you're not authorized to delete it")
      );
    }

    // Soft delete
    post.isActive = false;
    await post.save();

    res.json({
      success: true,
      message: "Post deleted successfully",
    });
  } catch (error) {
    console.error("Delete post error:", error);
    next(error);
  }
};

// Create post with media upload
const createPostWithMedia = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, errors.array()[0].msg));
    }

    const { title, description } = req.body;
    const userId = req.user._id;

    // Check if media was uploaded through the middleware
    if (!req.uploadResult) {
      return next(createError(400, "Media upload is required"));
    }

    const { url, key, mimetype } = req.uploadResult;

    // Determine if it's an image or video
    const isImage = mimetype.startsWith("image/");
    const isVideo = mimetype.startsWith("video/");

    let images = [];
    let videos = [];

    if (isImage) {
      images = [
        {
          url,
          key,
          caption: description,
        },
      ];
    } else if (isVideo) {
      videos = [
        {
          url,
          key,
          caption: description,
          // You can add thumbnail generation logic here if needed
        },
      ];
    }

    // Create new post
    const post = new Post({
      author: userId,
      content: description, // Use description as content
      title, // Add title field to post model if needed
      images,
      videos,
      visibility: "subscribers", // Only subscribers can see exclusive content
      publishedAt: new Date(),
    });

    await post.save();
    await post.populate("author", "username firstName lastName profileImage");

    res.status(201).json({
      success: true,
      message: "Exclusive post created successfully",
      post: {
        _id: post._id,
        title: title,
        content: post.content,
        images: post.images,
        videos: post.videos,
        visibility: post.visibility,
        likeCount: 0,
        commentCount: 0,
        author: post.author,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        publishedAt: post.publishedAt,
      },
    });
  } catch (error) {
    console.error("Create post with media error:", error);
    next(error);
  }
};

// Get home page feed - posts from subscribed creators
const getHomeFeed = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get all active subscriptions for the current user
    const subscriptions = await Subscription.find({
      subscriber: userId,
      status: "active",
      endDate: { $gt: new Date() }, // Not expired
    }).select("creator");

    // Extract creator IDs
    const creatorIds = subscriptions.map((sub) => sub.creator);

    // Add the current user's own ID to see their own posts
    const allAuthorIds = [...creatorIds, userId];

    // If no subscriptions, still show user's own posts
    if (creatorIds.length === 0) {
      // Get user's own posts
      const userPosts = await Post.find({
        author: userId,
        isActive: true,
        publishedAt: { $lte: new Date() },
      })
        .populate(
          "author",
          "username firstName lastName profileImage subscriptionPrice"
        )
        .sort({ publishedAt: -1 })
        .limit(limitNum)
        .lean();

      // Get some popular public posts as suggestions (excluding user's own)
      const suggestedPosts = await Post.find({
        author: { $ne: userId }, // Exclude user's own posts
        isActive: true,
        visibility: "public",
        publishedAt: { $lte: new Date() },
      })
        .populate(
          "author",
          "username firstName lastName profileImage subscriptionPrice"
        )
        .sort({ likeCount: -1, createdAt: -1 })
        .limit(Math.max(0, limitNum - userPosts.length)) // Fill remaining slots with suggestions
        .lean();

      // Combine user posts and suggestions
      const allPosts = [...userPosts, ...suggestedPosts];

      const formattedPosts = await Promise.all(
        allPosts.map(async (post) => {
          const isLiked = post.likes?.some(
            (like) => like.user.toString() === userId.toString()
          );
          const subscriberCount = await getSubscriberCount(post.author._id);
          const isOwnPost = post.author._id.toString() === userId.toString();

          return {
            _id: post._id,
            title: post.title,
            content: post.content,
            images: post.images,
            videos: post.videos,
            visibility: post.visibility,
            tags: post.tags,
            likeCount: post.likes?.length || 0,
            commentCount:
              post.comments?.filter((c) => !c.isDeleted).length || 0,
            isLiked,
            author: {
              ...post.author,
              subscriberCount,
            },
            createdAt: post.createdAt,
            updatedAt: post.updatedAt,
            publishedAt: post.publishedAt,
            isOwnPost,
          };
        })
      );

      return res.json({
        success: true,
        message:
          userPosts.length > 0
            ? "Showing your posts and suggested creators."
            : "No posts yet. Here are some suggested creators.",
        posts: formattedPosts,
        pagination: {
          currentPage: pageNum,
          totalPages: 1,
          totalCount: allPosts.length,
          limit: limitNum,
          hasNext: false,
          hasPrev: false,
        },
        hasSubscriptions: false,
        userPostsCount: userPosts.length,
      });
    }

    // Build query for posts from subscribed creators AND user's own posts
    const query = {
      author: { $in: allAuthorIds },
      isActive: true,
      publishedAt: { $lte: new Date() }, // Only published posts
      $or: [
        { visibility: "public" },
        { visibility: "subscribers" }, // User is subscribed, so can see subscriber-only content
        { author: userId }, // User can always see their own posts regardless of visibility
      ],
    };

    // Get total count for pagination
    const totalCount = await Post.countDocuments(query);

    // Get posts with author info
    const posts = await Post.find(query)
      .populate(
        "author",
        "username firstName lastName profileImage subscriptionPrice"
      )
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Check if current user liked each post and format response
    const formattedPosts = await Promise.all(
      posts.map(async (post) => {
        const isLiked = post.likes?.some(
          (like) => like.user.toString() === userId.toString()
        );
        const subscriberCount = await getSubscriberCount(post.author._id);
        const isOwnPost = post.author._id.toString() === userId.toString();

        return {
          _id: post._id,
          title: post.title,
          content: post.content,
          images: post.images,
          videos: post.videos,
          visibility: post.visibility,
          tags: post.tags,
          likeCount: post.likes?.length || 0,
          commentCount: post.comments?.filter((c) => !c.isDeleted).length || 0,
          isLiked,
          author: {
            ...post.author,
            subscriberCount,
          },
          createdAt: post.createdAt,
          updatedAt: post.updatedAt,
          publishedAt: post.publishedAt,
          isOwnPost,
        };
      })
    );

    const totalPages = Math.ceil(totalCount / limitNum);

    res.json({
      success: true,
      posts: formattedPosts,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        limit: limitNum,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
      hasSubscriptions: true,
      subscriptionCount: creatorIds.length,
    });
  } catch (error) {
    console.error("Get home feed error:", error);
    next(error);
  }
};

// Get posts by username
const getPostsByUsername = async (req, res, next) => {
  try {
    const { username } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const requestingUserId = req.user ? req.user._id : null;

    // Find user by username
    const user = await User.findOne({ username, isActive: true }).select(
      "_id username firstName lastName profileImage bio subscriptionPrice"
    );

    if (!user) {
      return next(createError(404, "User not found"));
    }

    const userId = user._id;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get posts by this user
    const posts = await Post.find({
      author: userId,
      isActive: true,
      publishedAt: { $lte: new Date() },
    })
      .populate(
        "author",
        "username firstName lastName profileImage subscriptionPrice"
      )
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const totalPosts = await Post.countDocuments({
      author: userId,
      isActive: true,
      publishedAt: { $lte: new Date() },
    });

    // Get subscriber count for the user
    const subscriberCount = await getSubscriberCount(userId);

    // Format posts with like status for requesting user
    const formattedPosts = await Promise.all(
      posts.map(async (post) => {
        const isLiked = requestingUserId
          ? post.likes?.some(
              (like) => like.user.toString() === requestingUserId.toString()
            )
          : false;

        return {
          _id: post._id,
          title: post.title,
          content: post.content,
          images: post.images,
          videos: post.videos,
          visibility: post.visibility,
          tags: post.tags,
          likeCount: post.likes?.length || 0,
          commentCount: post.comments?.filter((c) => !c.isDeleted).length || 0,
          isLiked,
          author: {
            ...post.author,
            subscriberCount,
          },
          createdAt: post.createdAt,
          updatedAt: post.updatedAt,
          publishedAt: post.publishedAt,
        };
      })
    );

    res.json({
      success: true,
      user: {
        ...user.toObject(),
        subscriberCount,
      },
      posts: formattedPosts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalPosts,
        pages: Math.ceil(totalPosts / limitNum),
      },
    });
  } catch (error) {
    console.error("Get posts by username error:", error);
    next(error);
  }
};

module.exports = {
  getMyPosts,
  createPost,
  togglePostLike,
  deletePost,
  createPostWithMedia,
  getHomeFeed,
  getPostsByUsername,
};
