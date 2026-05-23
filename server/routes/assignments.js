const express = require("express");
const mongoose = require("mongoose");

const FacultyAssignment = require("../models/FacultyAssignment");
const Subject = require("../models/Subject");
const Faculty = require("../models/Faculty");
const { protect, hodOnly } = require("../middleware/auth");

const router = express.Router();

const populateAssignment = (query) =>
  query
    .populate("faculty", "name email maxPeriodsPerWeek")
    .populate("subject", "name code semester weeklyCount")
    .populate("department", "name code")
    .lean();

router.post("/", protect, hodOnly, async (req, res, next) => {
  try {
    const { facultyId, subjectId, semester, academicYear } = req.body;

    if (!facultyId || !subjectId || semester === undefined || !academicYear) {
      return res.status(400).json({
        success: false,
        message: "facultyId, subjectId, semester and academicYear are required",
      });
    }

    const subject = await Subject.findById(subjectId);
    if (!subject) {
      return res
        .status(404)
        .json({ success: false, message: "Subject not found" });
    }

    if (subject.department.toString() !== req.user.department.toString()) {
      return res.status(403).json({
        success: false,
        message: "Subject does not belong to your department",
      });
    }

    const faculty = await Faculty.findById(facultyId);
    if (!faculty) {
      return res
        .status(404)
        .json({ success: false, message: "Faculty not found" });
    }

    if (faculty.department.toString() !== req.user.department.toString()) {
      return res.status(403).json({
        success: false,
        message: "Faculty does not belong to your department",
      });
    }

    const assignment = await FacultyAssignment.create({
      faculty: facultyId,
      subject: subjectId,
      department: req.user.department,
      semester: Number(semester),
      academicYear: academicYear.trim(),
    });

    const populated = await populateAssignment(
      FacultyAssignment.findById(assignment._id)
    );

    res.status(201).json({ success: true, assignment: populated });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This faculty is already assigned to this subject for the academic year",
      });
    }
    next(err);
  }
});

router.get("/:departmentId/:semester", protect, async (req, res, next) => {
  try {
    const { departmentId, semester } = req.params;

    if (!mongoose.Types.ObjectId.isValid(departmentId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid departmentId" });
    }

    const sem = Number(semester);
    if (Number.isNaN(sem) || sem < 1 || sem > 8) {
      return res
        .status(400)
        .json({ success: false, message: "semester must be between 1 and 8" });
    }

    if (
      req.user.role === "hod" &&
      req.user.department.toString() !== departmentId
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only view assignments for your department",
      });
    }

    const filter = { department: departmentId, semester: sem };
    if (req.query.academicYear) {
      filter.academicYear = req.query.academicYear;
    }

    const assignments = await populateAssignment(
      FacultyAssignment.find(filter)
    ).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: assignments.length,
      assignments,
    });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", protect, hodOnly, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid assignment id" });
    }

    const assignment = await FacultyAssignment.findById(id);
    if (!assignment) {
      return res
        .status(404)
        .json({ success: false, message: "Assignment not found" });
    }

    if (assignment.department.toString() !== req.user.department.toString()) {
      return res.status(403).json({
        success: false,
        message: "Assignment does not belong to your department",
      });
    }

    const { facultyId } = req.body;
    if (!facultyId) {
      return res.status(400).json({
        success: false,
        message: "facultyId is required to reassign",
      });
    }

    const faculty = await Faculty.findById(facultyId);
    if (!faculty) {
      return res
        .status(404)
        .json({ success: false, message: "Faculty not found" });
    }

    if (faculty.department.toString() !== req.user.department.toString()) {
      return res.status(403).json({
        success: false,
        message: "Faculty does not belong to your department",
      });
    }

    assignment.faculty = facultyId;
    await assignment.save();

    const populated = await populateAssignment(
      FacultyAssignment.findById(assignment._id)
    );

    res.json({ success: true, assignment: populated });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This faculty is already assigned to this subject for the academic year",
      });
    }
    next(err);
  }
});

router.delete("/:id", protect, hodOnly, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid assignment id" });
    }

    const assignment = await FacultyAssignment.findById(id);
    if (!assignment) {
      return res
        .status(404)
        .json({ success: false, message: "Assignment not found" });
    }

    if (assignment.department.toString() !== req.user.department.toString()) {
      return res.status(403).json({
        success: false,
        message: "Assignment does not belong to your department",
      });
    }

    await assignment.deleteOne();

    res.json({ success: true, message: "Assignment removed" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
