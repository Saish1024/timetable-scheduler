const SLOT_TYPES = ["lecture", "practical"];

const LEGACY_SLOT_MAP = {
  theory: "lecture",
  tutorial: "practical",
  lecture: "lecture",
  practical: "practical",
};

const normalizeSlotType = (value) => {
  const key = String(value || "lecture").trim().toLowerCase();
  return LEGACY_SLOT_MAP[key] || "lecture";
};

const isLecture = (value) => normalizeSlotType(value) === "lecture";

const isPractical = (value) => normalizeSlotType(value) === "practical";

module.exports = {
  SLOT_TYPES,
  LEGACY_SLOT_MAP,
  normalizeSlotType,
  isLecture,
  isPractical,
};
