const express = require("express");
const mongoose = require("mongoose");

const Department = require("../models/Department");
const User = require("../models/User");
const { protect, adminOnly } = require("../middleware/auth");
const {
  normalizeDivisionsList,
  normalizeBatchesList,
} = require("../utils/departmentConfig");

const router = express.Router();

const populateHod = (query) =>
  query.populate("hod", "name email role").lean();

router.get("/", protect, async (req, res, next) => {
  try {
    const departments = await populateHod(Department.find()).sort({ code: 1 });
    res.json({ success: true, count: departments.length, departments });
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
        .json({ success: false, message: "Invalid department id" });
    }
    const department = await populateHod(Department.findById(id));
    if (!department) {
      return res
        .status(404)
        .json({ success: false, message: "Department not found" });
    }
    res.json({ success: true, department });
  } catch (err) {
    next(err);
  }
});

router.post("/", protect, adminOnly, async (req, res, next) => {
  try {
    const { name, code, totalSemesters, divisions, batches } = req.body;
    const hod = req.body.hod ?? req.body.hodId;

    if (!name || !code) {
      return res.status(400).json({
        success: false,
        message: "name and code are required",
      });
    }

    const department = await Department.create({
      name,
      code,
      hod: hod || null,
      totalSemesters,
      divisions: normalizeDivisionsList(divisions),
      batches: normalizeBatchesList(batches),
    });

    if (hod) {
      await User.findByIdAndUpdate(hod, { department: department._id, role: "hod" });
    }

    const populated = await populateHod(Department.findById(department._id));
    res.status(201).json({ success: true, department: populated });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", protect, adminOnly, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid department id" });
    }

    const { name, code, totalSemesters, divisions, batches } = req.body;
    const hod = req.body.hod !== undefined ? req.body.hod : req.body.hodId;

    const department = await Department.findById(id);
    if (!department) {
      return res
        .status(404)
        .json({ success: false, message: "Department not found" });
    }

    if (name !== undefined) department.name = name;
    if (code !== undefined) department.code = code;
    if (totalSemesters !== undefined) department.totalSemesters = totalSemesters;
    if (divisions !== undefined) {
      department.divisions = normalizeDivisionsList(divisions);
    }
    if (batches !== undefined) {
      department.batches = normalizeBatchesList(batches);
    }
    if (hod !== undefined) {
      department.hod = hod || null;
      if (hod) {
        await User.findByIdAndUpdate(hod, { department: department._id, role: "hod" });
      }
    }
    await department.save();

    const populated = await populateHod(Department.findById(department._id));
    res.json({ success: true, department: populated });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", protect, adminOnly, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid department id" });
    }

    const deleted = await Department.findByIdAndDelete(id);
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Department not found" });
    }
    res.json({ success: true, message: "Department deleted" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
