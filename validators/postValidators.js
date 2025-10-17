const { body, param, query } = require("express-validator");

const createPostValidation = [
  body("content")
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage("Content must be between 1 and 2000 characters"),

  body("images").optional().isArray().withMessage("Images must be an array"),

  body("images.*.url")
    .optional()
    .isURL()
    .withMessage("Image URL must be valid"),

  body("images.*.key")
    .optional()
    .notEmpty()
    .withMessage("Image key is required"),

  body("images.*.caption")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Image caption must be less than 500 characters"),

  body("videos").optional().isArray().withMessage("Videos must be an array"),

  body("videos.*.url")
    .optional()
    .isURL()
    .withMessage("Video URL must be valid"),

  body("videos.*.key")
    .optional()
    .notEmpty()
    .withMessage("Video key is required"),

  body("videos.*.caption")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Video caption must be less than 500 characters"),

  body("visibility")
    .optional()
    .isIn(["public", "subscribers", "private"])
    .withMessage("Visibility must be public, subscribers, or private"),

  body("tags").optional().isArray().withMessage("Tags must be an array"),

  body("tags.*")
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Each tag must be between 1 and 50 characters"),

  body("scheduledAt")
    .optional()
    .isISO8601()
    .withMessage("Scheduled date must be a valid ISO date"),
];

const postIdValidation = [
  param("postId").isMongoId().withMessage("Invalid post ID"),
];

const postQueryValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50"),

  query("visibility")
    .optional()
    .isIn(["public", "subscribers", "private"])
    .withMessage("Visibility must be public, subscribers, or private"),

  query("authorId")
    .optional()
    .isMongoId()
    .withMessage("Author ID must be a valid MongoDB ID"),
];

const createPostWithMediaValidation = [
  body("title")
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("Title must be between 1 and 200 characters"),

  body("description")
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage("Description must be between 1 and 2000 characters"),
];

module.exports = {
  createPostValidation,
  postIdValidation,
  postQueryValidation,
  createPostWithMediaValidation,
};
