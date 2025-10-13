const express = require("express");
const router = express.Router();
const {
  getMyPosts,
  createPost,
  getAllPosts,
  togglePostLike,
  deletePost,
} = require("../controllers/postController");
const { authenticate, userOrAdmin } = require("../middleware/authMiddleware");
const {
  createPostValidation,
  postIdValidation,
} = require("../validators/postValidators");

// Protected routes (requires authentication)
router.get("/my-posts", authenticate, getMyPosts);
router.post("/", authenticate, createPostValidation, createPost);
router.get("/", getAllPosts); // Can be accessed by both authenticated and non-authenticated users
router.post("/:postId/like", authenticate, postIdValidation, togglePostLike);
router.delete("/:postId", authenticate, postIdValidation, deletePost);

module.exports = router;
