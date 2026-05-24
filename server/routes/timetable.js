const express = require("express");
const mongoose = require("mongoose");

const TimetableSlot = require("../models/TimetableSlot");
const SemesterSchedule = require("../models/SemesterSchedule");
const {
  protect,
  adminOnly,
  departmentAccess,
  adminOrHodDepartment,
} = require("../middleware/auth");
const {
  normalizeSlotType,
  isLecture,
  isPractical,
} = require("../utils/slotTypes");
const { checkConflicts, checkConflictsInMemory, detectIntraCellConflicts } = require("../services/conflictDetection");
const {
  keys,
  get: cacheGet,
  set: cacheSet,
  invalidateTimetable,
} = require("../utils/cache");

const router = express.Router();

const populateSlot = (query, { lean = true } = {}) => {
  let q = query
    .populate("subject", "name code semester weeklyCount theoryHours tutorialHours practicalHours")
    .populate("faculty", "name email shortCode")
    .populate("room", "name type capacity")
    .populate("department", "name code")
    .populate("teachingDepartment", "name code");
  if (lean) q = q.lean();
  return q;
};

const normalizeBatch = (batch) => {
  if (!batch) return null;
  const trimmed = String(batch).trim().toUpperCase();
  return trimmed.length === 0 ? null : trimmed;
};

const isClassColumn = (schedule, period) => {
  if (!schedule) return true;
  const col = schedule.columns.find((c) => c.index === Number(period));
  if (!col) return true;
  return col.kind === "class";
};

/** Accept camelCase *Id fields or legacy names from older clients. */
const extractSlotFields = (body) => ({
  day: body.day,
  period: body.period,
  subjectId: body.subjectId ?? body.subject,
  facultyId: body.facultyId ?? body.faculty,
  roomId: body.roomId ?? body.room,
  departmentId: body.departmentId ?? body.department,
  semester: body.semester,
  division: body.division,
  slotType: body.slotType,
  batch: body.batch,
  academicYear: body.academicYear,
  teachingDepartmentId: body.teachingDepartmentId ?? body.teachingDepartment,
  status: body.status,
  excludeSlotId: body.excludeSlotId ?? body.excludeSlot ?? null,
});

const validateRequiredSlotFields = (fields) => {
  const missing = [];
  if (!fields.day) missing.push("day");
  if (fields.period === undefined || fields.period === null || fields.period === "") {
    missing.push("period");
  }
  if (!fields.subjectId) missing.push("subject");
  if (!fields.facultyId) missing.push("faculty");
  if (!fields.roomId) missing.push("room");
  if (!fields.departmentId) missing.push("department");
  if (fields.semester === undefined || fields.semester === null || fields.semester === "") {
    missing.push("semester");
  }
  if (!fields.academicYear) missing.push("academicYear");
  if (!fields.division) missing.push("division");
  return missing;
};

const prepareSlotContext = async (fields) => {
  const resolvedType = normalizeSlotType(fields.slotType || "lecture");
  const resolvedBatch = isLecture(resolvedType)
    ? null
    : normalizeBatch(fields.batch);
  const resolvedTeachingDept =
    fields.teachingDepartmentId || fields.departmentId;

  const schedule = await SemesterSchedule.findOne({
    department: fields.departmentId,
    semester: fields.semester,
    academicYear: fields.academicYear,
  });
  SemesterSchedule.applyNormalizedDivisions(schedule);

  const divisionCheck = validateDivisionAndBatch(
    schedule,
    fields.division,
    resolvedType,
    fields.batch
  );
  if (!divisionCheck.ok) {
    return { ok: false, status: 400, message: divisionCheck.message };
  }

  if (schedule && !isClassColumn(schedule, fields.period)) {
    return {
      ok: false,
      status: 400,
      message: "This period is a break — cannot place a class here",
    };
  }

  return {
    ok: true,
    schedule,
    resolvedType,
    resolvedBatch,
    resolvedTeachingDept,
    division: divisionCheck.division,
  };
};

const runConflictCheck = async (fields, excludeSlotId = null) => {
  const ctx = await prepareSlotContext(fields);
  if (!ctx.ok) {
    return { validationError: ctx };
  }

  const conflicts = await checkConflicts(
    {
      day: fields.day,
      period: Number(fields.period),
      facultyId: fields.facultyId,
      roomId: fields.roomId,
      departmentId: fields.departmentId,
      semester: Number(fields.semester),
      division: ctx.division,
      slotType: ctx.resolvedType,
      batch: ctx.resolvedBatch,
      academicYear: fields.academicYear,
    },
    excludeSlotId
  );

  return { validationError: null, ctx, conflicts };
};

const validateDivisionAndBatch = (schedule, division, slotType, batch) => {
  const divisionCode = String(division || "").trim();
  if (!divisionCode) {
    return { ok: false, message: "division is required" };
  }
  const div = SemesterSchedule.findDivision(schedule, divisionCode);
  if (!div) {
    return { ok: false, message: `Unknown division: ${divisionCode}` };
  }
  if (isPractical(slotType)) {
    const normalized = normalizeBatch(batch);
    if (!normalized) {
      return { ok: false, message: "Batch is required for practical slots" };
    }
    const allowed = new Set(div.batches.map((b) => String(b).toUpperCase()));
    if (!allowed.has(normalized)) {
      return {
        ok: false,
        message: `Batch ${normalized} is not valid for division ${divisionCode}`,
      };
    }
  }
  return { ok: true, division: divisionCode };
};

const departmentIdFromBody = (req) =>
  Promise.resolve(extractSlotFields(req.body).departmentId);

const departmentIdFromSlotRecord = async (req) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return null;
  }
  const slot = await TimetableSlot.findById(req.params.id).select("department");
  return slot?.department ?? null;
};

router.post(
  "/check-conflicts",
  protect,
  adminOrHodDepartment(departmentIdFromBody),
  async (req, res, next) => {
  try {
    const fields = extractSlotFields(req.body);
    const missing = validateRequiredSlotFields(fields);
    if (missing.length > 0) {
      const list = missing.join(", ");
      return res.status(400).json({
        success: false,
        message: `${list} are required`,
      });
    }

    const excludeSlotId =
      fields.excludeSlotId && mongoose.Types.ObjectId.isValid(fields.excludeSlotId)
        ? fields.excludeSlotId
        : null;

    const { validationError, conflicts } = await runConflictCheck(
      fields,
      excludeSlotId
    );
    if (validationError) {
      return res
        .status(validationError.status)
        .json({ success: false, message: validationError.message });
    }

    if (conflicts.length > 0) {
      return res.status(409).json({ hasConflicts: true, conflicts });
    }

    res.json({ hasConflicts: false, conflicts: [] });
  } catch (err) {
    next(err);
  }
}
);

router.post(
  "/slot",
  protect,
  adminOrHodDepartment(departmentIdFromBody),
  async (req, res, next) => {
  try {
    const fields = extractSlotFields(req.body);
    const missing = validateRequiredSlotFields(fields);
    if (missing.length > 0) {
      const list = missing.join(", ");
      return res.status(400).json({
        success: false,
        message: `${list} are required`,
      });
    }

    const { validationError, ctx, conflicts } = await runConflictCheck(fields);
    if (validationError) {
      return res
        .status(validationError.status)
        .json({ success: false, message: validationError.message });
    }
    if (conflicts.length > 0) {
      return res.status(409).json({ hasConflicts: true, conflicts });
    }

    const slot = await TimetableSlot.create({
      day: fields.day,
      period: fields.period,
      subject: fields.subjectId,
      faculty: fields.facultyId,
      room: fields.roomId,
      department: fields.departmentId,
      teachingDepartment: ctx.resolvedTeachingDept,
      semester: fields.semester,
      academicYear: fields.academicYear,
      division: ctx.division,
      slotType: ctx.resolvedType,
      batch: ctx.resolvedBatch,
      status: fields.status || "draft",
    });

    const populated = await populateSlot(TimetableSlot.findById(slot._id));
    await invalidateTimetable(
      fields.departmentId,
      fields.semester,
      fields.academicYear
    );
    res.status(201).json({ success: true, slot: populated });
  } catch (err) {
    next(err);
  }
}
);

router.put(
  "/slot/:id",
  protect,
  adminOrHodDepartment(departmentIdFromSlotRecord),
  async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid slot id" });
    }

    const existing = await TimetableSlot.findById(id);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Slot not found" });
    }

    const body = extractSlotFields(req.body);
    const fields = {
      day: body.day ?? existing.day,
      period: body.period ?? existing.period,
      subjectId: body.subjectId ?? existing.subject,
      facultyId: body.facultyId ?? existing.faculty,
      roomId: body.roomId ?? existing.room,
      departmentId: existing.department,
      semester: existing.semester,
      division: body.division ?? existing.division,
      slotType: body.slotType ?? existing.slotType,
      batch: body.batch !== undefined ? body.batch : existing.batch,
      academicYear: body.academicYear ?? existing.academicYear,
      teachingDepartmentId:
        body.teachingDepartmentId ??
        existing.teachingDepartment ??
        existing.department,
      status: body.status,
    };

    const { validationError, ctx, conflicts } = await runConflictCheck(
      fields,
      id
    );
    if (validationError) {
      return res
        .status(validationError.status)
        .json({ success: false, message: validationError.message });
    }
    if (conflicts.length > 0) {
      return res.status(409).json({ hasConflicts: true, conflicts });
    }

    Object.assign(existing, {
      day: fields.day,
      period: fields.period,
      academicYear: fields.academicYear,
      faculty: fields.facultyId,
      room: fields.roomId,
      teachingDepartment: ctx.resolvedTeachingDept,
      slotType: ctx.resolvedType,
      batch: ctx.resolvedBatch,
      division: ctx.division,
    });
    if (fields.subjectId) existing.subject = fields.subjectId;
    if (fields.status) existing.status = fields.status;
    await existing.save();

    const populated = await populateSlot(TimetableSlot.findById(existing._id));
    await invalidateTimetable(
      existing.department,
      existing.semester,
      existing.academicYear
    );
    res.status(200).json({ success: true, slot: populated });
  } catch (err) {
    next(err);
  }
}
);

router.delete(
  "/slot/:id",
  protect,
  adminOrHodDepartment(departmentIdFromSlotRecord),
  async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid slot id" });
    }

    const deleted = await TimetableSlot.findByIdAndDelete(id);
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Slot not found" });
    }
    await invalidateTimetable(
      deleted.department,
      deleted.semester,
      deleted.academicYear
    );
    res.json({ success: true, message: "Slot deleted" });
  } catch (err) {
    next(err);
  }
}
);

router.post(
  "/publish/:departmentId/:semester",
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

      const filter = {
        department: departmentId,
        semester: sem,
        status: "draft",
      };
      if (req.body?.academicYear) {
        filter.academicYear = req.body.academicYear;
      }
      const division =
        req.body?.division || req.query?.division;
      if (division) {
        filter.division = String(division).trim();
      }

      const result = await TimetableSlot.updateMany(filter, {
        $set: { status: "published" },
      });

      if (filter.academicYear) {
        await invalidateTimetable(departmentId, sem, filter.academicYear);
      }

      res.json({
        success: true,
        message: `${result.modifiedCount} slot(s) published`,
        modifiedCount: result.modifiedCount,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/:departmentId/statuses",
  protect,
  departmentAccess,
  async (req, res, next) => {
    try {
      const { departmentId } = req.params;
      const { academicYear } = req.query;

      if (!mongoose.Types.ObjectId.isValid(departmentId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid departmentId" });
      }
      if (!academicYear) {
        return res.status(400).json({
          success: false,
          message: "academicYear query parameter is required",
        });
      }

      const grouped = await TimetableSlot.aggregate([
        {
          $match: {
            department: new mongoose.Types.ObjectId(departmentId),
            academicYear,
          },
        },
        {
          $group: {
            _id: "$semester",
            total: { $sum: 1 },
            published: {
              $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] },
            },
          },
        },
      ]);

      const statuses = {};
      for (let sem = 1; sem <= 8; sem += 1) {
        statuses[sem] = "draft";
      }
      for (const row of grouped) {
        statuses[row._id] =
          row.total > 0 && row.published === row.total ? "published" : "draft";
      }

      res.json({ success: true, statuses });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/:departmentId/:semester/conflicts",
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
      const filter = { department: departmentId, semester: sem };
      if (req.query.academicYear) filter.academicYear = req.query.academicYear;
      if (req.query.division) {
        filter.division = String(req.query.division).trim();
      }

      const deptSlots = await populateSlot(TimetableSlot.find(filter)).lean();

      if (deptSlots.length === 0) {
        return res.json({ success: true, count: 0, conflicts: [] });
      }

      const academicYear = req.query.academicYear;
      const timePairs = [
        ...new Map(
          deptSlots.map((s) => [
            `${s.day}\0${s.period}`,
            { day: s.day, period: Number(s.period) },
          ])
        ).values(),
      ];

      const globalSlots = await populateSlot(
        TimetableSlot.find({
          academicYear,
          $or: timePairs,
        })
      ).lean();

      const conflictMap = detectIntraCellConflicts(deptSlots);

      for (const slot of deptSlots) {
        const key = slot._id.toString();
        const reasons = [];

        const globalConflicts = checkConflictsInMemory(
          {
            day: slot.day,
            period: slot.period,
            facultyId: slot.faculty?._id || slot.faculty,
            roomId: slot.room?._id || slot.room,
            departmentId: slot.department?._id || slot.department,
            semester: slot.semester,
            division: slot.division,
            slotType: slot.slotType,
            batch: slot.batch,
            academicYear: slot.academicYear,
          },
          slot._id,
          globalSlots
        );

        for (const c of globalConflicts) {
          reasons.push({
            type: c.type,
            message: c.message,
            existingSlot: c.existingSlot,
          });
        }

        const intra = conflictMap.get(key);
        if (intra?.reasons?.length) {
          reasons.push(...intra.reasons);
        }

        if (reasons.length > 0) {
          conflictMap.set(key, { slotId: key, reasons });
        }
      }

      res.json({
        success: true,
        count: conflictMap.size,
        conflicts: Array.from(conflictMap.values()),
      });
    } catch (err) {
      next(err);
    }
  }
);

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

      const academicYear = req.query.academicYear;
      const divisionFilter = req.query.division
        ? String(req.query.division).trim()
        : null;
      const statusFilter = req.query.status || null;

      let cacheKey = null;
      if (academicYear) {
        cacheKey = keys.timetable(departmentId, sem, academicYear);
        const cached = await cacheGet(cacheKey);
        if (cached?.slots) {
          let slots = cached.slots;
          if (divisionFilter) {
            slots = slots.filter((s) => s.division === divisionFilter);
          }
          if (statusFilter) {
            slots = slots.filter((s) => s.status === statusFilter);
          }
          return res.json({ success: true, count: slots.length, slots });
        }
      }

      const filter = { department: departmentId, semester: sem };
      if (academicYear) filter.academicYear = academicYear;

      const allSlots = await populateSlot(TimetableSlot.find(filter)).sort({
        day: 1,
        period: 1,
        batch: 1,
      });

      if (cacheKey) {
        await cacheSet(cacheKey, {
          success: true,
          count: allSlots.length,
          slots: allSlots,
        });
      }

      let slots = allSlots;
      if (divisionFilter) {
        slots = slots.filter((s) => s.division === divisionFilter);
      }
      if (statusFilter) {
        slots = slots.filter((s) => s.status === statusFilter);
      }

      const payload = { success: true, count: slots.length, slots };
      res.json(payload);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
