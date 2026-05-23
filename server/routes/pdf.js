const express = require("express");
const mongoose = require("mongoose");

const Department = require("../models/Department");
const TimetableSlot = require("../models/TimetableSlot");
const FacultyAssignment = require("../models/FacultyAssignment");
const SemesterSchedule = require("../models/SemesterSchedule");
const Subject = require("../models/Subject");
const { protect, departmentAccess } = require("../middleware/auth");

const router = express.Router();

const DAYS = TimetableSlot.schema.path("day").enumValues;

router.get(
  "/:departmentId/:semester",
  protect,
  departmentAccess,
  async (req, res, next) => {
    try {
      const { departmentId, semester } = req.params;

      if (!mongoose.Types.ObjectId.isValid(departmentId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid departmentId" });
      }

      const sem = Number(semester);
      if (Number.isNaN(sem) || sem < 1 || sem > 8) {
        return res
          .status(400)
          .json({ success: false, message: "semester must be between 1 and 8" });
      }

      const academicYear = req.query.academicYear || "2025-26";

      const department = await Department.findById(departmentId)
        .populate("hod", "name email")
        .lean();

      if (!department) {
        return res
          .status(404)
          .json({ success: false, message: "Department not found" });
      }

      const schedule = await SemesterSchedule.findOrCreateDefault({
        department: departmentId,
        semester: sem,
        academicYear,
      });

      const divisions = SemesterSchedule.normalizeDivisions(schedule);
      const divisionParam = req.query.division
        ? String(req.query.division).trim()
        : divisions[0]?.code || "";
      const activeDivision =
        divisions.find((d) => d.code === divisionParam) || divisions[0] || null;

      if (!activeDivision) {
        return res.status(400).json({
          success: false,
          message: "No divisions configured for this semester",
        });
      }

      const slots = await TimetableSlot.find({
        department: departmentId,
        semester: sem,
        academicYear,
        division: activeDivision.code,
      })
        .populate("subject", "name code theoryHours tutorialHours practicalHours")
        .populate("faculty", "name email shortCode")
        .populate("room", "name type capacity")
        .populate("teachingDepartment", "name code")
        .sort({ day: 1, period: 1, batch: 1 })
        .lean();

      const slotsByDay = {};
      const slotsByCell = {};
      for (const day of DAYS) {
        slotsByDay[day] = [];
        slotsByCell[day] = {};
      }
      for (const slot of slots) {
        if (slotsByDay[slot.day]) {
          slotsByDay[slot.day].push(slot);
          if (!slotsByCell[slot.day][slot.period]) {
            slotsByCell[slot.day][slot.period] = [];
          }
          slotsByCell[slot.day][slot.period].push(slot);
        }
      }

      const facultyAssignments = await FacultyAssignment.find({
        department: departmentId,
        semester: sem,
        academicYear,
      })
        .populate("faculty", "name email shortCode")
        .populate("subject", "name code weeklyCount theoryHours tutorialHours practicalHours")
        .sort({ "faculty.name": 1 })
        .lean();

      const subjects = await Subject.find({
        department: departmentId,
        semester: sem,
      }).lean();

      const teachersBySubject = new Map();
      for (const a of facultyAssignments) {
        const sid = String(a.subject?._id || a.subject || "");
        if (!sid) continue;
        if (!teachersBySubject.has(sid)) teachersBySubject.set(sid, new Set());
        const facultyName = a.faculty?.name;
        if (facultyName) teachersBySubject.get(sid).add(facultyName);
      }

      const subjectSummary = subjects
        .map((s) => {
          const teachers = Array.from(
            teachersBySubject.get(String(s._id)) || []
          );
          const theory = Number(s.theoryHours) || 0;
          const tutorial = Number(s.tutorialHours) || 0;
          const practical = Number(s.practicalHours) || 0;
          return {
            _id: s._id,
            name: s.name,
            code: s.code,
            teacher: teachers.join(", ") || "—",
            theory,
            tutorial,
            practical,
            total: theory + tutorial + practical,
          };
        })
        .sort((a, b) => a.code.localeCompare(b.code));

      const totals = subjectSummary.reduce(
        (acc, r) => {
          acc.theory += r.theory;
          acc.tutorial += r.tutorial;
          acc.practical += r.practical;
          acc.total += r.total;
          return acc;
        },
        { theory: 0, tutorial: 0, practical: 0, total: 0 }
      );

      res.json({
        success: true,
        department: {
          _id: department._id,
          name: department.name,
          code: department.code,
          totalSemesters: department.totalSemesters,
          hod: department.hod,
        },
        semester: sem,
        academicYear,
        schedule,
        division: activeDivision,
        slotsByDay,
        slotsByCell,
        facultyAssignments,
        subjectSummary,
        summaryTotals: totals,
        meta: {
          totalSlots: slots.length,
          division: activeDivision.code,
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
