const Post = require("../models/post_model");
const User = require("../models/user_model");
const createError = require("http-errors");
const { validationResult } = require("express-validator");

// Get current user's posts
const getMyPosts = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10, visibility, isExclusive } = req.query;

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

    if (isExclusive !== undefined) {
      query.isExclusive = isExclusive === "true";
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
      isExclusive: post.isExclusive,
      visibility: post.visibility,
      tags: post.tags,
      likeCount: post.likes?.length || 0,
      commentCount: post.comments?.filter((c) => !c.isDeleted).length || 0,
      viewCount: post.viewCount,
      shareCount: post.shareCount,
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
      isExclusive = false,
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
      isExclusive,
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
        isExclusive: post.isExclusive,
        visibility: post.visibility,
        tags: post.tags,
        likeCount: 0,
        commentCount: 0,
        viewCount: 0,
        shareCount: 0,
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

// Get all posts (feed)
const getAllPosts = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, authorId, visibility = "public" } = req.query;
    const userId = req.user?._id;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query = {
      isActive: true,
      publishedAt: { $lte: new Date() }, // Only published posts
    };

    // Add author filter if provided
    if (authorId) {
      query.author = authorId;
    }

    // Add visibility filter
    if (visibility === "public") {
      query.visibility = "public";
    } else if (visibility === "subscribers" && userId) {
      // TODO: Check if user is subscribed to the author
      query.$or = [
        { visibility: "public" },
        { visibility: "subscribers", author: userId }, // Own posts
      ];
    }

    // Get total count for pagination
    const totalCount = await Post.countDocuments(query);

    // Get posts with author info
    const posts = await Post.find(query)
      .populate("author", "username firstName lastName profileImage")
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Check if current user liked each post
    const formattedPosts = posts.map((post) => {
      const userLiked =
        userId &&
        post.likes?.some((like) => like.user.toString() === userId.toString());

      return {
        _id: post._id,
        content: post.content,
        images: post.images,
        videos: post.videos,
        isExclusive: post.isExclusive,
        visibility: post.visibility,
        tags: post.tags,
        likeCount: post.likes?.length || 0,
        commentCount: post.comments?.filter((c) => !c.isDeleted).length || 0,
        viewCount: post.viewCount,
        shareCount: post.shareCount,
        userLiked,
        author: post.author,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        publishedAt: post.publishedAt,
      };
    });

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
    console.error("Get all posts error:", error);
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

module.exports = {
  getMyPosts,
  createPost,
  getAllPosts,
  togglePostLike,
  deletePost,
};
