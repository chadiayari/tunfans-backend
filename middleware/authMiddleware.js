const jwt = require("jsonwebtoken");
const Admin = require("../models/admins_model");
const User = require("../models/user_model");
const createError = require("http-errors");

// General authentication middleware
const authenticate = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Check if user is admin or regular user
      let user;
      if (decoded.role === "admin") {
        user = await Admin.findById(decoded.id).select("-password");
      } else {
        user = await User.findById(decoded.id).select("-password");
      }

      if (!user) {
        return next(createError(401, "Not authorized"));
      }

      // Attach user to request object
      req.user = user;
      req.userRole = decoded.role;

      next();
    } catch (error) {
      console.error(error);
      return next(createError(401, "Not authorized, token failed"));
    }
  } else {
    return next(createError(401, "Not authorized, no token"));
  }
};

// Admin-only access middleware
const adminOnly = (req, res, next) => {
  if (req.userRole !== "admin") {
    return next(createError(403, "Access denied. Admin privileges required."));
  }
  next();
};

// User or admin access middleware
const userOrAdmin = (req, res, next) => {
  if (req.userRole !== "user" && req.userRole !== "admin") {
    return next(createError(403, "Access denied. User privileges required."));
  }
  next();
};

// Legacy protect middleware for backward compatibility
const protect = async (req, res, next) => {
  await authenticate(req, res, (err) => {
    if (err) return next(err);

    // For backward compatibility, set req.admin if it's an admin
    if (req.userRole === "admin") {
      req.admin = req.user;
    }
    next();
  });
};

module.exports = {
  authenticate,
  adminOnly,
  userOrAdmin,
  protect, // Keep for backward compatibility
};
