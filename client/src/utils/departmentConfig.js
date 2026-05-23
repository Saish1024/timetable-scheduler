export const DEFAULT_DIVISIONS = ['A', 'B']
export const DEFAULT_BATCHES = ['Batch A', 'Batch B', 'Batch C']

export const normalizeDivisionsList = (divisions) => {
  const list = (Array.isArray(divisions) ? divisions : [])
    .map((d) => String(d).trim())
    .filter(Boolean)
  return list.length ? list : [...DEFAULT_DIVISIONS]
}

export const normalizeBatchesList = (batches) => {
  const list = (Array.isArray(batches) ? batches : [])
    .map((b) => String(b).trim())
    .filter(Boolean)
  return list.length ? list : [...DEFAULT_BATCHES]
}

/** Slot storage code from department batch label. */
export const batchToSlotCode = (batchLabel) => {
  const s = String(batchLabel || '').trim()
  const match = s.match(/^batch\s+([A-Za-z0-9]+)$/i)
  if (match) return match[1].toUpperCase()
  if (/^[A-Za-z0-9]+$/.test(s) && s.length <= 3) return s.toUpperCase()
  return s.toUpperCase()
}

export const batchCodesFromDepartment = (department) =>
  normalizeBatchesList(department?.batches).map(batchToSlotCode)

export const divisionToCode = (name) => {
  const n = String(name || '').trim()
  if (!n) return ''
  if (/^division\s/i.test(n)) return n
  return `Division ${n}`
}

export const formatBatchLabel = (batchCode, department) => {
  const code = String(batchCode || '').trim().toUpperCase()
  if (!code) return ''
  const labels = normalizeBatchesList(department?.batches)
  const match = labels.find((l) => batchToSlotCode(l) === code)
  if (match) return match
  return code.length === 1 ? `Batch ${code}` : code
}

export const formatDivisionTabLabel = (division, department) => {
  if (division?.label) return division.label
  const code = String(division?.code || '')
  if (/^division\s/i.test(code)) return code
  if (code === 'Class') return 'Class'
  const names = normalizeDivisionsList(department?.divisions)
  const short = code.replace(/^division\s+/i, '').trim()
  if (names.includes(short)) return divisionToCode(short)
  return code.length <= 2 ? divisionToCode(code) : code
}

export const buildDivisionsFromDepartment = (department, classMode = 'multi') => {
  const batchCodes = normalizeBatchesList(department?.batches).map(batchToSlotCode)
  const divNames = normalizeDivisionsList(department?.divisions)

  if (classMode === 'single' || divNames.length <= 1) {
    return [{ code: 'Class', label: '', batches: batchCodes }]
  }

  return divNames.map((name) => ({
    code: divisionToCode(name),
    label: '',
    batches: [...batchCodes],
  }))
}

/** Division tabs for timetable UI from department (not semester schedule). */
export const getDivisionTabsFromDepartment = (department) =>
  buildDivisionsFromDepartment(department, 'multi').filter((d) => d.code !== 'Class')

export const getBatchOptionsFromDepartment = (department) => {
  const labels = normalizeBatchesList(department?.batches)
  return labels.map((label) => ({
    label,
    value: batchToSlotCode(label),
  }))
}
