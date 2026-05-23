const express = require("express");
const mongoose = require("mongoose");

const Faculty = require("../models/Faculty");
const Department = require("../models/Department");
const TimetableSlot = require("../models/TimetableSlot");
const { protect, adminOnly } = require("../middleware/auth");
const { keys, get: cacheGet, set: cacheSet } = require("../utils/cache");

const router = express.Router();

const listFacultyByDepartment = (departmentId) =>
  Faculty.find({ department: departmentId })
    .populate("department", "name code")
    .sort({ name: 1 })
    .lean();

router.get("/", protect, async (req, res, next) => {
  try {
    if (req.query.department) {
      const departmentId = req.query.department;
      if (!mongoose.Types.ObjectId.isValid(departmentId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid department id" });
      }

      const cacheKey = keys.faculty(departmentId);
      const cached = await cacheGet(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const faculty = await listFacultyByDepartment(departmentId);
      const payload = {
        success: true,
        departmentId,
        count: faculty.length,
        faculty,
      };
      await cacheSet(cacheKey, payload);
      return res.json(payload);
    }

    const faculty = await Faculty.find()
      .populate("department", "name code")
      .sort({ name: 1 })
      .lean();
    res.json({ success: true, count: faculty.length, faculty });
  } catch (err) {
    next(err);
  }
});

router.get("/:departmentId", protect, async (req, res, next) => {
  try {
    const { departmentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(departmentId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid department id" });
    }

    const department = await Department.findById(departmentId)
      .select("_id")
      .lean();
    if (!department) {
      return next("route");
    }

    const cacheKey = keys.faculty(departmentId);
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const faculty = await listFacultyByDepartment(departmentId);
    const payload = {
      success: true,
      departmentId,
      count: faculty.length,
      faculty,
    };
    await cacheSet(cacheKey, payload);
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

router.get("/:id/workload", protect, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid faculty id" });
    }

    const faculty = await Faculty.findById(id);
    if (!faculty) {
      return res
        .status(404)
        .json({ success: false, message: "Faculty not found" });
    }

    const filter = { faculty: faculty._id };
    if (req.query.academicYear) filter.academicYear = req.query.academicYear;

    const totalPeriods = await TimetableSlot.countDocuments(filter);

    const byDay = await TimetableSlot.aggregate([
      { $match: { faculty: faculty._id } },
      { $group: { _id: "$day", periods: { $sum: 1 } } },
    ]);

    const max = faculty.maxPeriodsPerWeek || 0;
    const utilization =
      max > 0 ? Number(((totalPeriods / max) * 100).toFixed(1)) : 0;

    res.json({
      success: true,
      faculty: {
        _id: faculty._id,
        name: faculty.name,
        email: faculty.email,
      },
      totalPeriods,
      maxPeriodsPerWeek: max,
      utilization,
      overloaded: totalPeriods > max,
      byDay: byDay.reduce((acc, d) => {
        acc[d._id] = d.periods;
        return acc;
      }, {}),
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", protect, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid faculty id" });
    }
    const faculty = await Faculty.findById(id)
      .populate("department", "name code")
      .lean();
    if (!faculty) {
      return res
        .status(404)
        .json({ success: false, message: "Faculty not found" });
    }
    res.json({ success: true, faculty });
  } catch (err) {
    next(err);
  }
});

router.post("/", protect, adminOnly, async (req, res, next) => {
  try {
    const { name, email, department, maxPeriodsPerWeek, shortCode } = req.body;
    if (!name || !email || !department) {
      return res.status(400).json({
        success: false,
        message: "name, email and department are required",
      });
    }

    const existing = await Faculty.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res
        .status(409)
        .json({ success: false, message: "Faculty with this email already exists" });
    }

    const faculty = await Faculty.create({
      name,
      email,
      department,
      maxPeriodsPerWeek,
      shortCode: shortCode ? String(shortCode).trim().toUpperCase() : "",
    });

    const populated = await Faculty.findById(faculty._id)
      .populate("department", "name code")
      .lean();
    res.status(201).json({ success: true, faculty: populated });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Short code already used in this department",
      });
    }
    next(err);
  }
});

router.put("/:id", protect, adminOnly, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid faculty id" });
    }

    const updates = { ...req.body };
    if (updates.shortCode !== undefined) {
      updates.shortCode = String(updates.shortCode).trim().toUpperCase();
    }

    const faculty = await Faculty.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    })
      .populate("department", "name code")
      .lean();

    if (!faculty) {
      return res
        .status(404)
        .json({ success: false, message: "Faculty not found" });
    }
    res.json({ success: true, faculty });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Short code already used in this department",
      });
    }
    next(err);
  }
});

router.delete("/:id", protect, adminOnly, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid faculty id" });
    }

    const assignedCount = await TimetableSlot.countDocuments({ faculty: id });
    if (assignedCount > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete faculty: ${assignedCount} timetable slot(s) still reference this faculty`,
      });
    }

    const deleted = await Faculty.findByIdAndDelete(id);
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Faculty not found" });
    }

    res.json({ success: true, message: "Faculty deleted" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
