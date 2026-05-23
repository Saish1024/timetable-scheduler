import { useMemo } from 'react'
import { isLecture } from '../utils/slotTypes'
import { PDF_VIEW } from '../utils/exportPDF'

const DEFAULT_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

const COLLEGE_NAME =
  import.meta.env.VITE_COLLEGE_NAME || 'College of Engineering'

const formatRole = (role) => {
  if (!role) return ''
  if (role === 'hod') return 'HOD'
  if (role === 'admin') return 'Admin'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

const formatGeneratedDate = (date = new Date()) =>
  date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

const formatDivisionHeader = (division) => {
  if (!division?.code) return '—'
  if (division.label) return division.label
  const code = String(division.code)
  if (/^division\s/i.test(code)) return code
  if (code === 'Class') return 'Class'
  return code.length <= 2 ? `Division ${code}` : code
}

const viewSubtitle = (view, batch) => {
  if (view === PDF_VIEW.LECTURE) return 'Lectures only'
  if (view === PDF_VIEW.PRACTICAL) return 'Practicals only'
  if (view === PDF_VIEW.BATCH && batch) {
    return `Batch ${String(batch).toUpperCase()}`
  }
  return null
}

const isCrossDepartment = (slot, studentDepartmentId) => {
  const teachId =
    slot.teachingDepartment?._id || slot.teachingDepartment
  const deptId = studentDepartmentId || slot.department?._id || slot.department
  return teachId && deptId && String(teachId) !== String(deptId)
}

const collectCrossDeptNotes = (slotsByCell, studentDepartmentId) => {
  const names = new Set()
  for (const periods of Object.values(slotsByCell || {})) {
    for (const slots of Object.values(periods || {})) {
      for (const slot of slots) {
        if (isCrossDepartment(slot, studentDepartmentId)) {
          const name =
            slot.teachingDepartment?.name ||
            slot.teachingDepartment?.code ||
            'another department'
          names.add(name)
        }
      }
    }
  }
  return [...names]
}

const DEFAULT_COLUMNS = [
  { index: 1, kind: 'class', startTime: '09:00', endTime: '10:00', label: '' },
  { index: 2, kind: 'class', startTime: '10:00', endTime: '11:00', label: '' },
  {
    index: 3,
    kind: 'short_break',
    startTime: '11:00',
    endTime: '11:20',
    label: 'SHORT BREAK',
  },
  { index: 4, kind: 'class', startTime: '11:20', endTime: '12:20', label: '' },
  { index: 5, kind: 'class', startTime: '12:20', endTime: '13:20', label: '' },
  {
    index: 6,
    kind: 'lunch_break',
    startTime: '13:20',
    endTime: '14:00',
    label: 'LUNCH BREAK',
  },
  { index: 7, kind: 'class', startTime: '14:00', endTime: '15:00', label: '' },
  { index: 8, kind: 'class', startTime: '15:00', endTime: '16:00', label: '' },
  { index: 9, kind: 'class', startTime: '16:00', endTime: '17:00', label: '' },
  { index: 10, kind: 'class', startTime: '17:00', endTime: '18:00', label: '' },
]

const SlotBlock = ({ slot, studentDepartmentId }) => {
  const lecture = isLecture(slot.slotType)
  const code = slot.subject?.code || '?'
  const facultyName = slot.faculty?.name || '—'
  const room = slot.room?.name || '—'
  const cross = isCrossDepartment(slot, studentDepartmentId)
  const batchLabel =
    !lecture && slot.batch
      ? `Batch ${String(slot.batch).replace(/^batch\s/i, '')}`
      : null

  return (
    <div
      className={`ttpdf-slot ${lecture ? 'ttpdf-slot--lecture' : 'ttpdf-slot--practical'}`}
    >
      <div className="ttpdf-slot-code">{code}</div>
      <div className="ttpdf-slot-faculty">
        {facultyName}
        {cross && (
          <span className="ttpdf-asterisk" title="Faculty from another department">
            *
          </span>
        )}
      </div>
      <div className="ttpdf-slot-room">{room}</div>
      {batchLabel && <div className="ttpdf-slot-batch">{batchLabel}</div>}
    </div>
  )
}

const PdfPage = ({
  department,
  semester,
  academicYear,
  schedule,
  division,
  slotsByCell,
  subjectSummary,
  summaryTotals,
  view,
  batch,
  generator,
  studentDepartmentId,
  pageBreakAfter,
}) => {
  const days = schedule?.workingDays?.length
    ? schedule.workingDays
    : DEFAULT_DAYS
  const columns = schedule?.columns?.length
    ? [...schedule.columns].sort((a, b) => a.index - b.index)
    : DEFAULT_COLUMNS

  const deptLabel = department
    ? `${department.code} — ${department.name}`
    : 'Department'
  const divisionLabel = formatDivisionHeader(division)
  const filterNote = viewSubtitle(view, batch)
  const crossDeptNames = useMemo(
    () => collectCrossDeptNotes(slotsByCell, studentDepartmentId),
    [slotsByCell, studentDepartmentId]
  )

  const totals =
    summaryTotals ||
    subjectSummary.reduce(
      (acc, r) => {
        acc.theory += r.theory || 0
        acc.tutorial += r.tutorial || 0
        acc.practical += r.practical || 0
        acc.total += r.total || 0
        return acc
      },
      { theory: 0, tutorial: 0, practical: 0, total: 0 }
    )

  const footerLine = generator?.name
    ? `Generated by ${generator.name} (${formatRole(generator.role)}) on ${formatGeneratedDate()}`
    : `Generated on ${formatGeneratedDate()}`

  return (
    <div
      className={`ttpdf-page${pageBreakAfter ? ' ttpdf-page--break' : ''}`}
    >
      <header className="ttpdf-header">
        <div className="ttpdf-college">{COLLEGE_NAME}</div>
        <div className="ttpdf-header-meta">
          <span>
            <strong>Department:</strong> {deptLabel}
          </span>
          <span>
            <strong>Semester</strong> {semester}
          </span>
          <span>
            <strong>Division</strong> {divisionLabel}
          </span>
          <span>
            <strong>Academic Year</strong> {academicYear}
          </span>
        </div>
        {filterNote && (
          <div className="ttpdf-filter-note">View: {filterNote}</div>
        )}
      </header>

      <table className="ttpdf-grid">
        <thead>
          <tr>
            <th className="ttpdf-corner">
              TIME
              <br />
              DAY
            </th>
            {columns.map((col) => (
              <th
                key={col.index}
                className={
                  col.kind === 'class' ? 'ttpdf-time-col' : 'ttpdf-break-col'
                }
              >
                {col.kind === 'class' ? (
                  <span>
                    {col.startTime}–{col.endTime}
                  </span>
                ) : (
                  <span className="ttpdf-vertical">
                    {col.label ||
                      (col.kind === 'lunch_break' ? 'LUNCH' : 'BREAK')}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day}>
              <th className="ttpdf-day">{day}</th>
              {columns.map((col) => {
                if (col.kind !== 'class') {
                  return (
                    <td
                      key={`${day}-${col.index}`}
                      className="ttpdf-break-cell"
                    >
                      <span className="ttpdf-vertical">
                        {col.label ||
                          (col.kind === 'lunch_break' ? 'LUNCH' : 'BREAK')}
                      </span>
                    </td>
                  )
                }
                const cellSlots = slotsByCell?.[day]?.[col.index] || []
                return (
                  <td key={`${day}-${col.index}`} className="ttpdf-cell">
                    <div className="ttpdf-cell-stack">
                      {cellSlots.map((slot) => (
                        <SlotBlock
                          key={slot._id}
                          slot={slot}
                          studentDepartmentId={studentDepartmentId}
                        />
                      ))}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {subjectSummary.length > 0 && (
        <table className="ttpdf-summary">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Teacher</th>
              <th>T</th>
              <th>Tu</th>
              <th>P</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {subjectSummary.map((row) => (
              <tr key={row._id || `${row.code}-${row.name}`}>
                <td>{row.name}</td>
                <td>{row.teacher}</td>
                <td className="ttpdf-num">{row.theory || '-'}</td>
                <td className="ttpdf-num">{row.tutorial || '-'}</td>
                <td className="ttpdf-num">{row.practical || '-'}</td>
                <td className="ttpdf-num">{row.total || '-'}</td>
              </tr>
            ))}
            <tr className="ttpdf-summary-total">
              <td colSpan={2}>TOTAL</td>
              <td className="ttpdf-num">{totals.theory}</td>
              <td className="ttpdf-num">{totals.tutorial}</td>
              <td className="ttpdf-num">{totals.practical}</td>
              <td className="ttpdf-num">{totals.total}</td>
            </tr>
          </tbody>
        </table>
      )}

      {crossDeptNames.length > 0 && (
        <div className="ttpdf-footnotes">
          <span className="ttpdf-asterisk">*</span> Faculty from{' '}
          {crossDeptNames.join(', ')}
        </div>
      )}

      <footer className="ttpdf-footer">{footerLine}</footer>
    </div>
  )
}

const TimetablePDF = ({
  department,
  semester,
  academicYear,
  schedule,
  sections = [],
  view = PDF_VIEW.FULL,
  batch,
  generator,
}) => {
  const studentDepartmentId = department?._id

  if (!sections.length) {
    return (
      <div className="timetable-pdf-document ttpdf">
        <p>No timetable data to print.</p>
      </div>
    )
  }

  return (
    <div className="timetable-pdf-document ttpdf">
      {sections.map((section, index) => (
        <PdfPage
          key={section.division?.code || index}
          department={department}
          semester={semester}
          academicYear={academicYear}
          schedule={schedule}
          division={section.division}
          slotsByCell={section.slotsByCell}
          subjectSummary={section.subjectSummary}
          summaryTotals={section.summaryTotals}
          view={view}
          batch={batch}
          generator={generator}
          studentDepartmentId={studentDepartmentId}
          pageBreakAfter={index < sections.length - 1}
        />
      ))}
    </div>
  )
}

export default TimetablePDF
