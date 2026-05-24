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

const slotKey = (slot) => String(slot._id);

const idOf = (ref) => (ref?._id != null ? String(ref._id) : ref ? String(ref) : "");

const slotsAtTime = (allSlots, { day, period, academicYear, excludeSlotId }) =>
  allSlots.filter(
    (slot) =>
      slot.day === day &&
      Number(slot.period) === Number(period) &&
      slot.academicYear === academicYear &&
      (!excludeSlotId || slotKey(slot) !== String(excludeSlotId))
  );

/**
 * In-memory conflict check using a preloaded slot set (same rules as checkConflicts).
 */
const checkConflictsInMemory = (slotData, excludeSlotId, allSlots) => {
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
  const atTime = slotsAtTime(allSlots, {
    day,
    period,
    academicYear,
    excludeSlotId,
  });

  const conflicts = [];

  const facultyResult = atTime.find((s) => idOf(s.faculty) === String(facultyId));
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

  const roomResult = atTime.find((s) => idOf(s.room) === String(roomId));
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

  const divisionCode = String(division).trim();

  if (isLecture(slotType)) {
    const divisionLectureResult = atTime.find(
      (s) =>
        idOf(s.department) === String(departmentId) &&
        Number(s.semester) === Number(semester) &&
        String(s.division).trim() === divisionCode &&
        LECTURE_TYPES.includes(normalizeSlotType(s.slotType))
    );
    if (divisionLectureResult) {
      const subjectName = divisionLectureResult.subject?.name || "a subject";
      conflicts.push({
        type: "DIVISION_CONFLICT",
        message: `Division ${division} already has ${subjectName} lecture on ${day} Period ${period}`,
        existingSlot: toExistingSlot(divisionLectureResult),
      });
    }
  }

  let batchPracticalResult = null;
  if (isPractical(slotType) && normalizedBatch) {
    batchPracticalResult = atTime.find(
      (s) =>
        idOf(s.department) === String(departmentId) &&
        Number(s.semester) === Number(semester) &&
        String(s.division).trim() === divisionCode &&
        normalizeBatch(s.batch) === normalizedBatch &&
        PRACTICAL_TYPES.includes(normalizeSlotType(s.slotType))
    );
    if (batchPracticalResult) {
      conflicts.push({
        type: "BATCH_CONFLICT",
        message: `${normalizedBatch} in Division ${division} already has a practical on ${day} Period ${period}`,
        existingSlot: toExistingSlot(batchPracticalResult),
      });
    }
  }

  if (isPractical(slotType)) {
    const lectureBlocksPracticalResult = atTime.find(
      (s) =>
        idOf(s.department) === String(departmentId) &&
        Number(s.semester) === Number(semester) &&
        String(s.division).trim() === divisionCode &&
        LECTURE_TYPES.includes(normalizeSlotType(s.slotType))
    );
    if (
      lectureBlocksPracticalResult &&
      (!batchPracticalResult ||
        slotKey(lectureBlocksPracticalResult) !== slotKey(batchPracticalResult))
    ) {
      const subjectName =
        lectureBlocksPracticalResult.subject?.name || "a lecture";
      conflicts.push({
        type: "LECTURE_BLOCKS_PRACTICAL",
        message: `Division ${division} has ${subjectName} lecture on ${day} Period ${period} — batch ${normalizedBatch || "?"} cannot have a practical at the same time`,
        existingSlot: toExistingSlot(lectureBlocksPracticalResult),
      });
    }
  }

  return conflicts;
};

const detectIntraCellConflicts = (deptSlots) => {
  const byCell = new Map();
  for (const slot of deptSlots) {
    const key = `${slot.day}|${slot.period}|${slot.division}|${slot.academicYear}`;
    if (!byCell.has(key)) byCell.set(key, []);
    byCell.get(key).push(slot);
  }

  const conflictMap = new Map();
  for (const cellSlots of byCell.values()) {
    if (cellSlots.length < 2) continue;
    for (let i = 0; i < cellSlots.length; i++) {
      for (let j = i + 1; j < cellSlots.length; j++) {
        const a = cellSlots[i];
        const b = cellSlots[j];
        const facultyA = idOf(a.faculty);
        const facultyB = idOf(b.faculty);
        if (facultyA && facultyB && facultyA === facultyB) {
          for (const slot of [a, b]) {
            const key = slotKey(slot);
            if (!conflictMap.has(key)) conflictMap.set(key, { slotId: key, reasons: [] });
            const name = slot.faculty?.name || "Faculty";
            const other = slot === a ? b : a;
            const subject = other.subject?.code || other.subject?.name || "—";
            const batch = other.batch ? ` · Batch ${other.batch}` : "";
            conflictMap.get(key).reasons.push({
              type: "INTRA_CELL_FACULTY",
              message: `${name} appears twice in this cell (${subject}${batch})`,
              existingSlot: toExistingSlot(other),
            });
          }
        }
        const roomA = idOf(a.room);
        const roomB = idOf(b.room);
        if (roomA && roomB && roomA === roomB) {
          for (const slot of [a, b]) {
            const key = slotKey(slot);
            if (!conflictMap.has(key)) conflictMap.set(key, { slotId: key, reasons: [] });
            const roomName = slot.room?.name || "Room";
            const other = slot === a ? b : a;
            const subject = other.subject?.code || other.subject?.name || "—";
            const batch = other.batch ? ` · Batch ${other.batch}` : "";
            conflictMap.get(key).reasons.push({
              type: "INTRA_CELL_ROOM",
              message: `${roomName} is used twice in this cell (${subject}${batch})`,
              existingSlot: toExistingSlot(other),
            });
          }
        }
      }
    }
  }
  return conflictMap;
};

module.exports = { checkConflicts, checkConflictsInMemory, detectIntraCellConflicts };
