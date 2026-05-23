const mongoose = require("mongoose");

const SEMESTER_MIN = 1;
const SEMESTER_MAX = 8;

const facultyAssignmentSchema = new mongoose.Schema(
  {
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Faculty",
      required: [true, "Faculty is required"],
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: [true, "Subject is required"],
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
    academicYear: {
      type: String,
      required: [true, "Academic year is required"],
      trim: true,
    },
  },
  { timestamps: true }
);

facultyAssignmentSchema.index(
  { faculty: 1, subject: 1, academicYear: 1 },
  { unique: true }
);
facultyAssignmentSchema.index({ department: 1, semester: 1, academicYear: 1 });

module.exports = mongoose.model("FacultyAssignment", facultyAssignmentSchema);
