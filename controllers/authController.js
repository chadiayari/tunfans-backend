//contollers/authController.js
const jwt = require("jsonwebtoken");
const Admin = require("../models/admins_model");
const createError = require("http-errors");

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

const loginAdmin = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    const admin = await Admin.findOne({ username });

    if (!admin) {
      return next(createError(401, "Invalid credentials"));
    }

    const isMatch = await admin.matchPassword(password);

    if (!isMatch) {
      return next(createError(401, "Invalid credentials"));
    }

    const token = generateToken(admin._id, admin.role);

    res.json({
      _id: admin._id,
      username: admin.username,
      role: admin.role,
      token: token,
      success: true,
    });
  } catch (error) {
    console.error("Login error:", error);
    next(error);
  }
};

const verifyToken = async (req, res) => {
  res.json({
    data: req.user,
  });
};

module.exports = {
  loginAdmin,
  verifyToken,
};
