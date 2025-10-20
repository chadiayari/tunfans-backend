const Content = require("../models/content_model");
const createError = require("http-errors");
const { validationResult } = require("express-validator");
const NotificationService = require("../services/notificationService");

// Create content (unified function)
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

    // Create content record - all content is subscription-only by default
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
        mimetype: content.mimetype,
        creator: content.creator,
        createdAt: content.createdAt,
      },
    });
  } catch (error) {
    console.error("Create content error:", error);
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
    const { title, description, status } = req.body;
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
    if (status !== undefined) content.status = status;

    await content.save();

    res.json({
      success: true,
      message: "Content updated successfully",
      content: {
        _id: content._id,
        title: content.title,
        description: content.description,
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

module.exports = {
  createContent,
  updateExclusiveContent,
  deleteExclusiveContent,
};
