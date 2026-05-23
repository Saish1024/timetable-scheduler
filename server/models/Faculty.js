const mongoose = require("mongoose");

const facultySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Faculty name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Faculty email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    shortCode: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [6, "Short code must be 6 characters or fewer"],
      default: "",
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: [true, "Department is required"],
    },
    maxPeriodsPerWeek: {
      type: Number,
      default: 30,
      min: [1, "Max periods per week must be at least 1"],
    },
  },
  { timestamps: true }
);

facultySchema.index({ department: 1 });
facultySchema.index(
  { department: 1, shortCode: 1 },
  {
    unique: true,
    partialFilterExpression: { shortCode: { $type: "string", $ne: "" } },
  }
);

module.exports = mongoose.model("Faculty", facultySchema);
