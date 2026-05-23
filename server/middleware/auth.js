const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  try {
    let token;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "Not authorized, no token provided" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res
        .status(401)
        .json({ success: false, message: "Not authorized, token invalid or expired" });
    }

    const user = await User.findById(decoded.id).lean();
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User no longer exists" });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res
      .status(403)
      .json({ success: false, message: "Admin access required" });
  }
  next();
};

const hodOnly = (req, res, next) => {
  if (!req.user || req.user.role !== "hod") {
    return res
      .status(403)
      .json({ success: false, message: "HOD access required" });
  }
  if (!req.user.department) {
    return res.status(400).json({
      success: false,
      message: "Your account is not assigned to a department",
    });
  }
  next();
};

const departmentAccess = (req, res, next) => {
  const departmentId = req.params.departmentId;
  if (!departmentId) {
    return res
      .status(400)
      .json({ success: false, message: "departmentId is required" });
  }

  if (req.user.role === "admin") {
    return next();
  }

  if (req.user.role === "hod") {
    const userDept = req.user.department?.toString();
    if (userDept === departmentId) {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: "You can only access your own department",
    });
  }

  return res.status(403).json({ success: false, message: "Access denied" });
};

/**
 * Admin always allowed. HOD only when resolveDepartmentId(req) matches their department.
 * resolveDepartmentId may be sync or async.
 */
const adminOrHodDepartment =
  (resolveDepartmentId) =>
  async (req, res, next) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: "Not authorized" });
    }

    if (req.user.role === "admin") {
      return next();
    }

    if (req.user.role === "hod") {
      if (!req.user.department) {
        return res.status(400).json({
          success: false,
          message: "Your account is not assigned to a department",
        });
      }

      try {
        const targetId = await resolveDepartmentId(req);
        if (!targetId) {
          return res.status(400).json({
            success: false,
            message: "departmentId is required",
          });
        }
        if (String(req.user.department) !== String(targetId)) {
          return res.status(403).json({
            success: false,
            message: "You can only edit your own department timetable",
          });
        }
        return next();
      } catch (err) {
        return next(err);
      }
    }

    return res.status(403).json({ success: false, message: "Access denied" });
  };

module.exports = {
  protect,
  adminOnly,
  hodOnly,
  departmentAccess,
  adminOrHodDepartment,
};
