const dotenv = require("dotenv");
const mongoose = require("mongoose");

const User = require("./models/User");
const Department = require("./models/Department");
const Faculty = require("./models/Faculty");
const Subject = require("./models/Subject");
const Room = require("./models/Room");
const FacultyAssignment = require("./models/FacultyAssignment");
const TimetableSlot = require("./models/TimetableSlot");
const ChangeRequest = require("./models/ChangeRequest");
const SemesterSchedule = require("./models/SemesterSchedule");
const { normalizeSlotType } = require("./utils/slotTypes");

dotenv.config();

const ACADEMIC_YEAR = "2025-26";

const CREDENTIALS = {
  admin: { email: "admin@college.com", password: "Admin@123" },
  hodCs: { email: "hod.cs@college.com", password: "Hod@123" },
  hodIt: { email: "hod.it@college.com", password: "Hod@123" },
};

const printCredentials = () => {
  console.log("\n" + "=".repeat(56));
  console.log("  SEED COMPLETE — LOGIN CREDENTIALS");
  console.log("=".repeat(56));
  console.log("\n  Admin");
  console.log(`    Email:    ${CREDENTIALS.admin.email}`);
  console.log(`    Password: ${CREDENTIALS.admin.password}`);
  console.log("\n  HOD — Computer Science");
  console.log(`    Email:    ${CREDENTIALS.hodCs.email}`);
  console.log(`    Password: ${CREDENTIALS.hodCs.password}`);
  console.log("\n  HOD — Information Technology");
  console.log(`    Email:    ${CREDENTIALS.hodIt.email}`);
  console.log(`    Password: ${CREDENTIALS.hodIt.password}`);
  console.log("\n" + "-".repeat(56));
  console.log(`  Academic year: ${ACADEMIC_YEAR}`);
  console.log("  CS Sem 1: 6 subjects (mixed theory/tut/practical),");
  console.log("            5 faculty with short codes, 4 assignments,");
  console.log("            schedule + sample multi-batch slots loaded");
  console.log("  Rooms: Room 101, Room 102, Lab A, Lab B, Lab C");
  console.log("=".repeat(56) + "\n");
};

const seed = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) throw new Error("MONGO_URI is not defined in .env");

    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    await Promise.all([
      User.deleteMany({}),
      Department.deleteMany({}),
      Faculty.deleteMany({}),
      Subject.deleteMany({}),
      Room.deleteMany({}),
      FacultyAssignment.deleteMany({}),
      TimetableSlot.deleteMany({}),
      ChangeRequest.deleteMany({}),
      SemesterSchedule.deleteMany({}),
    ]);
    console.log("Cleared existing data");

    const csDept = await Department.create({
      name: "Electronics & Computer Science",
      code: "ECS",
      totalSemesters: 8,
      divisions: ["A", "B"],
      batches: ["Batch A", "Batch B", "Batch C"],
    });
    const itDept = await Department.create({
      name: "Information Technology",
      code: "IT",
      totalSemesters: 8,
      divisions: ["A", "B"],
      batches: ["Batch A", "Batch B", "Batch C"],
    });

    await User.create({
      name: "System Admin",
      email: CREDENTIALS.admin.email,
      password: CREDENTIALS.admin.password,
      role: "admin",
    });

    const hodCs = await User.createByAdmin({
      name: "ECS Head of Department",
      email: CREDENTIALS.hodCs.email,
      password: CREDENTIALS.hodCs.password,
      department: csDept._id,
    });
    csDept.hod = hodCs._id;
    await csDept.save();

    const hodIt = await User.createByAdmin({
      name: "IT Head of Department",
      email: CREDENTIALS.hodIt.email,
      password: CREDENTIALS.hodIt.password,
      department: itDept._id,
    });
    itDept.hod = hodIt._id;
    await itDept.save();

    const facultyRecords = await Faculty.insertMany([
      {
        name: "Prof. Rajesh Khotre",
        email: "rk@college.com",
        shortCode: "RK",
        department: csDept._id,
        maxPeriodsPerWeek: 30,
      },
      {
        name: "Prof. Sanjana Satpute",
        email: "ss@college.com",
        shortCode: "SS",
        department: csDept._id,
        maxPeriodsPerWeek: 30,
      },
      {
        name: "Prof. Utkarsha Pawar",
        email: "up@college.com",
        shortCode: "UP",
        department: csDept._id,
        maxPeriodsPerWeek: 30,
      },
      {
        name: "Dr. Mariya D.",
        email: "md@college.com",
        shortCode: "MD",
        department: csDept._id,
        maxPeriodsPerWeek: 30,
      },
      {
        name: "Dr. Suvarna Bhise",
        email: "sb@college.com",
        shortCode: "SB",
        department: csDept._id,
        maxPeriodsPerWeek: 30,
      },
    ]);

    const [facRK, facSS, facUP, facMD, facSB] = facultyRecords;

    const subjectsData = [
      {
        name: "Analog Electronics",
        code: "AE",
        theoryHours: 3,
        tutorialHours: 0,
        practicalHours: 6,
      },
      {
        name: "Discrete Structure & Automata Theory",
        code: "DSAT",
        theoryHours: 3,
        tutorialHours: 0,
        practicalHours: 6,
      },
      {
        name: "Maintenance of Electronic Appliances & Network Admin",
        code: "MEANA",
        theoryHours: 2,
        tutorialHours: 0,
        practicalHours: 6,
      },
      {
        name: "Multidisciplinary Minor — Data Mining",
        code: "MDM",
        theoryHours: 3,
        tutorialHours: 0,
        practicalHours: 0,
      },
      {
        name: "Business Model Development",
        code: "BMD",
        theoryHours: 2,
        tutorialHours: 0,
        practicalHours: 6,
      },
      {
        name: "Design Thinking",
        code: "DT",
        theoryHours: 2,
        tutorialHours: 0,
        practicalHours: 6,
      },
      {
        name: "Mathematics-IV",
        code: "M-IV",
        theoryHours: 2,
        tutorialHours: 3,
        practicalHours: 0,
      },
      {
        name: "Open Elective",
        code: "OE",
        theoryHours: 2,
        tutorialHours: 0,
        practicalHours: 0,
      },
    ];

    const subjects = await Subject.insertMany(
      subjectsData.map((s) => ({
        ...s,
        department: csDept._id,
        semester: 1,
      }))
    );
    const subjectByCode = Object.fromEntries(subjects.map((s) => [s.code, s]));

    const rooms = await Room.insertMany([
      { name: "Room 101", capacity: 60, type: "lecture" },
      { name: "Room 102", capacity: 60, type: "lecture" },
      { name: "Room 512", capacity: 60, type: "lecture" },
      { name: "Lab A", capacity: 30, type: "lab" },
      { name: "Lab B", capacity: 30, type: "lab" },
      { name: "Lab C", capacity: 30, type: "lab" },
    ]);
    const [room101, room102, room512, labA, labB, labC] = rooms;

    await FacultyAssignment.insertMany([
      {
        faculty: facRK._id,
        subject: subjectByCode.AE._id,
        department: csDept._id,
        semester: 1,
        academicYear: ACADEMIC_YEAR,
      },
      {
        faculty: facSS._id,
        subject: subjectByCode.DSAT._id,
        department: csDept._id,
        semester: 1,
        academicYear: ACADEMIC_YEAR,
      },
      {
        faculty: facUP._id,
        subject: subjectByCode.MEANA._id,
        department: csDept._id,
        semester: 1,
        academicYear: ACADEMIC_YEAR,
      },
      {
        faculty: facMD._id,
        subject: subjectByCode["M-IV"]._id,
        department: csDept._id,
        semester: 1,
        academicYear: ACADEMIC_YEAR,
      },
    ]);

    await SemesterSchedule.create({
      department: csDept._id,
      semester: 1,
      academicYear: ACADEMIC_YEAR,
      workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      columns: SemesterSchedule.buildDefaultColumns(),
      classAdvisor: "Prof. Utkarsha Pawar",
      wef: new Date("2026-02-10"),
      titleLabel: "ACADEMIC SCHEDULE (FIRST HALF – 2026)",
      classMode: "multi",
      divisions: [
        { code: "Division A", label: "", batches: ["A", "B", "C"] },
        { code: "Division B", label: "", batches: ["A", "B", "C", "D"] },
      ],
    });

    await SemesterSchedule.create({
      department: csDept._id,
      semester: 2,
      academicYear: ACADEMIC_YEAR,
      workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      columns: SemesterSchedule.buildDefaultColumns(),
      classAdvisor: "Prof. Utkarsha Pawar",
      titleLabel: "ACADEMIC SCHEDULE — SEMESTER 2",
      classMode: "single",
      divisions: [
        { code: SemesterSchedule.SINGLE_CLASS_CODE, label: "", batches: ["A", "B", "C", "D"] },
      ],
    });

    /*
     * Sample slots (period indices reference the default schedule):
     *  1 = 09:00-10:00, 2 = 10:00-11:00, 3 = SHORT BREAK,
     *  4 = 11:20-12:20, 5 = 12:20-13:20, 6 = LUNCH BREAK,
     *  7 = 14:00-15:00, 8 = 15:00-16:00, 9 = 16:00-17:00, 10 = 17:00-18:00
     */
    const seedSlots = [
      // Monday parallel labs at 09:00 — AE(A) RK Lab A, DSAT(C) SS Lab C, MEANA(B) UP Lab B
      {
        day: "Monday",
        period: 1,
        subject: subjectByCode.AE._id,
        faculty: facRK._id,
        room: labA._id,
        department: csDept._id,
        semester: 1,
        academicYear: ACADEMIC_YEAR,
        division: "Division A",
        slotType: "practical",
        batch: "A",
        status: "draft",
      },
      {
        day: "Monday",
        period: 1,
        subject: subjectByCode.DSAT._id,
        faculty: facSS._id,
        room: labC._id,
        department: csDept._id,
        semester: 1,
        academicYear: ACADEMIC_YEAR,
        division: "Division A",
        slotType: "practical",
        batch: "C",
        status: "draft",
      },
      {
        day: "Monday",
        period: 1,
        subject: subjectByCode.MEANA._id,
        faculty: facUP._id,
        room: labB._id,
        department: csDept._id,
        semester: 1,
        academicYear: ACADEMIC_YEAR,
        division: "Division A",
        slotType: "practical",
        batch: "B",
        status: "draft",
      },

      // Monday 11:20 AE theory, 12:20 OE theory (period 4 & 5)
      {
        day: "Monday",
        period: 4,
        subject: subjectByCode.AE._id,
        faculty: facRK._id,
        room: room512._id,
        department: csDept._id,
        semester: 1,
        academicYear: ACADEMIC_YEAR,
        division: "Division A",
        slotType: "lecture",
        status: "draft",
      },
      {
        day: "Monday",
        period: 5,
        subject: subjectByCode.OE._id,
        faculty: facSB._id,
        room: room512._id,
        department: csDept._id,
        semester: 1,
        academicYear: ACADEMIC_YEAR,
        division: "Division A",
        slotType: "lecture",
        status: "draft",
      },

      // Monday 14:00 DSAT theory, 15:00 MDM theory, 16:00 M-IV(Tut) batch A
      {
        day: "Monday",
        period: 7,
        subject: subjectByCode.DSAT._id,
        faculty: facSS._id,
        room: room512._id,
        department: csDept._id,
        semester: 1,
        academicYear: ACADEMIC_YEAR,
        division: "Division A",
        slotType: "lecture",
        status: "draft",
      },
      {
        day: "Monday",
        period: 8,
        subject: subjectByCode.MDM._id,
        faculty: facSB._id,
        room: room512._id,
        department: csDept._id,
        semester: 1,
        academicYear: ACADEMIC_YEAR,
        division: "Division A",
        slotType: "lecture",
        status: "draft",
      },
      {
        day: "Monday",
        period: 9,
        subject: subjectByCode["M-IV"]._id,
        faculty: facMD._id,
        room: room512._id,
        department: csDept._id,
        semester: 1,
        academicYear: ACADEMIC_YEAR,
        division: "Division A",
        slotType: "practical",
        batch: "A",
        status: "draft",
      },

      // Tuesday 09:00 parallel labs (AE B, DSAT A, DT C)
      {
        day: "Tuesday",
        period: 1,
        subject: subjectByCode.AE._id,
        faculty: facRK._id,
        room: labB._id,
        department: csDept._id,
        semester: 1,
        academicYear: ACADEMIC_YEAR,
        division: "Division A",
        slotType: "practical",
        batch: "B",
        status: "draft",
      },
      {
        day: "Tuesday",
        period: 1,
        subject: subjectByCode.DSAT._id,
        faculty: facSS._id,
        room: labA._id,
        department: csDept._id,
        semester: 1,
        academicYear: ACADEMIC_YEAR,
        division: "Division A",
        slotType: "practical",
        batch: "A",
        status: "draft",
      },

      // Tuesday 11:20 DSAT theory, 12:20 AE theory, 14:00 MEANA theory
      {
        day: "Tuesday",
        period: 4,
        subject: subjectByCode.DSAT._id,
        faculty: facSS._id,
        room: room512._id,
        department: csDept._id,
        semester: 1,
        academicYear: ACADEMIC_YEAR,
        division: "Division A",
        slotType: "lecture",
        status: "draft",
      },
      {
        day: "Tuesday",
        period: 5,
        subject: subjectByCode.AE._id,
        faculty: facRK._id,
        room: room512._id,
        department: csDept._id,
        semester: 1,
        academicYear: ACADEMIC_YEAR,
        division: "Division A",
        slotType: "lecture",
        status: "draft",
      },
      {
        day: "Tuesday",
        period: 7,
        subject: subjectByCode.MEANA._id,
        faculty: facUP._id,
        room: room102._id,
        department: csDept._id,
        semester: 1,
        academicYear: ACADEMIC_YEAR,
        division: "Division A",
        slotType: "lecture",
        status: "draft",
      },
      {
        day: "Tuesday",
        period: 8,
        subject: subjectByCode.BMD._id,
        faculty: facSB._id,
        room: room102._id,
        department: csDept._id,
        semester: 1,
        academicYear: ACADEMIC_YEAR,
        division: "Division A",
        slotType: "lecture",
        status: "draft",
      },
      {
        day: "Tuesday",
        period: 9,
        subject: subjectByCode.DT._id,
        faculty: facUP._id,
        room: room102._id,
        department: csDept._id,
        semester: 1,
        academicYear: ACADEMIC_YEAR,
        division: "Division A",
        slotType: "lecture",
        status: "draft",
      },

      // Wednesday 14:00 OE theory
      {
        day: "Wednesday",
        period: 7,
        subject: subjectByCode.OE._id,
        faculty: facSB._id,
        room: room101._id,
        department: csDept._id,
        semester: 1,
        academicYear: ACADEMIC_YEAR,
        division: "Division A",
        slotType: "lecture",
        status: "draft",
      },

      // Division B — sample slots (batch D only in this division)
      {
        day: "Monday",
        period: 2,
        subject: subjectByCode.BMD._id,
        faculty: facSB._id,
        room: room101._id,
        department: csDept._id,
        semester: 1,
        academicYear: ACADEMIC_YEAR,
        division: "Division B",
        slotType: "lecture",
        status: "draft",
      },
      {
        day: "Monday",
        period: 1,
        subject: subjectByCode.DT._id,
        faculty: facMD._id,
        room: labC._id,
        department: csDept._id,
        semester: 1,
        academicYear: ACADEMIC_YEAR,
        division: "Division B",
        slotType: "practical",
        batch: "D",
        status: "draft",
      },
    ];

    await TimetableSlot.insertMany(
      seedSlots.map((s) => ({
        ...s,
        teachingDepartment: s.teachingDepartment ?? csDept._id,
        slotType: normalizeSlotType(s.slotType),
      }))
    );

    printCredentials();
  } catch (err) {
    console.error("Seed failed:", err.message);
    if (err.errors) {
      Object.values(err.errors).forEach((e) => console.error(" -", e.message));
    }
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

seed();
