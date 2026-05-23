export const SLOT_TYPES = ['lecture', 'practical']

export const SLOT_TYPE_OPTIONS = [
  { value: 'lecture', label: 'Lecture (whole division)' },
  { value: 'practical', label: 'Practical (one batch)' },
]

const LEGACY_SLOT_MAP = {
  theory: 'lecture',
  tutorial: 'practical',
  lecture: 'lecture',
  practical: 'practical',
}

export const normalizeSlotType = (value) => {
  const key = String(value || 'lecture').trim().toLowerCase()
  return LEGACY_SLOT_MAP[key] || 'lecture'
}

export const isLecture = (value) => normalizeSlotType(value) === 'lecture'

export const isPractical = (value) => normalizeSlotType(value) === 'practical'

export const formatSlotTypeLabel = (value) => {
  const t = normalizeSlotType(value)
  return t === 'lecture' ? 'Lecture' : 'Practical'
}
