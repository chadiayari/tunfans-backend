const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const compression = require("compression");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./conn");
var authRouter = require("./middleware/authRoutes");
const userRouter = require("./routes/user");
const adminRouter = require("./routes/admin");
const chatRouter = require("./routes/chat");
const postsRouter = require("./routes/posts");
const SocketService = require("./services/socketService");

dotenv.config();
const app = express();
const server = http.createServer(app);

// Socket.IO setup with CORS
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Initialize Socket service
const socketService = new SocketService(io);

app.use(cors());
app.use(logger("dev"));
app.use(compression());

// Regular JSON parsing for other routes
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());

app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/admin", adminRouter);
app.use("/api/chat", chatRouter);
app.use("/api/posts", postsRouter);

app.use(
  express.static(path.join(__dirname, "public", "build"), {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".js")) {
        res.setHeader("Content-Type", "application/javascript; charset=UTF-8");
      } else if (filePath.endsWith(".css")) {
        res.setHeader("Content-Type", "text/css; charset=UTF-8");
      } else if (filePath.endsWith(".html")) {
        res.setHeader("Content-Type", "text/html; charset=UTF-8");
      } else if (filePath.endsWith(".woff2")) {
        res.setHeader("Content-Type", "font/woff2");
      } else if (filePath.endsWith(".woff")) {
        res.setHeader("Content-Type", "font/woff");
      } else if (filePath.endsWith(".ttf")) {
        res.setHeader("Content-Type", "font/ttf");
      } else if (filePath.endsWith(".otf")) {
        res.setHeader("Content-Type", "font/opentype");
      } else if (filePath.endsWith(".svg")) {
        res.setHeader("Content-Type", "image/svg+xml");
      } else if (filePath.endsWith(".png")) {
        res.setHeader("Content-Type", "image/png");
      } else if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) {
        res.setHeader("Content-Type", "image/jpeg");
      } else if (filePath.endsWith(".webp")) {
        res.setHeader("Content-Type", "image/webp");
      } else if (filePath.endsWith(".json")) {
        res.setHeader("Content-Type", "application/json");
      } else if (
        filePath.endsWith(".webmanifest") ||
        filePath.endsWith(".manifest")
      ) {
        res.setHeader("Content-Type", "application/manifest+json");
      }
      if (
        filePath.match(/\.(js|css|woff2|woff|ttf|otf|png|jpg|jpeg|webp|svg)$/)
      ) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  })
);

app.get("/src/*", (req, res) => {
  console.log(`Redirecting /src/ request: ${req.path}`);
  res.status(404).send("Source files not available in production");
});

app.get("/assets/*", (req, res) => {
  const assetPath = req.path.replace("/assets/", "");
  res.sendFile(
    path.join(__dirname, "public", "build", "assets", assetPath),
    (err) => {
      if (err) {
        console.error(`Error serving asset at ${req.path}:`, err);
        res.status(404).send("Asset not found");
      }
    }
  );
});

const routesWithAssets = [
  "blog",
  "admin",
  "login",
  "about",
  "tarifs",
  "services",
  "cliniques",
  "greffe-cheveux",
  "visage",
  "seins",
  "silhouette",
  "homme",
  "intime",
  "medecine-esthetique",
];
routesWithAssets.forEach((route) => {
  app.get(`/${route}/assets/*`, (req, res) => {
    const assetPath = req.path.replace(`/${route}/assets/`, "");
    res.sendFile(
      path.join(__dirname, "public", "build", "assets", assetPath),
      (err) => {
        if (err) {
          console.error(`Error serving asset at ${req.path}:`, err);
          res.status(404).send("Asset not found");
        }
      }
    );
  });
});

app.get("/*/*/assets/*", (req, res) => {
  const pathParts = req.path.split("/");
  const assetPath = pathParts.slice(pathParts.indexOf("assets") + 1).join("/");
  res.sendFile(
    path.join(__dirname, "public", "build", "assets", assetPath),
    (err) => {
      if (err) {
        console.error(`Error serving asset at ${req.path}:`, err);
        res.status(404).send("Asset not found");
      }
    }
  );
});

app.get("/*/*/*/assets/*", (req, res) => {
  const pathParts = req.path.split("/");
  const assetPath = pathParts.slice(pathParts.indexOf("assets") + 1).join("/");
  res.sendFile(
    path.join(__dirname, "public", "build", "assets", assetPath),
    (err) => {
      if (err) {
        console.error(`Error serving asset at ${req.path}:`, err);
        res.status(404).send("Asset not found");
      }
    }
  );
});

app.get("/manifest.json", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "build", "manifest.json"),
    (err) => {
      if (err) {
        res.status(404).send("Manifest not found");
      }
    }
  );
});

// Catch-all route for SPA
app.get("*", (req, res) => {
  if (!req.path.includes(".") || req.path.endsWith(".html")) {
    console.log(`Serving index.html for path: ${req.path}`);
  }

  res.setHeader("Content-Type", "text/html; charset=UTF-8");
  res.setHeader("X-Content-Type-Options", "nosniff");

  res.sendFile(
    path.resolve(__dirname, "public", "build", "index.html"),
    (err) => {
      if (err) {
        console.error(`Error serving index.html: ${err}`);
        res.status(500).send("Server error");
      }
    }
  );
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    error: process.env.NODE_ENV === "development" ? err : {},
  });
});

connectDB();
const port = process.env.PORT || 5000;
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Socket.IO server is ready`);
});

// Make socket service available globally if needed
app.set("socketService", socketService);

module.exports = { app, server, io, socketService };
