const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const User = require("../models/User");
const Department = require("../models/Department");
const { protect, adminOnly } = require("../middleware/auth");
const {
  signAccessToken,
  signRefreshToken,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  getRefreshSecret,
  isAccessTokenWithinRefreshGrace,
} = require("../utils/tokens");

const router = express.Router();

const formatUser = (user) => ({
  _id: user._id,
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  department: user.department,
});

const issueAuthTokens = (res, user) => {
  const token = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  setRefreshTokenCookie(res, refreshToken);
  return token;
};

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select("+password")
      .populate("department", "name code divisions batches totalSemesters");

    if (!user || !(await user.comparePassword(password))) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }

    const token = issueAuthTokens(res, user);

    res.json({
      success: true,
      token,
      user: formatUser(user),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/refresh", async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "No refresh token",
      });
    }

    let refreshDecoded;
    try {
      refreshDecoded = jwt.verify(refreshToken, getRefreshSecret());
    } catch {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token",
      });
    }

    if (refreshDecoded.type !== "refresh" || !refreshDecoded.id) {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Access token required",
      });
    }

    const accessToken = authHeader.split(" ")[1];
    const grace = isAccessTokenWithinRefreshGrace(accessToken);
    if (!grace.ok) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({
        success: false,
        message: grace.reason,
      });
    }

    if (grace.decoded.id !== refreshDecoded.id) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({
        success: false,
        message: "Token mismatch",
      });
    }

    const user = await User.findById(refreshDecoded.id)
      .populate("department", "name code divisions batches totalSemesters")
      .lean();

    if (!user) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({
        success: false,
        message: "User no longer exists",
      });
    }

    const token = issueAuthTokens(res, user);

    res.json({
      success: true,
      token,
      user: formatUser(user),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", (req, res, next) => {
  try {
    clearRefreshTokenCookie(res);
    res.json({ success: true, message: "Logged out" });
  } catch (err) {
    next(err);
  }
});

router.post("/create-hod", protect, adminOnly, async (req, res, next) => {
  try {
    const { name, email, password, departmentId } = req.body;

    if (!name || !email || !password || !departmentId) {
      return res.status(400).json({
        success: false,
        message: "name, email, password and departmentId are required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(departmentId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid departmentId" });
    }

    const department = await Department.findById(departmentId);
    if (!department) {
      return res
        .status(404)
        .json({ success: false, message: "Department not found" });
    }

    const existingEmail = await User.findOne({
      email: email.toLowerCase().trim(),
    });
    if (existingEmail) {
      return res
        .status(409)
        .json({ success: false, message: "Email already registered" });
    }

    if (department.hod) {
      await User.findByIdAndUpdate(department.hod, { department: null });
    }

    const hod = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: "hod",
      department: department._id,
    });

    department.hod = hod._id;
    await department.save();

    const populated = await User.findById(hod._id)
      .populate("department", "name code")
      .lean();

    res.status(201).json({ success: true, user: formatUser(populated) });
  } catch (err) {
    next(err);
  }
});

router.get("/hods", protect, adminOnly, async (req, res, next) => {
  try {
    const hods = await User.find({ role: "hod" })
      .populate("department", "name code hod totalSemesters divisions batches")
      .sort({ name: 1 })
      .lean();

    res.json({ success: true, count: hods.length, hods });
  } catch (err) {
    next(err);
  }
});

router.put("/hod/:id", protect, adminOnly, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid HOD id" });
    }

    const hod = await User.findOne({ _id: id, role: "hod" });
    if (!hod) {
      return res
        .status(404)
        .json({ success: false, message: "HOD not found" });
    }

    const { name, email, departmentId } = req.body;

    if (name !== undefined) hod.name = name;
    if (email !== undefined) hod.email = email;

    if (departmentId !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(departmentId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid departmentId" });
      }

      const department = await Department.findById(departmentId);
      if (!department) {
        return res
          .status(404)
          .json({ success: false, message: "Department not found" });
      }

      if (department.hod && department.hod.toString() !== id) {
        await User.findByIdAndUpdate(department.hod, { department: null });
      }

      const prevDept = await Department.findOne({ hod: id });
      if (prevDept && prevDept._id.toString() !== departmentId) {
        prevDept.hod = null;
        await prevDept.save();
      }

      hod.department = department._id;
      department.hod = hod._id;
      await department.save();
    }

    await hod.save();

    const populated = await User.findById(hod._id)
      .populate("department", "name code")
      .lean();
    res.json({ success: true, user: formatUser(populated) });
  } catch (err) {
    next(err);
  }
});

router.delete("/hod/:id", protect, adminOnly, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid HOD id" });
    }

    const hod = await User.findOneAndDelete({ _id: id, role: "hod" });
    if (!hod) {
      return res
        .status(404)
        .json({ success: false, message: "HOD not found" });
    }

    await Department.updateMany({ hod: id }, { $set: { hod: null } });

    res.json({ success: true, message: "HOD account deleted" });
  } catch (err) {
    next(err);
  }
});

router.get("/me", protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate("department").lean();
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    res.json({ success: true, user: formatUser(user) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
