const Content = require("../models/content_model");
const User = require("../models/user_model");
const createError = require("http-errors");
const { validationResult } = require("express-validator");
const { generateSignedUrl } = require("../utils/contentUpload");

// Upload profile image and update user profile
const uploadProfileImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(createError(400, "No profile image uploaded"));
    }

    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return next(createError(404, "User not found"));
    }

    // The file has already been processed by the upload middleware
    // Update user's profile image URL
    user.profileImage = req.uploadResult.url;
    await user.save();

    res.json({
      success: true,
      message: "Profile image updated successfully",
      profileImage: user.profileImage,
      file: req.uploadResult,
    });
  } catch (error) {
    console.error("Upload profile image error:", error);
    next(error);
  }
};

// Create exclusive content with metadata
const createExclusiveContent = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, errors.array()[0].msg));
    }

    if (!req.file) {
      return next(createError(400, "No content file uploaded"));
    }

    const {
      title,
      description,
      price = 0,
      tags,
      isSubscriberOnly = true,
    } = req.body;
    const userId = req.user._id;

    // Parse tags if they come as a string
    let parsedTags = [];
    if (tags) {
      try {
        parsedTags = typeof tags === "string" ? JSON.parse(tags) : tags;
      } catch (e) {
        parsedTags =
          typeof tags === "string"
            ? tags.split(",").map((tag) => tag.trim())
            : tags;
      }
    }

    // Create content metadata
    const content = new Content({
      creator: userId,
      title,
      description,
      contentType: req.uploadResult.contentType,
      filename: req.uploadResult.filename,
      originalname: req.uploadResult.originalname,
      mimetype: req.uploadResult.mimetype,
      size: req.uploadResult.size,
      s3Key: req.uploadResult.key,
      price: parseFloat(price),
      tags: parsedTags,
      isSubscriberOnly:
        isSubscriberOnly === "true" || isSubscriberOnly === true,
    });

    await content.save();

    res.status(201).json({
      success: true,
      message: "Exclusive content uploaded successfully",
      content: {
        _id: content._id,
        title: content.title,
        description: content.description,
        contentType: content.contentType,
        filename: content.filename,
        price: content.price,
        tags: content.tags,
        isSubscriberOnly: content.isSubscriberOnly,
        createdAt: content.createdAt,
      },
    });
  } catch (error) {
    console.error("Create exclusive content error:", error);
    next(error);
  }
};

// Get user's own exclusive content
const getMyExclusiveContent = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const {
      page = 1,
      limit = 20,
      contentType,
      status = "published",
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const options = {
      status,
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
      sort: { [sortBy]: sortOrder === "desc" ? -1 : 1 },
    };

    if (contentType) {
      options.contentType = contentType;
    }

    const content = await Content.findByCreator(userId, options).select(
      "-s3Key"
    ); // Don't expose S3 key in the response

    const totalContent = await Content.countDocuments({
      creator: userId,
      status,
      ...(contentType && { contentType }),
    });

    res.json({
      success: true,
      content,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalContent,
        pages: Math.ceil(totalContent / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get my exclusive content error:", error);
    next(error);
  }
};

// Get exclusive content for viewing (with access control)
const getExclusiveContent = async (req, res, next) => {
  try {
    const { contentId } = req.params;
    const userId = req.user._id;

    const content = await Content.findById(contentId).populate(
      "creator",
      "username firstName lastName profileImage"
    );

    if (!content) {
      return next(createError(404, "Content not found"));
    }

    // Check access permissions
    const isOwner = content.creator._id.toString() === userId.toString();

    if (!isOwner) {
      // TODO: Implement subscription checks here
      // For now, only allow access to own content
      return next(createError(403, "Access denied. Subscription required."));
    }

    // Generate signed URL for accessing the content
    const signedUrl = await generateSignedUrl(content.s3Key, 3600);

    // Increment view count
    await content.incrementViews();

    res.json({
      success: true,
      content: {
        _id: content._id,
        title: content.title,
        description: content.description,
        contentType: content.contentType,
        price: content.price,
        tags: content.tags,
        views: content.views,
        likes: content.likes,
        creator: content.creator,
        createdAt: content.createdAt,
        accessUrl: signedUrl,
        expiresIn: 3600,
      },
    });
  } catch (error) {
    console.error("Get exclusive content error:", error);
    next(error);
  }
};

// Get content by creator (public preview)
const getContentByCreator = async (req, res, next) => {
  try {
    const { creatorId } = req.params;
    const { page = 1, limit = 20, contentType } = req.query;

    const creator = await User.findById(creatorId).select(
      "username firstName lastName profileImage bio subscriptionPrice"
    );
    if (!creator) {
      return next(createError(404, "Creator not found"));
    }

    const options = {
      status: "published",
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
      sort: { createdAt: -1 },
    };

    if (contentType) {
      options.contentType = contentType;
    }

    // Only return preview data, not access URLs
    const content = await Content.findByCreator(creatorId, options).select(
      "-s3Key -filename -originalname -mimetype -size"
    );

    const totalContent = await Content.countDocuments({
      creator: creatorId,
      status: "published",
      ...(contentType && { contentType }),
    });

    res.json({
      success: true,
      creator,
      content,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalContent,
        pages: Math.ceil(totalContent / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get content by creator error:", error);
    next(error);
  }
};

// Update exclusive content
const updateExclusiveContent = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, errors.array()[0].msg));
    }

    const { contentId } = req.params;
    const { title, description, price, tags, isSubscriberOnly, status } =
      req.body;
    const userId = req.user._id;

    const content = await Content.findById(contentId);

    if (!content) {
      return next(createError(404, "Content not found"));
    }

    // Check if user owns this content
    if (content.creator.toString() !== userId.toString()) {
      return next(createError(403, "Access denied"));
    }

    // Update fields
    if (title !== undefined) content.title = title;
    if (description !== undefined) content.description = description;
    if (price !== undefined) content.price = parseFloat(price);
    if (isSubscriberOnly !== undefined)
      content.isSubscriberOnly = isSubscriberOnly;
    if (status !== undefined) content.status = status;

    if (tags !== undefined) {
      try {
        content.tags = typeof tags === "string" ? JSON.parse(tags) : tags;
      } catch (e) {
        content.tags =
          typeof tags === "string"
            ? tags.split(",").map((tag) => tag.trim())
            : tags;
      }
    }

    await content.save();

    res.json({
      success: true,
      message: "Content updated successfully",
      content: {
        _id: content._id,
        title: content.title,
        description: content.description,
        price: content.price,
        tags: content.tags,
        isSubscriberOnly: content.isSubscriberOnly,
        status: content.status,
        updatedAt: content.updatedAt,
      },
    });
  } catch (error) {
    console.error("Update exclusive content error:", error);
    next(error);
  }
};

// Delete exclusive content
const deleteExclusiveContent = async (req, res, next) => {
  try {
    const { contentId } = req.params;
    const userId = req.user._id;

    const content = await Content.findById(contentId);

    if (!content) {
      return next(createError(404, "Content not found"));
    }

    // Check if user owns this content
    if (content.creator.toString() !== userId.toString()) {
      return next(createError(403, "Access denied"));
    }

    // TODO: Also delete from S3 bucket
    await Content.findByIdAndDelete(contentId);

    res.json({
      success: true,
      message: "Content deleted successfully",
    });
  } catch (error) {
    console.error("Delete exclusive content error:", error);
    next(error);
  }
};

// Like/unlike content
const toggleContentLike = async (req, res, next) => {
  try {
    const { contentId } = req.params;

    const content = await Content.findById(contentId);

    if (!content) {
      return next(createError(404, "Content not found"));
    }

    // TODO: Implement proper like/unlike logic with user tracking
    await content.incrementLikes();

    res.json({
      success: true,
      message: "Content liked",
      likes: content.likes,
    });
  } catch (error) {
    console.error("Toggle content like error:", error);
    next(error);
  }
};

module.exports = {
  uploadProfileImage,
  createExclusiveContent,
  getMyExclusiveContent,
  getExclusiveContent,
  getContentByCreator,
  updateExclusiveContent,
  deleteExclusiveContent,
  toggleContentLike,
};
