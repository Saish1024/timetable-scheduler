const express = require("express");
const mongoose = require("mongoose");

const SemesterSchedule = require("../models/SemesterSchedule");
const Department = require("../models/Department");
const { protect, adminOnly, departmentAccess } = require("../middleware/auth");
const { batchCodesFromDepartment } = require("../utils/departmentConfig");

const router = express.Router();

const DEFAULT_ACADEMIC_YEAR = "2025-26";

const normalizeColumns = (input) => {
  if (!Array.isArray(input)) return null;
  return input
    .map((col, idx) => ({
      index: Number(col.index) || idx + 1,
      kind: col.kind || "class",
      startTime: String(col.startTime || "").trim(),
      endTime: String(col.endTime || "").trim(),
      label: String(col.label || "").trim(),
    }))
    .sort((a, b) => a.index - b.index);
};

const normalizeDivisionsInput = (input, classMode = "multi", department = null) => {
  if (!Array.isArray(input)) return null;
  const defaultBatchCodes = batchCodesFromDepartment(department);
  const divisions = input
    .map((d) => ({
      code: String(d.code || "").trim(),
      label: String(d.label || "").trim(),
      batches: (Array.isArray(d.batches) ? d.batches : [])
        .map((b) => String(b).trim().toUpperCase())
        .filter(Boolean),
    }))
    .filter((d) => d.code || classMode === "single");

  if (classMode === "single") {
    const batches =
      divisions[0]?.batches?.length > 0
        ? divisions[0].batches
        : defaultBatchCodes;
    if (batches.length === 0) {
      throw new Error("At least one batch is required");
    }
    return [
      {
        code: SemesterSchedule.SINGLE_CLASS_CODE,
        label: "",
        batches,
      },
    ];
  }

  const codes = new Set();
  for (const d of divisions) {
    if (!d.code) continue;
    if (codes.has(d.code)) {
      throw new Error(`Duplicate division name: ${d.code}`);
    }
    codes.add(d.code);
    if (d.batches.length === 0) {
      throw new Error(`${d.code} must have at least one batch`);
    }
  }
  if (divisions.length === 0) {
    throw new Error("Add at least one division");
  }
  return divisions;
};

const respondWithSchedule = (res, schedule, department) => {
  SemesterSchedule.applyNormalizedDivisions(schedule, department);
  const deptObj = department?.toObject ? department.toObject() : department;
  return res.json({
    success: true,
    schedule,
    departmentConfig: deptObj
      ? { divisions: deptObj.divisions, batches: deptObj.batches }
      : undefined,
  });
};

router.get(
  "/:departmentId/:semester",
  protect,
  departmentAccess,
  async (req, res, next) => {
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

      const academicYear = req.query.academicYear || DEFAULT_ACADEMIC_YEAR;

      const department = await Department.findById(departmentId).lean();
      if (!department) {
        return res
          .status(404)
          .json({ success: false, message: "Department not found" });
      }

      const schedule = await SemesterSchedule.findOrCreateDefault({
        department: departmentId,
        semester: sem,
        academicYear,
      });

      respondWithSchedule(res, schedule, department);
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  "/:departmentId/:semester",
  protect,
  adminOnly,
  async (req, res, next) => {
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

      const academicYear =
        req.body.academicYear || req.query.academicYear || DEFAULT_ACADEMIC_YEAR;

      const department = await Department.findById(departmentId);
      if (!department) {
        return res
          .status(404)
          .json({ success: false, message: "Department not found" });
      }

      const updates = {
        academicYear,
      };

      if (Array.isArray(req.body.workingDays)) {
        updates.workingDays = req.body.workingDays;
      }
      const cols = normalizeColumns(req.body.columns);
      if (cols) updates.columns = cols;

      const classMode =
        req.body.classMode === "multi" || req.body.classMode === "single"
          ? req.body.classMode
          : undefined;
      if (classMode) updates.classMode = classMode;

      if (req.body.divisions !== undefined) {
        const mode =
          classMode ||
          (req.body.divisions.length > 1 ? "multi" : "single");
        updates.divisions = normalizeDivisionsInput(
          req.body.divisions,
          mode,
          department
        );
        if (!classMode) updates.classMode = mode;
      }

      ["classAdvisor", "titleLabel"].forEach((f) => {
        if (req.body[f] !== undefined) updates[f] = req.body[f];
      });
      if (req.body.wef !== undefined) {
        updates.wef = req.body.wef ? new Date(req.body.wef) : null;
      }

      const schedule = await SemesterSchedule.findOneAndUpdate(
        { department: departmentId, semester: sem, academicYear },
        { $set: updates, $setOnInsert: { department: departmentId, semester: sem } },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
      );

      respondWithSchedule(res, schedule, department);
    } catch (err) {
      if (err.message?.includes("division") || err.message?.includes("Division")) {
        return res.status(400).json({ success: false, message: err.message });
      }
      next(err);
    }
  }
);

router.post(
  "/:departmentId/:semester/reset",
  protect,
  adminOnly,
  async (req, res, next) => {
    try {
      const { departmentId, semester } = req.params;
      const academicYear =
        req.body?.academicYear ||
        req.query.academicYear ||
        DEFAULT_ACADEMIC_YEAR;
      const sem = Number(semester);

      const schedule = await SemesterSchedule.findOneAndUpdate(
        { department: departmentId, semester: sem, academicYear },
        {
          $set: {
            columns: SemesterSchedule.buildDefaultColumns(),
            workingDays: [
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
            ],
          },
        },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
      );

      respondWithSchedule(res, schedule);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
