const DEFAULT_DIVISIONS = ["A", "B"];
const DEFAULT_BATCHES = ["Batch A", "Batch B", "Batch C"];

const normalizeDivisionsList = (divisions) => {
  const list = (Array.isArray(divisions) ? divisions : [])
    .map((d) => String(d).trim())
    .filter(Boolean);
  return list.length ? list : [...DEFAULT_DIVISIONS];
};

const normalizeBatchesList = (batches) => {
  const list = (Array.isArray(batches) ? batches : [])
    .map((b) => String(b).trim())
    .filter(Boolean);
  return list.length ? list : [...DEFAULT_BATCHES];
};

/** Slot storage / API batch code (e.g. "Batch A" → "A"). */
const batchToSlotCode = (batchLabel) => {
  const s = String(batchLabel || "").trim();
  const match = s.match(/^batch\s+([A-Za-z0-9]+)$/i);
  if (match) return match[1].toUpperCase();
  if (/^[A-Za-z0-9]+$/.test(s) && s.length <= 3) return s.toUpperCase();
  return s.toUpperCase();
};

const batchCodesFromDepartment = (department) =>
  normalizeBatchesList(department?.batches).map(batchToSlotCode);

const divisionToCode = (name) => {
  const n = String(name || "").trim();
  if (!n) return "";
  if (/^division\s/i.test(n)) return n;
  return `Division ${n}`;
};

const SINGLE_CLASS_CODE = "Class";

/**
 * Build semester schedule division rows from department config.
 * @param {object} department
 * @param {{ classMode?: string }} [options]
 */
const buildDivisionsFromDepartment = (department, options = {}) => {
  const classMode = options.classMode || "multi";
  const batchCodes = batchCodesFromDepartment(department);
  const divNames = normalizeDivisionsList(department?.divisions);

  if (classMode === "single" || divNames.length <= 1) {
    return [{ code: SINGLE_CLASS_CODE, label: "", batches: batchCodes }];
  }

  return divNames.map((name) => ({
    code: divisionToCode(name),
    label: "",
    batches: [...batchCodes],
  }));
};

module.exports = {
  DEFAULT_DIVISIONS,
  DEFAULT_BATCHES,
  normalizeDivisionsList,
  normalizeBatchesList,
  batchToSlotCode,
  batchCodesFromDepartment,
  divisionToCode,
  buildDivisionsFromDepartment,
  SINGLE_CLASS_CODE,
};
