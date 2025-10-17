const express = require("express");
const router = express.Router();
const {
  getMyPosts,
  createPost,
  getAllPosts,
  togglePostLike,
  deletePost,
  createPostWithMedia,
  getHomeFeed,
  getPostsByUsername,
  addComment,
  getPostComments,
  deleteComment,
} = require("../controllers/postController");
const { authenticate, userOrAdmin } = require("../middleware/authMiddleware");
const {
  createPostValidation,
  postIdValidation,
  createPostWithMediaValidation,
  addCommentValidation,
  commentIdValidation,
  getCommentsValidation,
} = require("../validators/postValidators");
const {
  uploadPostMedia,
  processPostMediaUpload,
  handleUploadError,
} = require("../utils/contentUpload");

// Protected routes (requires authentication)
router.get("/home", authenticate, getHomeFeed);
router.get("/my-posts", authenticate, getMyPosts);
router.get("/user-posts/:username", getPostsByUsername); // Get posts by username (public)
router.post("/", authenticate, createPostValidation, createPost);
router.post(
  "/exclusive-content",
  authenticate,
  uploadPostMedia,
  handleUploadError,
  createPostWithMediaValidation,
  processPostMediaUpload,
  createPostWithMedia
);
router.post("/:postId/like", authenticate, postIdValidation, togglePostLike);
router.delete("/:postId", authenticate, postIdValidation, deletePost);

// Comment routes
router.post(
  "/:postId/comments",
  authenticate,
  addCommentValidation,
  addComment
);
router.get("/:postId/comments", getCommentsValidation, getPostComments);
router.delete(
  "/:postId/comments/:commentId",
  authenticate,
  commentIdValidation,
  deleteComment
);

module.exports = router;
