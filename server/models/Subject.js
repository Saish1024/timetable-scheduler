const mongoose = require("mongoose");

const SEMESTER_MIN = 1;
const SEMESTER_MAX = 8;

const subjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Subject name is required"],
      trim: true,
    },
    code: {
      type: String,
      required: [true, "Subject code is required"],
      uppercase: true,
      trim: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: [true, "Department is required"],
    },
    semester: {
      type: Number,
      required: [true, "Semester is required"],
      min: [SEMESTER_MIN, `Semester must be between ${SEMESTER_MIN} and ${SEMESTER_MAX}`],
      max: [SEMESTER_MAX, `Semester must be between ${SEMESTER_MIN} and ${SEMESTER_MAX}`],
    },
    theoryHours: {
      type: Number,
      default: 0,
      min: [0, "Theory hours cannot be negative"],
    },
    tutorialHours: {
      type: Number,
      default: 0,
      min: [0, "Tutorial hours cannot be negative"],
    },
    practicalHours: {
      type: Number,
      default: 0,
      min: [0, "Practical hours cannot be negative"],
    },
    weeklyCount: {
      type: Number,
      default: 0,
      min: [0, "Weekly count cannot be negative"],
    },
  },
  { timestamps: true }
);

subjectSchema.pre("validate", function setWeeklyCount(next) {
  const theory = Number(this.theoryHours) || 0;
  const tutorial = Number(this.tutorialHours) || 0;
  const practical = Number(this.practicalHours) || 0;
  const sum = theory + tutorial + practical;
  if (sum > 0) {
    this.weeklyCount = sum;
  } else if (!this.weeklyCount) {
    this.weeklyCount = 0;
  }
  next();
});

subjectSchema.virtual("totalHours").get(function totalHours() {
  return (
    (Number(this.theoryHours) || 0) +
    (Number(this.tutorialHours) || 0) +
    (Number(this.practicalHours) || 0)
  );
});

subjectSchema.set("toJSON", { virtuals: true });
subjectSchema.set("toObject", { virtuals: true });

subjectSchema.index({ department: 1, semester: 1 });
subjectSchema.index({ department: 1, code: 1, semester: 1 }, { unique: true });

module.exports = mongoose.model("Subject", subjectSchema);
module.exports.SEMESTER_MIN = SEMESTER_MIN;
module.exports.SEMESTER_MAX = SEMESTER_MAX;
