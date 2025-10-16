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
} = require("../controllers/postController");
const { authenticate, userOrAdmin } = require("../middleware/authMiddleware");
const {
  createPostValidation,
  postIdValidation,
  createPostWithMediaValidation,
} = require("../validators/postValidators");
const {
  uploadPostMedia,
  processPostMediaUpload,
  handleUploadError,
} = require("../utils/contentUpload");

// Protected routes (requires authentication)
router.get("/home", authenticate, getHomeFeed);
router.get("/my-posts", authenticate, getMyPosts);
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
router.get("/", getAllPosts); // Can be accessed by both authenticated and non-authenticated users
router.post("/:postId/like", authenticate, postIdValidation, togglePostLike);
router.delete("/:postId", authenticate, postIdValidation, deletePost);

module.exports = router;
