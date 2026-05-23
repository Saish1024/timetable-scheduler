import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import api from '../api/axios'
import TimetablePDF from '../components/TimetablePDF'
import { getDivisions, prepareScheduleFromApi } from './scheduleHelpers'
import { isLecture, isPractical } from './slotTypes'

const PRINT_ROOT_ID = 'timetable-pdf-print-root'
const PRINT_BODY_CLASS = 'timetable-pdf-printing'

export const PDF_VIEW = {
  FULL: 'full',
  LECTURE: 'lecture',
  PRACTICAL: 'practical',
  BATCH: 'batch',
}

const waitForPaint = () =>
  new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve)
    })
  })

const filterSlots = (slots, view, batch) => {
  if (!slots?.length) return []
  if (view === PDF_VIEW.FULL) return slots
  if (view === PDF_VIEW.LECTURE) return slots.filter((s) => isLecture(s.slotType))
  if (view === PDF_VIEW.PRACTICAL) return slots.filter((s) => isPractical(s.slotType))
  if (view === PDF_VIEW.BATCH && batch) {
    const b = String(batch).toUpperCase()
    return slots.filter((s) => String(s.batch || '').toUpperCase() === b)
  }
  return slots
}

const filterSlotsByCell = (slotsByCell, view, batch) => {
  const out = {}
  for (const [day, periods] of Object.entries(slotsByCell || {})) {
    out[day] = {}
    for (const [period, slots] of Object.entries(periods || {})) {
      const filtered = filterSlots(slots, view, batch)
      if (filtered.length) out[day][period] = filtered
    }
  }
  return out
}

const countSlotsInGrid = (slotsByCell) => {
  let n = 0
  for (const periods of Object.values(slotsByCell || {})) {
    for (const slots of Object.values(periods || {})) {
      n += slots.length
    }
  }
  return n
}

async function fetchPdfData(departmentId, semester, { academicYear, division }) {
  const { data } = await api.get(`/api/pdf/${departmentId}/${semester}`, {
    params: {
      academicYear,
      ...(division && division !== 'all' ? { division } : {}),
    },
  })
  return data
}

async function buildSections(departmentId, semester, options) {
  const {
    academicYear = '2025-26',
    division,
    view = PDF_VIEW.FULL,
    batch,
  } = options

  const scheduleRes = await api.get(
    `/api/schedule/${departmentId}/${semester}`,
    { params: { academicYear } }
  )
  const deptRes = await api.get(`/api/departments/${departmentId}`)
  const department = deptRes.data.department
  const schedule = prepareScheduleFromApi(
    scheduleRes.data.schedule,
    department || scheduleRes.data.departmentConfig
  )
  const divisions = getDivisions(schedule, department)

  const divisionCodes =
    division === 'all'
      ? divisions.map((d) => d.code)
      : [division || divisions[0]?.code].filter(Boolean)

  if (divisionCodes.length === 0) {
    throw new Error('No divisions configured for this semester')
  }

  const sections = []
  let baseData = null

  for (const code of divisionCodes) {
    const data = await fetchPdfData(departmentId, semester, {
      academicYear,
      division: code,
    })
    if (!baseData) baseData = data

    const filteredCell = filterSlotsByCell(data.slotsByCell, view, batch)
    const slotCount = countSlotsInGrid(filteredCell)
    if (slotCount === 0) continue

    sections.push({
      division: data.division,
      slotsByCell: filteredCell,
      subjectSummary: data.subjectSummary || [],
      summaryTotals: data.summaryTotals,
      slotCount,
    })
  }

  if (sections.length === 0) {
    throw new Error('No slots match the selected export options')
  }

  return {
    department: baseData.department,
    semester: baseData.semester,
    academicYear: baseData.academicYear,
    schedule: baseData.schedule,
    sections,
    view,
    batch,
  }
}

/**
 * Fetches timetable PDF data and opens the browser print dialog (Save as PDF).
 * @param {string} departmentId
 * @param {number} semester
 * @param {{
 *   academicYear?: string,
 *   division?: string,
 *   view?: string,
 *   batch?: string,
 *   generator?: { role: string, name: string },
 * }} options
 */
export async function downloadTimetablePDF(
  departmentId,
  semester,
  options = {}
) {
  const { generator, view = PDF_VIEW.FULL, batch } = options

  const payload = await buildSections(departmentId, semester, options)

  const existing = document.getElementById(PRINT_ROOT_ID)
  if (existing) existing.remove()

  const container = document.createElement('div')
  container.id = PRINT_ROOT_ID
  container.className = 'timetable-pdf-print-root'
  document.body.appendChild(container)

  const root = createRoot(container)

  root.render(
    createElement(TimetablePDF, {
      department: payload.department,
      semester: payload.semester,
      academicYear: payload.academicYear,
      schedule: payload.schedule,
      sections: payload.sections,
      view,
      batch,
      generator,
    })
  )

  await waitForPaint()

  document.body.classList.add(PRINT_BODY_CLASS)

  return new Promise((resolve, reject) => {
    let cleaned = false

    const cleanup = () => {
      if (cleaned) return
      cleaned = true
      window.removeEventListener('afterprint', cleanup)
      document.body.classList.remove(PRINT_BODY_CLASS)
      root.unmount()
      container.remove()
      resolve()
    }

    window.addEventListener('afterprint', cleanup)

    try {
      window.print()
    } catch (err) {
      cleanup()
      reject(err)
      return
    }

    setTimeout(cleanup, 2500)
  })
}
