const express = require("express");

const User = require("../models/User");
const { protect, adminOnly } = require("../middleware/auth");

const router = express.Router();

router.get("/", protect, adminOnly, async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.role) filter.role = req.query.role;

    const users = await User.find(filter)
      .select("-password")
      .populate("department", "name code")
      .sort({ name: 1 })
      .lean();

    res.json({ success: true, count: users.length, users });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
