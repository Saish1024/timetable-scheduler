const mongoose = require("mongoose");

const SEMESTER_MIN = 1;
const SEMESTER_MAX = 8;

const changeRequestSchema = new mongoose.Schema(
  {
    slot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TimetableSlot",
      required: [true, "Slot is required"],
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Requester is required"],
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
    reason: {
      type: String,
      required: [true, "Reason is required"],
      trim: true,
    },
    status: {
      type: String,
      enum: {
        values: ["pending", "approved", "rejected"],
        message: "Status must be one of: pending, approved, rejected",
      },
      default: "pending",
    },
    adminNote: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

changeRequestSchema.index({ status: 1, createdAt: -1 });
changeRequestSchema.index({ requestedBy: 1, status: 1 });
changeRequestSchema.index({ department: 1, semester: 1, status: 1 });

module.exports = mongoose.model("ChangeRequest", changeRequestSchema);
