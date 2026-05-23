const mongoose = require("mongoose");

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Department name is required"],
      unique: true,
      trim: true,
    },
    code: {
      type: String,
      required: [true, "Department code is required"],
      unique: true,
      uppercase: true,
      trim: true,
    },
    hod: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    totalSemesters: {
      type: Number,
      default: 8,
      min: [1, "Total semesters must be at least 1"],
      max: [8, "Total semesters cannot exceed 8"],
    },
    divisions: {
      type: [String],
      default: ["A", "B"],
    },
    batches: {
      type: [String],
      default: ["Batch A", "Batch B", "Batch C"],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Department", departmentSchema);
