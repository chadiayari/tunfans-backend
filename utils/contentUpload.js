const multer = require("multer");
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const crypto = require("crypto");
const path = require("path");
const { fromEnv } = require("@aws-sdk/credential-providers");

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: fromEnv(),
});

const memoryStorage = multer.memoryStorage();

// Generate unique filename
const generateUniqueFilename = (originalname) => {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(6).toString("hex");
  const ext = path.extname(originalname);
  const nameWithoutExt = path.basename(originalname, ext);
  const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, "_");
  return `${sanitizedName}_${timestamp}_${randomString}${ext}`;
};

// Profile image file filter (only images, smaller size limit)
const profileImageFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Only JPEG, PNG, and WebP images are allowed for profile pictures!"
      ),
      false
    );
  }
};

// Exclusive content file filter (images and videos, larger size limit)
const exclusiveContentFilter = (req, file, cb) => {
  const allowedTypes = [
    // Images
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
    // Videos
    "video/mp4",
    "video/mpeg",
    "video/quicktime",
    "video/x-msvideo",
    "video/webm",
    "video/mov",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Only images (JPEG, PNG, WebP, GIF) and videos (MP4, MPEG, MOV, WebM) are allowed!"
      ),
      false
    );
  }
};

// Profile image upload configuration (smaller size limit)
const profileImageUpload = multer({
  storage: memoryStorage,
  fileFilter: profileImageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for profile images
  },
});

// Exclusive content upload configuration (larger size limit)
const exclusiveContentUpload = multer({
  storage: memoryStorage,
  fileFilter: exclusiveContentFilter,
  limits: {
    fileSize: 24 * 1024 * 1024, // 24MB limit for exclusive content
  },
});

// Upload buffer to S3 with public or private access
const uploadToS3 = async (
  buffer,
  filename,
  mimetype,
  folder,
  isPublic = true
) => {
  const sanitizedFolder = folder.replace(/[^a-zA-Z0-9_-]/g, "_");
  const key = `${sanitizedFolder}/${filename}`;

  if (!Buffer.isBuffer(buffer)) {
    throw new Error("Input must be a Buffer");
  }

  if (buffer.length === 0) {
    throw new Error("Cannot upload empty file");
  }

  try {
    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
    };

    // Set ACL based on public/private access
    if (isPublic) {
      params.ACL = "public-read";
    }

    const command = new PutObjectCommand(params);
    await s3Client.send(command);

    let url;
    if (isPublic) {
      // Public URL
      url = `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    } else {
      // For private content, we'll generate signed URLs when needed
      url = key; // Store the key, not the URL
    }

    return {
      key,
      url,
      isPublic,
    };
  } catch (error) {
    console.error("S3 upload error:", error);
    throw error;
  }
};

// Generate signed URL for private content access
const generateSignedUrl = async (key, expiresIn = 3600) => {
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
    });

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn, // URL expires in 1 hour by default
    });

    return signedUrl;
  } catch (error) {
    console.error("Error generating signed URL:", error);
    throw error;
  }
};

// Process profile image upload middleware
const processProfileImageUpload = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No profile image uploaded",
      });
    }

    const uniqueFilename = generateUniqueFilename(req.file.originalname);
    const userId = req.user._id;

    // Upload to public profile-images folder
    const result = await uploadToS3(
      req.file.buffer,
      uniqueFilename,
      req.file.mimetype,
      `profile-images/${userId}`,
      true // Public access
    );

    // Store result in request for next middleware
    req.uploadResult = {
      filename: uniqueFilename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      url: result.url,
      key: result.key,
    };

    next();
  } catch (error) {
    console.error("Error processing profile image upload:", error);
    res.status(500).json({
      success: false,
      message: "Error uploading profile image",
      error: error.message,
    });
  }
};

// Process cover image upload middleware
const processCoverImageUpload = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No cover image uploaded",
      });
    }

    const uniqueFilename = generateUniqueFilename(req.file.originalname);
    const userId = req.user._id;

    // Upload to public cover-images folder
    const result = await uploadToS3(
      req.file.buffer,
      uniqueFilename,
      req.file.mimetype,
      `cover-images/${userId}`,
      true // Public access
    );

    // Store result in request for next middleware
    req.uploadResult = {
      filename: uniqueFilename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      url: result.url,
      key: result.key,
    };

    next();
  } catch (error) {
    console.error("Error processing cover image upload:", error);
    res.status(500).json({
      success: false,
      message: "Error uploading cover image",
      error: error.message,
    });
  }
};

// Process exclusive content upload middleware
const processExclusiveContentUpload = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No exclusive content uploaded",
      });
    }

    const uniqueFilename = generateUniqueFilename(req.file.originalname);
    const userId = req.user._id;
    const contentType = req.file.mimetype.startsWith("image/")
      ? "image"
      : "video";

    // Upload to private exclusive-content folder
    const result = await uploadToS3(
      req.file.buffer,
      uniqueFilename,
      req.file.mimetype,
      `exclusive-content/${userId}/${contentType}s`,
      false // Private access
    );

    // Store result in request for next middleware
    req.uploadResult = {
      filename: uniqueFilename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      key: result.key,
      contentType,
      isPrivate: true,
    };

    next();
  } catch (error) {
    console.error("Error processing exclusive content upload:", error);
    res.status(500).json({
      success: false,
      message: "Error uploading exclusive content",
      error: error.message,
    });
  }
};

// Process post media upload (for creating posts with media)
const processPostMediaUpload = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No media uploaded",
      });
    }

    const uniqueFilename = generateUniqueFilename(req.file.originalname);
    const userId = req.user._id;

    // Determine content type
    const contentType = req.file.mimetype.startsWith("video/")
      ? "video"
      : "image";

    // Upload to private exclusive content folder
    const result = await uploadToS3(
      req.file.buffer,
      uniqueFilename,
      req.file.mimetype,
      `exclusive-content/${userId}/${contentType}s`,
      false // Private access for exclusive content
    );

    // Store result in request for next middleware
    req.uploadResult = {
      filename: uniqueFilename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      url: result.url,
      key: result.key,
      contentType,
      isPrivate: true,
    };

    next();
  } catch (error) {
    console.error("Error processing post media upload:", error);
    res.status(500).json({
      success: false,
      message: "Error uploading post media",
      error: error.message,
    });
  }
};

// Process multiple exclusive content uploads
const processMultipleExclusiveContentUpload = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No exclusive content uploaded",
      });
    }

    const userId = req.user._id;
    const uploadedFiles = [];

    // Process each file
    for (const file of req.files) {
      const uniqueFilename = generateUniqueFilename(file.originalname);
      const contentType = file.mimetype.startsWith("image/")
        ? "image"
        : "video";

      const result = await uploadToS3(
        file.buffer,
        uniqueFilename,
        file.mimetype,
        `exclusive-content/${userId}/${contentType}s`,
        false // Private access
      );

      uploadedFiles.push({
        filename: uniqueFilename,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        key: result.key,
        contentType,
        isPrivate: true,
      });
    }

    res.status(200).json({
      success: true,
      message: `${uploadedFiles.length} exclusive content file(s) uploaded successfully`,
      files: uploadedFiles,
    });
  } catch (error) {
    console.error("Error processing multiple exclusive content upload:", error);
    res.status(500).json({
      success: false,
      message: "Error uploading exclusive content",
      error: error.message,
    });
  }
};

// Get signed URL for private content
const getPrivateContentUrl = async (req, res) => {
  try {
    // Get the full path after /content/access/
    const key = req.params[0]; // This captures everything after the wildcard
    const userId = req.user._id;

    if (!key) {
      return res.status(400).json({
        success: false,
        message: "No content key provided",
      });
    }

    // More flexible access control - check if the key contains the user's ID
    // This handles both formats: exclusive-content/userId/ and exclusive-content_userId_
    const userIdString = userId.toString();
    const hasAccess =
      key.includes(`exclusive-content_${userIdString}_`) ||
      key.includes(`exclusive-content/${userIdString}_images/`) ||
      key.includes(`content_${userIdString}_`) ||
      key.includes(`content/${userIdString}/`);

    if (!hasAccess) {
      // For content that doesn't belong to the user, check subscription access
      // Extract creator ID from the key pattern
      const creatorIdMatch = key.match(
        /exclusive-content[_/]([a-f0-9]{24})[_/]/
      );
      if (creatorIdMatch) {
        const creatorId = creatorIdMatch[1];

        // Check if user has an active subscription to this creator
        const Subscription = require("../models/subscription_model");
        const subscription = await Subscription.findOne({
          subscriber: userId,
          creator: creatorId,
          status: "active",
          endDate: { $gt: new Date() },
        });

        if (!subscription) {
          return res.status(403).json({
            success: false,
            message:
              "Access denied. Subscription required to view this content.",
          });
        }
      } else {
        return res.status(403).json({
          success: false,
          message: "Access denied to this content",
        });
      }
    }

    const signedUrl = await generateSignedUrl(key, 3600); // 1 hour expiry

    res.json({
      success: true,
      url: signedUrl,
      expiresIn: 3600,
    });
  } catch (error) {
    console.error("Error generating signed URL:", error);
    res.status(500).json({
      success: false,
      message: "Error accessing private content",
      error: error.message,
    });
  }
};

// Handle multer errors
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      const isProfile = req.route.path.includes("profile");
      const maxSize = isProfile ? "5MB" : "100MB";

      return res.status(400).json({
        success: false,
        message: `File too large. Maximum file size is ${maxSize}.`,
      });
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`,
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  next();
};

module.exports = {
  // Multer middleware
  uploadProfileImage: profileImageUpload.single("profileImage"),
  uploadCoverImage: profileImageUpload.single("coverImage"),
  uploadExclusiveContent: exclusiveContentUpload.single("content"),
  uploadPostMedia: exclusiveContentUpload.single("media"), // For post creation with media
  uploadMultipleExclusiveContent: exclusiveContentUpload.array("content", 10),

  // Processing functions
  processProfileImageUpload,
  processCoverImageUpload,
  processExclusiveContentUpload,
  processPostMediaUpload, // New function for post media
  processMultipleExclusiveContentUpload,
  getPrivateContentUrl,

  // Utility functions
  generateUniqueFilename,
  uploadToS3,
  generateSignedUrl,
  handleUploadError,
};
