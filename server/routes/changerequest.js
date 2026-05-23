const express = require("express");
const mongoose = require("mongoose");

const ChangeRequest = require("../models/ChangeRequest");
const TimetableSlot = require("../models/TimetableSlot");
const { protect, adminOnly } = require("../middleware/auth");

const router = express.Router();

const populateRequest = (query) =>
  query
    .populate({
      path: "slot",
      populate: [
        { path: "subject", select: "name code" },
        { path: "faculty", select: "name email" },
        { path: "room", select: "name type" },
        { path: "department", select: "name code" },
      ],
    })
    .populate("requestedBy", "name email role")
    .populate("department", "name code")
    .lean();

router.post("/", protect, async (req, res, next) => {
  try {
    const { slot, reason } = req.body;

    if (!slot || !reason) {
      return res.status(400).json({
        success: false,
        message: "slot and reason are required",
      });
    }
    if (!mongoose.Types.ObjectId.isValid(slot)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid slot id" });
    }

    const slotDoc = await TimetableSlot.findById(slot);
    if (!slotDoc) {
      return res
        .status(404)
        .json({ success: false, message: "Slot not found" });
    }

    const changeRequest = await ChangeRequest.create({
      slot,
      requestedBy: req.user._id,
      department: slotDoc.department,
      semester: slotDoc.semester,
      reason,
    });

    const populated = await populateRequest(
      ChangeRequest.findById(changeRequest._id)
    );
    res.status(201).json({ success: true, changeRequest: populated });
  } catch (err) {
    next(err);
  }
});

router.get("/admin/pending", protect, adminOnly, async (req, res, next) => {
  try {
    const filter = { status: "pending" };
    const requests = await populateRequest(ChangeRequest.find(filter)).sort({
      createdAt: -1,
    });
    res.json({ success: true, count: requests.length, requests });
  } catch (err) {
    next(err);
  }
});

router.get("/:departmentId", protect, async (req, res, next) => {
  try {
    const { departmentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(departmentId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid departmentId" });
    }

    const slotIds = await TimetableSlot.find({
      department: departmentId,
    }).distinct("_id");

    const filter = { slot: { $in: slotIds } };
    if (req.query.status) filter.status = req.query.status;

    const requests = await populateRequest(ChangeRequest.find(filter)).sort({
      createdAt: -1,
    });

    res.json({ success: true, count: requests.length, requests });
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
        .json({ success: false, message: "Invalid change request id" });
    }

    const { status, adminNote } = req.body;
    if (!status || !["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "status must be 'approved' or 'rejected'",
      });
    }

    const changeRequest = await ChangeRequest.findById(id);
    if (!changeRequest) {
      return res
        .status(404)
        .json({ success: false, message: "Change request not found" });
    }

    if (changeRequest.status !== "pending") {
      return res.status(409).json({
        success: false,
        message: `Change request already ${changeRequest.status}`,
      });
    }

    changeRequest.status = status;
    if (typeof adminNote === "string") {
      changeRequest.adminNote = adminNote;
    }
    await changeRequest.save();

    const populated = await populateRequest(
      ChangeRequest.findById(changeRequest._id)
    );
    res.json({ success: true, changeRequest: populated });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
