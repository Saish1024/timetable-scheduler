const mongoose = require("mongoose");
const {
  batchCodesFromDepartment,
  buildDivisionsFromDepartment,
  divisionToCode,
} = require("../utils/departmentConfig");

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SEMESTER_MIN = 1;
const SEMESTER_MAX = 8;

const COLUMN_KINDS = ["class", "short_break", "lunch_break"];

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const columnSchema = new mongoose.Schema(
  {
    index: { type: Number, required: true, min: 1 },
    kind: {
      type: String,
      enum: COLUMN_KINDS,
      required: true,
    },
    startTime: {
      type: String,
      required: true,
      match: [TIME_REGEX, "startTime must be HH:MM (24h)"],
    },
    endTime: {
      type: String,
      required: true,
      match: [TIME_REGEX, "endTime must be HH:MM (24h)"],
    },
    label: { type: String, default: "" },
  },
  { _id: false }
);

const divisionSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true },
    label: { type: String, default: "" },
    batches: { type: [String], default: ["A", "B", "C"] },
  },
  { _id: false }
);

const DEFAULT_BATCHES = ["A", "B", "C"];
const SINGLE_CLASS_CODE = "Class";
const CLASS_MODES = ["single", "multi"];

const normalizeBatchList = (batches) =>
  (Array.isArray(batches) ? batches : [])
    .map((b) => String(b).trim().toUpperCase())
    .filter(Boolean);

const semesterScheduleSchema = new mongoose.Schema(
  {
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },
    semester: {
      type: Number,
      required: true,
      min: SEMESTER_MIN,
      max: SEMESTER_MAX,
    },
    academicYear: { type: String, required: true, trim: true },

    workingDays: {
      type: [String],
      enum: DAYS,
      default: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    },
    batches: { type: [String], default: DEFAULT_BATCHES },
    divisions: { type: [divisionSchema], default: [] },
    classMode: {
      type: String,
      enum: CLASS_MODES,
      default: "single",
    },

    columns: { type: [columnSchema], default: [] },

    classAdvisor: { type: String, default: "" },
    division: { type: String, default: "" },
    wef: { type: Date, default: null },
    titleLabel: { type: String, default: "" },
  },
  { timestamps: true }
);

semesterScheduleSchema.index(
  { department: 1, semester: 1, academicYear: 1 },
  { unique: true }
);

/**
 * Default schedule modeled after a typical college layout:
 * P1 09:00-10:00, P2 10:00-11:00, SHORT BREAK 11:00-11:20,
 * P3 11:20-12:20, P4 12:20-13:20, LUNCH 13:20-14:00,
 * P5 14:00-15:00, P6 15:00-16:00, P7 16:00-17:00, P8 17:00-18:00.
 */
const buildDefaultColumns = () => [
  { index: 1, kind: "class", startTime: "09:00", endTime: "10:00", label: "" },
  { index: 2, kind: "class", startTime: "10:00", endTime: "11:00", label: "" },
  {
    index: 3,
    kind: "short_break",
    startTime: "11:00",
    endTime: "11:20",
    label: "SHORT BREAK",
  },
  { index: 4, kind: "class", startTime: "11:20", endTime: "12:20", label: "" },
  { index: 5, kind: "class", startTime: "12:20", endTime: "13:20", label: "" },
  {
    index: 6,
    kind: "lunch_break",
    startTime: "13:20",
    endTime: "14:00",
    label: "LUNCH BREAK",
  },
  { index: 7, kind: "class", startTime: "14:00", endTime: "15:00", label: "" },
  { index: 8, kind: "class", startTime: "15:00", endTime: "16:00", label: "" },
  { index: 9, kind: "class", startTime: "16:00", endTime: "17:00", label: "" },
  { index: 10, kind: "class", startTime: "17:00", endTime: "18:00", label: "" },
];

semesterScheduleSchema.statics.buildDefaultColumns = buildDefaultColumns;

semesterScheduleSchema.statics.inferClassMode = function inferClassMode(doc) {
  if (doc.classMode === "single" || doc.classMode === "multi") {
    return doc.classMode;
  }
  const divs = Array.isArray(doc.divisions) ? doc.divisions : [];
  if (divs.length > 1) return "multi";
  if (divs.length === 1 && divs[0].code === SINGLE_CLASS_CODE) return "single";
  if (divs.length === 1) return "multi";
  return "single";
};

const fallbackBatches = (department) =>
  department
    ? batchCodesFromDepartment(department)
    : [...DEFAULT_BATCHES];

semesterScheduleSchema.statics.normalizeDivisions = function normalizeDivisions(
  schedule,
  department = null
) {
  if (!schedule) return [];
  const doc = schedule.toObject ? schedule.toObject() : schedule;
  const classMode = this.inferClassMode(doc);
  const defaultBatches = fallbackBatches(department);

  let divisions = [];
  if (Array.isArray(doc.divisions) && doc.divisions.length > 0) {
    divisions = doc.divisions.map((d) => ({
      code: String(d.code || "").trim(),
      label: String(d.label || "").trim(),
      batches: normalizeBatchList(d.batches).length
        ? normalizeBatchList(d.batches)
        : [...defaultBatches],
    }));
  } else {
    const legacyBatches = normalizeBatchList(doc.batches);
    const batches = legacyBatches.length ? legacyBatches : [...defaultBatches];
    const legacyDivision = String(doc.division || "").trim();

    if (legacyDivision && /[\/,]/.test(legacyDivision)) {
      divisions = legacyDivision
        .split(/[\/,]/)
        .map((part) => part.trim())
        .filter(Boolean)
        .map((code) => ({ code, label: "", batches: [...batches] }));
    } else {
      divisions = [
        {
          code: legacyDivision || SINGLE_CLASS_CODE,
          label: "",
          batches: [...batches],
        },
      ];
    }
  }

  if (classMode === "single") {
    const batches =
      normalizeBatchList(divisions[0]?.batches).length > 0
        ? normalizeBatchList(divisions[0].batches)
        : [...defaultBatches];
    return [{ code: SINGLE_CLASS_CODE, label: "", batches }];
  }

  if (divisions.length > 1) return divisions;

  if (divisions.length) return divisions;

  if (department) {
    return buildDivisionsFromDepartment(department, { classMode });
  }

  return [{ code: divisionToCode("A"), label: "", batches: [...defaultBatches] }];
};

semesterScheduleSchema.statics.applyNormalizedDivisions = function applyNormalizedDivisions(
  schedule,
  department = null
) {
  if (!schedule) return schedule;
  const doc = schedule.toObject ? schedule.toObject() : schedule;
  const classMode = this.inferClassMode(doc);
  const divisions = this.normalizeDivisions(schedule, department);
  if (schedule.set) {
    schedule.set("classMode", classMode);
    schedule.set("divisions", divisions);
  } else {
    schedule.classMode = classMode;
    schedule.divisions = divisions;
  }
  return schedule;
};

semesterScheduleSchema.statics.findDivision = function findDivision(
  schedule,
  code
) {
  const divisions = this.normalizeDivisions(schedule);
  const normalized = String(code || "").trim();
  return divisions.find((d) => d.code === normalized) || null;
};

semesterScheduleSchema.statics.findOrCreateDefault = async function ({
  department,
  semester,
  academicYear,
}) {
  const Department = mongoose.model("Department");
  const deptDoc = await Department.findById(department).lean();

  let schedule = await this.findOne({ department, semester, academicYear });
  if (schedule) {
    return this.applyNormalizedDivisions(schedule, deptDoc);
  }

  const divNames = Array.isArray(deptDoc?.divisions) ? deptDoc.divisions : [];
  const classMode = divNames.length > 1 ? "multi" : "single";
  schedule = await this.create({
    department,
    semester,
    academicYear,
    columns: buildDefaultColumns(),
    classMode,
    divisions: buildDivisionsFromDepartment(deptDoc, { classMode }),
  });
  return this.applyNormalizedDivisions(schedule, deptDoc);
};

module.exports = mongoose.model("SemesterSchedule", semesterScheduleSchema);
module.exports.DAYS = DAYS;
module.exports.COLUMN_KINDS = COLUMN_KINDS;
module.exports.SEMESTER_MIN = SEMESTER_MIN;
module.exports.SEMESTER_MAX = SEMESTER_MAX;
module.exports.DEFAULT_BATCHES = DEFAULT_BATCHES;
module.exports.SINGLE_CLASS_CODE = SINGLE_CLASS_CODE;
module.exports.CLASS_MODES = CLASS_MODES;
