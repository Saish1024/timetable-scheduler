const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Room name is required"],
      unique: true,
      trim: true,
    },
    capacity: {
      type: Number,
      required: [true, "Room capacity is required"],
      min: [1, "Capacity must be at least 1"],
    },
    type: {
      type: String,
      enum: {
        values: ["lecture", "lab", "seminar"],
        message: "Type must be one of: lecture, lab, seminar",
      },
      required: [true, "Room type is required"],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Room", roomSchema);
