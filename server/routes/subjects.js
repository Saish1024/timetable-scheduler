const express = require("express");
const mongoose = require("mongoose");

const Subject = require("../models/Subject");
const { protect, adminOnly } = require("../middleware/auth");
const {
  keys,
  get: cacheGet,
  set: cacheSet,
  invalidateSubjects,
} = require("../utils/cache");

const router = express.Router();

const emptyGroupedBySemester = () => {
  const grouped = {};
  for (let i = 1; i <= 8; i++) {
    grouped[`sem${i}`] = [];
  }
  return grouped;
};

const groupBySemester = (subjects) => {
  const grouped = emptyGroupedBySemester();
  for (const subject of subjects) {
    const key = `sem${subject.semester}`;
    if (grouped[key]) {
      grouped[key].push(subject);
    }
  }
  return grouped;
};

const buildSubjectPayload = (body) => {
  const theory = body.theoryHours !== undefined ? Number(body.theoryHours) : 0;
  const tutorial =
    body.tutorialHours !== undefined ? Number(body.tutorialHours) : 0;
  const practical =
    body.practicalHours !== undefined ? Number(body.practicalHours) : 0;
  const explicitWeekly =
    body.weeklyCount !== undefined ? Number(body.weeklyCount) : null;
  const derivedWeekly = theory + tutorial + practical;

  return {
    theoryHours: theory,
    tutorialHours: tutorial,
    practicalHours: practical,
    weeklyCount:
      derivedWeekly > 0
        ? derivedWeekly
        : explicitWeekly !== null && !Number.isNaN(explicitWeekly)
          ? explicitWeekly
          : 0,
  };
};

router.post("/", protect, adminOnly, async (req, res, next) => {
  try {
    const { name, code, departmentId, semester } = req.body;

    if (!name || !code || !departmentId || semester === undefined) {
      return res.status(400).json({
        success: false,
        message: "name, code, departmentId and semester are required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(departmentId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid departmentId" });
    }

    const hours = buildSubjectPayload(req.body);

    const subject = await Subject.create({
      name,
      code,
      department: departmentId,
      semester,
      ...hours,
    });

    const populated = await Subject.findById(subject._id)
      .populate("department", "name code")
      .lean();
    await invalidateSubjects(departmentId);
    res.status(201).json({ success: true, subject: populated });
  } catch (err) {
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

    const subjects = await Subject.find({
      department: departmentId,
      semester: sem,
    })
      .populate("department", "name code")
      .sort({ code: 1 })
      .lean();

    res.json({
      success: true,
      departmentId,
      semester: sem,
      count: subjects.length,
      subjects,
    });
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
        .json({ success: false, message: "Invalid departmentId" });
    }

    const cacheKey = keys.subjects(departmentId);
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const subjects = await Subject.find({ department: departmentId })
      .populate("department", "name code")
      .sort({ semester: 1, code: 1 })
      .lean();

    const grouped = groupBySemester(subjects);

    const payload = {
      success: true,
      departmentId,
      count: subjects.length,
      ...grouped,
    };
    await cacheSet(cacheKey, payload);
    res.json(payload);
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
        .json({ success: false, message: "Invalid subject id" });
    }

    const updates = { ...req.body };
    if (updates.departmentId) {
      updates.department = updates.departmentId;
      delete updates.departmentId;
    }

    if (
      updates.theoryHours !== undefined ||
      updates.tutorialHours !== undefined ||
      updates.practicalHours !== undefined
    ) {
      const hours = buildSubjectPayload(updates);
      Object.assign(updates, hours);
    }

    const subject = await Subject.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    })
      .populate("department", "name code")
      .lean();

    if (!subject) {
      return res
        .status(404)
        .json({ success: false, message: "Subject not found" });
    }
    await invalidateSubjects(subject.department);
    res.json({ success: true, subject });
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
        .json({ success: false, message: "Invalid subject id" });
    }

    const deleted = await Subject.findByIdAndDelete(id);
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Subject not found" });
    }
    await invalidateSubjects(deleted.department);
    res.json({ success: true, message: "Subject deleted" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
