const mongoose = require("mongoose");
const {
  SLOT_TYPES,
  normalizeSlotType,
  isLecture,
  isPractical,
} = require("../utils/slotTypes");

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PERIODS = 10;
const SEMESTER_MIN = 1;
const SEMESTER_MAX = 8;

const timetableSlotSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      enum: { values: DAYS, message: "Day must be Monday–Saturday" },
      required: [true, "Day is required"],
    },
    period: {
      type: Number,
      required: [true, "Period is required"],
      min: [1, "Period must be at least 1"],
      max: [PERIODS, `Period must be at most ${PERIODS}`],
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: [true, "Subject is required"],
    },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Faculty",
      required: [true, "Faculty is required"],
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: [true, "Room is required"],
    },
    /** Student's department (timetable owner). */
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: [true, "Department is required"],
    },
    /** Department whose faculty is teaching (may differ from student department). */
    teachingDepartment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: [true, "Teaching department is required"],
    },
    semester: {
      type: Number,
      required: [true, "Semester is required"],
      min: [SEMESTER_MIN, `Semester must be between ${SEMESTER_MIN} and ${SEMESTER_MAX}`],
      max: [SEMESTER_MAX, `Semester must be between ${SEMESTER_MIN} and ${SEMESTER_MAX}`],
    },
    academicYear: {
      type: String,
      required: [true, "Academic year is required"],
      trim: true,
    },
    /** Timetable division (e.g. Division A, Class). */
    division: {
      type: String,
      required: [true, "Division is required"],
      trim: true,
    },
    slotType: {
      type: String,
      enum: {
        values: [...SLOT_TYPES, "theory", "tutorial"],
        message: "slotType must be lecture or practical",
      },
      default: "lecture",
      required: true,
    },
    batch: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    status: {
      type: String,
      enum: { values: ["draft", "published"], message: "Status must be draft or published" },
      default: "draft",
    },
  },
  { timestamps: true }
);

timetableSlotSchema.pre("validate", function normalizeSlotFields(next) {
  this.slotType = normalizeSlotType(this.slotType);

  if (!this.teachingDepartment && this.department) {
    this.teachingDepartment = this.department;
  }

  if (isLecture(this.slotType)) {
    this.batch = null;
  } else if (isPractical(this.slotType) && !this.batch) {
    return next(new Error("Batch is required for practical slots"));
  }

  next();
});

timetableSlotSchema.index({ department: 1, semester: 1, academicYear: 1 });
timetableSlotSchema.index({ faculty: 1, day: 1, period: 1, academicYear: 1 });
timetableSlotSchema.index({ room: 1, day: 1, period: 1, academicYear: 1 });
timetableSlotSchema.index({ day: 1, period: 1, faculty: 1, academicYear: 1 });
timetableSlotSchema.index({ day: 1, period: 1, room: 1, academicYear: 1 });
timetableSlotSchema.index({
  day: 1,
  period: 1,
  department: 1,
  semester: 1,
  division: 1,
  academicYear: 1,
});
timetableSlotSchema.index({
  day: 1,
  period: 1,
  department: 1,
  semester: 1,
  division: 1,
  batch: 1,
  academicYear: 1,
});
timetableSlotSchema.index({
  department: 1,
  semester: 1,
  academicYear: 1,
  status: 1,
});

module.exports = mongoose.model("TimetableSlot", timetableSlotSchema);
module.exports.DAYS = DAYS;
module.exports.PERIODS = PERIODS;
module.exports.SEMESTER_MIN = SEMESTER_MIN;
module.exports.SEMESTER_MAX = SEMESTER_MAX;
module.exports.SLOT_TYPES = SLOT_TYPES;
