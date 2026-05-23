const express = require("express");
const mongoose = require("mongoose");

const Room = require("../models/Room");
const TimetableSlot = require("../models/TimetableSlot");
const { protect, adminOnly } = require("../middleware/auth");

const router = express.Router();

router.get("/", protect, async (req, res, next) => {
  try {
    const rooms = await Room.find().sort({ name: 1 }).lean();
    res.json({ success: true, count: rooms.length, rooms });
  } catch (err) {
    next(err);
  }
});

router.post("/", protect, adminOnly, async (req, res, next) => {
  try {
    const { name, capacity, type } = req.body;
    if (!name || capacity === undefined || !type) {
      return res.status(400).json({
        success: false,
        message: "name, capacity and type are required",
      });
    }

    const room = await Room.create({ name, capacity, type });
    res.status(201).json({ success: true, room });
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
        .json({ success: false, message: "Invalid room id" });
    }

    const room = await Room.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!room) {
      return res
        .status(404)
        .json({ success: false, message: "Room not found" });
    }
    res.json({ success: true, room });
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
        .json({ success: false, message: "Invalid room id" });
    }

    const assignedCount = await TimetableSlot.countDocuments({ room: id });
    if (assignedCount > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete room: ${assignedCount} timetable slot(s) still reference this room`,
      });
    }

    const deleted = await Room.findByIdAndDelete(id);
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Room not found" });
    }
    res.json({ success: true, message: "Room deleted" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
