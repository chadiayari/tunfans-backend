const multer = require("multer");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const crypto = require("crypto");
const path = require("path");
const { Readable } = require("stream");
const { fromEnv } = require("@aws-sdk/credential-providers");

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: fromEnv(),
});

const memoryStorage = multer.memoryStorage();

const imageFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

const videoFileFilter = (req, file, cb) => {
  const allowedVideoTypes = [
    "video/mp4",
    "video/mpeg",
    "video/quicktime",
    "video/x-msvideo",
    "video/x-ms-wmv",
    "video/webm",
  ];

  if (allowedVideoTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only video files are allowed!"), false);
  }
};

const mediaFileFilter = (req, file, cb) => {
  if (
    file.mimetype.startsWith("image/") ||
    file.mimetype.startsWith("video/")
  ) {
    cb(null, true);
  } else {
    cb(new Error("Only image or video files are allowed!"), false);
  }
};

const imageUpload = multer({
  storage: memoryStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

const videoUpload = multer({
  storage: memoryStorage,
  fileFilter: videoFileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
});

const mediaUpload = multer({
  storage: memoryStorage,
  fileFilter: mediaFileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
});

const generateUniqueFilename = (originalFilename) => {
  const ext = path.extname(originalFilename);
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(16).toString("hex");
  return `${timestamp}-${randomString}${ext}`;
};

const uploadBufferToS3 = async (
  buffer,
  filename,
  mimetype,
  folder = "uploads",
) => {
  let sanitizedFolder = "uploads";
  if (typeof folder === "string" && !folder.includes("function")) {
    sanitizedFolder = folder;
  } else if (folder && typeof folder === "object") {
    console.error(
      "Invalid folder parameter (object passed instead of string):",
      typeof folder === "function"
        ? "Express middleware function"
        : typeof folder,
    );
  }

  const key = `${sanitizedFolder}/${filename}`;

  if (!Buffer.isBuffer(buffer)) {
    if (typeof buffer === "string") {
      buffer = Buffer.from(buffer);
    }

    if (!Buffer.isBuffer(buffer)) {
      throw new Error("Input must be a Buffer");
    }
  }

  if (buffer.length === 0) {
    throw new Error("Cannot upload empty file");
  }

  if (!process.env.S3_BUCKET) {
    throw new Error("S3_BUCKET environment variable is not set");
  }

  if (!process.env.AWS_REGION) {
    throw new Error("AWS_REGION environment variable is not set");
  }

  try {
    if (!mimetype || mimetype === "application/octet-stream") {
      const ext = path.extname(filename).toLowerCase();
      if (ext === ".jpg" || ext === ".jpeg") {
        mimetype = "image/jpeg";
      } else if (ext === ".png") {
        mimetype = "image/png";
      } else if (ext === ".gif") {
        mimetype = "image/gif";
      } else if (ext === ".webp") {
        mimetype = "image/webp";
      }
    }

    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
    };

    const command = new PutObjectCommand(params);
    await s3Client.send(command);

    const url = `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    return {
      key,
      url,
    };
  } catch (error) {
    console.error(error);
    throw error;
  }
};

exports.generateUniqueFilename = generateUniqueFilename;
exports.uploadBufferToS3 = uploadBufferToS3;

exports.uploadSingleImage = imageUpload.single("image");
exports.uploadMultipleImages = imageUpload.array("images", 5);
exports.uploadInfoSectionImage = imageUpload.single("infoSectionImage");
exports.uploadCategoryImage = imageUpload.single("heroImage");
exports.uploadTreatmentImage = imageUpload.single("imageSrc");

exports.uploadSingleVideo = videoUpload.single("video");
exports.uploadMultipleVideos = videoUpload.array("videos", 3);
exports.uploadPromoVideo = videoUpload.single("promoVideo");
exports.uploadTutorialVideo = videoUpload.single("tutorialVideo");

exports.uploadMedia = mediaUpload.single("media");
exports.uploadMultipleMedia = mediaUpload.array("media", 5);

exports.fields = mediaUpload.fields.bind(mediaUpload);

exports.processSingleUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file uploaded" });
    }

    const uniqueFilename = generateUniqueFilename(req.file.originalname);

    const result = await uploadBufferToS3(
      req.file.buffer,
      uniqueFilename,
      req.file.mimetype,
      "images",
    );

    res.status(200).json({
      message: "Image uploaded successfully",
      file: {
        filename: uniqueFilename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: result.url,
      },
    });
  } catch (error) {
    console.error("Error processing uploaded image:", error);
    res.status(500).json({
      message: "Error processing uploaded image",
      error: error.message,
    });
  }
};

exports.processSingleVideoUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No video file uploaded" });
    }

    const uniqueFilename = generateUniqueFilename(req.file.originalname);

    const result = await uploadBufferToS3(
      req.file.buffer,
      uniqueFilename,
      req.file.mimetype,
      "videos",
    );

    res.status(200).json({
      message: "Video uploaded successfully",
      file: {
        filename: uniqueFilename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: result.url,
      },
    });
  } catch (error) {
    console.error("Error processing uploaded video:", error);
    res.status(500).json({
      message: "Error processing uploaded video",
      error: error.message,
    });
  }
};

exports.processMultipleUploads = async (req, res, folder = "uploads") => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: "No files uploaded" });
  }

  try {
    const uploadPromises = req.files.map(async (file) => {
      const uniqueFilename = generateUniqueFilename(file.originalname);

      const folderPath = file.mimetype.startsWith("image/")
        ? "images"
        : "videos";

      const result = await uploadBufferToS3(
        file.buffer,
        uniqueFilename,
        file.mimetype,
        folderPath,
      );

      return {
        filename: uniqueFilename,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        url: result.url,
        type: file.mimetype.startsWith("image/") ? "image" : "video",
      };
    });

    const uploadedFiles = await Promise.all(uploadPromises);

    res.status(200).json({
      message: "Files uploaded successfully",
      files: uploadedFiles,
    });
  } catch (error) {
    console.error("Error processing uploaded files:", error);
    res.status(500).json({
      message: "Error processing uploaded files",
      error: error.message,
    });
  }
};

exports.processMultipleVideoUploads = async (req, res) => {
  return exports.processMultipleUploads(req, res, "videos");
};

exports.processInfoSectionImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file uploaded" });
    }

    const uniqueFilename = generateUniqueFilename(req.file.originalname);

    const result = await uploadBufferToS3(
      req.file.buffer,
      uniqueFilename,
      req.file.mimetype,
      "info-sections",
    );

    res.status(200).json({
      message: "Info section image uploaded successfully",
      file: {
        filename: uniqueFilename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: result.url,
      },
    });
  } catch (error) {
    console.error("Error processing info section image:", error);
    res.status(500).json({
      message: "Error processing info section image",
      error: error.message,
    });
  }
};

exports.processPromoVideo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No video file uploaded" });
    }

    const uniqueFilename = generateUniqueFilename(req.file.originalname);

    const result = await uploadBufferToS3(
      req.file.buffer,
      uniqueFilename,
      req.file.mimetype,
      "promo-videos",
    );

    res.status(200).json({
      message: "Promo video uploaded successfully",
      file: {
        filename: uniqueFilename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: result.url,
      },
    });
  } catch (error) {
    console.error("Error processing promo video:", error);
    res.status(500).json({
      message: "Error processing promo video",
      error: error.message,
    });
  }
};

exports.processMediaUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No media file uploaded" });
    }

    const uniqueFilename = generateUniqueFilename(req.file.originalname);

    const folder = req.file.mimetype.startsWith("image/") ? "images" : "videos";

    const result = await uploadBufferToS3(
      req.file.buffer,
      uniqueFilename,
      req.file.mimetype,
      folder,
    );

    res.status(200).json({
      message: `Media uploaded successfully`,
      file: {
        filename: uniqueFilename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: result.url,
        type: req.file.mimetype.startsWith("image/") ? "image" : "video",
      },
    });
  } catch (error) {
    console.error("Error processing uploaded media:", error);
    res.status(500).json({
      message: "Error processing uploaded media",
      error: error.message,
    });
  }
};

exports.handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      const isVideo = req.route.path.toLowerCase().includes("video");
      const maxSize = isVideo ? "100MB" : "5MB";

      return res.status(400).json({
        message: `File too large. Maximum file size is ${maxSize}.`,
      });
    }
    return res.status(400).json({
      message: `Multer upload error: ${err.message}`,
    });
  } else if (err) {
    return res.status(500).json({
      message: err.message,
    });
  }
  next();
};
