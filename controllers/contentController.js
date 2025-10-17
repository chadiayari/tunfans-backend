const Content = require("../models/content_model");
const User = require("../models/user_model");
const Subscription = require("../models/subscription_model");
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

// Create exclusive content (unified function)
const createContent = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, errors.array()[0].msg));
    }

    if (!req.file) {
      return next(createError(400, "No content file uploaded"));
    }

    const { title, description } = req.body;
    const userId = req.user._id;

    // Create content record
    const content = new Content({
      creator: userId,
      title,
      description,
      filename: req.uploadResult.filename,
      originalname: req.uploadResult.originalname,
      mimetype: req.uploadResult.mimetype,
      size: req.uploadResult.size,
      s3Key: req.uploadResult.key,
    });

    await content.save();
    await content.populate(
      "creator",
      "username firstName lastName profileImage"
    );

    res.status(201).json({
      success: true,
      message: "Content uploaded successfully",
      content: {
        _id: content._id,
        title: content.title,
        description: content.description,
        filename: content.filename,
        originalname: content.originalname,
        mimetype: content.mimetype,
        size: content.size,
        creator: content.creator,
        createdAt: content.createdAt,
        updatedAt: content.updatedAt,
      },
    });
  } catch (error) {
    console.error("Create content error:", error);
    next(error);
  }
};

// Get user's content with pagination
const getUserContent = async (req, res, next) => {
  try {
    const { username } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const requestingUserId = req.user._id;

    // Find user by username
    const User = require("../models/user_model");
    const user = await User.findOne({ username, isActive: true }).select("_id");

    if (!user) {
      return next(createError(404, "User not found"));
    }

    const userId = user._id;

    // Check if requesting user has subscription to view content
    let hasAccess = userId.toString() === requestingUserId.toString();

    if (!hasAccess) {
      const Subscription = require("../models/subscription_model");
      const subscription = await Subscription.findOne({
        subscriber: requestingUserId,
        creator: userId,
        status: "active",
      });
      hasAccess = !!subscription;
    }

    const skip = (page - 1) * limit;

    const content = await Content.find({ creator: userId })
      .select(
        hasAccess
          ? "title description filename price tags isSubscriberOnly createdAt s3Key"
          : "title description price tags isSubscriberOnly createdAt"
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("creator", "username profileImage");

    const total = await Content.countDocuments({ creator: userId });

    // Generate signed URLs for accessible content
    const contentWithUrls = await Promise.all(
      content.map(async (item) => {
        const contentObj = item.toObject();

        if (hasAccess && contentObj.s3Key) {
          contentObj.accessUrl = await generateSignedUrl(contentObj.s3Key);
        }

        // Remove s3Key from response for security
        delete contentObj.s3Key;

        return contentObj;
      })
    );

    res.json({
      success: true,
      content: contentWithUrls,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
      hasAccess,
    });
  } catch (error) {
    console.error("Get user content error:", error);
    next(error);
  }
};

// Get user's own content
const getMyContent = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const userId = req.user._id;

    const skip = (page - 1) * limit;

    const content = await Content.find({ creator: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Content.countDocuments({ creator: userId });

    // Generate signed URLs for all content (user can access their own content)
    const contentWithUrls = await Promise.all(
      content.map(async (item) => {
        const contentObj = item.toObject();

        if (contentObj.s3Key) {
          contentObj.accessUrl = await generateSignedUrl(contentObj.s3Key);
        }

        // Remove s3Key from response for security
        delete contentObj.s3Key;

        return contentObj;
      })
    );

    res.json({
      success: true,
      content: contentWithUrls,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get my content error:", error);
    next(error);
  }
};

// Get content by creator (public preview)
const getContentByCreator = async (req, res, next) => {
  try {
    const { creatorId } = req.params;
    const { page = 1, limit = 20 } = req.query;

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

    // Only return preview data, not access URLs
    const content = await Content.findByCreator(creatorId, options).select(
      "-s3Key -filename -originalname -mimetype -size"
    );

    const totalContent = await Content.countDocuments({
      creator: creatorId,
      status: "published",
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
  createContent,
  getMyContent,
  getUserContent,
  getContentByCreator,
  updateExclusiveContent,
  deleteExclusiveContent,
  toggleContentLike,
};
