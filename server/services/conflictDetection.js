const TimetableSlot = require("../models/TimetableSlot");
const {
  normalizeSlotType,
  isLecture,
  isPractical,
} = require("../utils/slotTypes");

const LECTURE_TYPES = ["lecture", "theory"];
const PRACTICAL_TYPES = ["practical", "tutorial"];

const populateConflictSlot = (query) =>
  query
    .populate("subject", "name code")
    .populate("faculty", "name shortCode")
    .populate("room", "name type")
    .populate("department", "name code")
    .lean();

const excludeFilter = (excludeSlotId) =>
  excludeSlotId ? { _id: { $ne: excludeSlotId } } : {};

const normalizeBatch = (batch) => {
  if (!batch) return null;
  const trimmed = String(batch).trim().toUpperCase();
  return trimmed.length === 0 ? null : trimmed;
};

const formatSlotLocation = (slot) => {
  const dept =
    slot.department?.code || slot.department?.name || "Department";
  const div = slot.division ? ` · ${slot.division}` : "";
  const batch = slot.batch ? ` · Batch ${slot.batch}` : "";
  return `${dept}${div}${batch} · ${slot.day} Period ${slot.period}`;
};

const toExistingSlot = (slot) => ({
  _id: slot._id,
  day: slot.day,
  period: slot.period,
  division: slot.division,
  batch: slot.batch ?? null,
  department: slot.department,
  subject: slot.subject,
  faculty: slot.faculty,
  room: slot.room,
});

/**
 * Run faculty, room, division lecture, and batch practical conflict checks.
 *
 * @param {object} slotData
 * @param {string} slotData.day
 * @param {number} slotData.period
 * @param {import('mongoose').Types.ObjectId|string} slotData.facultyId
 * @param {import('mongoose').Types.ObjectId|string} slotData.roomId
 * @param {import('mongoose').Types.ObjectId|string} slotData.departmentId
 * @param {number} slotData.semester
 * @param {string} slotData.division
 * @param {string} slotData.slotType
 * @param {string|null} slotData.batch
 * @param {string} slotData.academicYear
 * @param {import('mongoose').Types.ObjectId|string|null} [excludeSlotId]
 * @returns {Promise<Array<{ type: string, message: string, existingSlot: object }>>}
 */
const checkConflicts = async (slotData, excludeSlotId = null) => {
  const {
    day,
    period,
    facultyId,
    roomId,
    departmentId,
    semester,
    division,
    slotType: rawSlotType,
    batch,
    academicYear,
  } = slotData;

  const slotType = normalizeSlotType(rawSlotType);
  const normalizedBatch = normalizeBatch(batch);
  const exclude = excludeFilter(excludeSlotId);
  const timeFilter = {
    ...exclude,
    day,
    period: Number(period),
    academicYear,
  };

  const [
    facultyResult,
    roomResult,
    divisionLectureResult,
    batchPracticalResult,
    lectureBlocksPracticalResult,
  ] = await Promise.all([
    populateConflictSlot(
      TimetableSlot.findOne({
        ...timeFilter,
        faculty: facultyId,
      })
    ),

    populateConflictSlot(
      TimetableSlot.findOne({
        ...timeFilter,
        room: roomId,
      })
    ),

    isLecture(slotType)
      ? populateConflictSlot(
          TimetableSlot.findOne({
            ...timeFilter,
            department: departmentId,
            semester: Number(semester),
            division: String(division).trim(),
            slotType: { $in: LECTURE_TYPES },
          })
        )
      : Promise.resolve(null),

    isPractical(slotType) && normalizedBatch
      ? populateConflictSlot(
          TimetableSlot.findOne({
            ...timeFilter,
            department: departmentId,
            semester: Number(semester),
            division: String(division).trim(),
            batch: normalizedBatch,
            slotType: { $in: PRACTICAL_TYPES },
          })
        )
      : Promise.resolve(null),

    isPractical(slotType)
      ? populateConflictSlot(
          TimetableSlot.findOne({
            ...timeFilter,
            department: departmentId,
            semester: Number(semester),
            division: String(division).trim(),
            slotType: { $in: LECTURE_TYPES },
          })
        )
      : Promise.resolve(null),
  ]);

  const conflicts = [];

  if (facultyResult) {
    const facultyName = facultyResult.faculty?.name || "Faculty";
    const subjectLabel =
      facultyResult.subject?.code || facultyResult.subject?.name || "a subject";
    const roomName = facultyResult.room?.name || "—";
    conflicts.push({
      type: "FACULTY_CONFLICT",
      message: `${facultyName} is already teaching ${subjectLabel} (${formatSlotLocation(facultyResult)}) in ${roomName}`,
      existingSlot: toExistingSlot(facultyResult),
    });
  }

  if (roomResult) {
    const roomName = roomResult.room?.name || "Room";
    const subjectLabel =
      roomResult.subject?.code || roomResult.subject?.name || "a class";
    const facultyName = roomResult.faculty?.name || "—";
    conflicts.push({
      type: "ROOM_CONFLICT",
      message: `${roomName} is already booked for ${subjectLabel} with ${facultyName} (${formatSlotLocation(roomResult)})`,
      existingSlot: toExistingSlot(roomResult),
    });
  }

  if (divisionLectureResult) {
    const subjectName = divisionLectureResult.subject?.name || "a subject";
    conflicts.push({
      type: "DIVISION_CONFLICT",
      message: `Division ${division} already has ${subjectName} lecture on ${day} Period ${period}`,
      existingSlot: toExistingSlot(divisionLectureResult),
    });
  }

  if (batchPracticalResult) {
    conflicts.push({
      type: "BATCH_CONFLICT",
      message: `${normalizedBatch} in Division ${division} already has a practical on ${day} Period ${period}`,
      existingSlot: toExistingSlot(batchPracticalResult),
    });
  }

  if (
    lectureBlocksPracticalResult &&
    isPractical(slotType) &&
    (!batchPracticalResult ||
      String(lectureBlocksPracticalResult._id) !==
        String(batchPracticalResult._id))
  ) {
    const subjectName =
      lectureBlocksPracticalResult.subject?.name || "a lecture";
    conflicts.push({
      type: "LECTURE_BLOCKS_PRACTICAL",
      message: `Division ${division} has ${subjectName} lecture on ${day} Period ${period} — batch ${normalizedBatch || "?"} cannot have a practical at the same time`,
      existingSlot: toExistingSlot(lectureBlocksPracticalResult),
    });
  }

  return conflicts;
};

module.exports = { checkConflicts };
