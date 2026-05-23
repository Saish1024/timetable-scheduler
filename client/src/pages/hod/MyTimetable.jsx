import { useEffect, useState } from 'react'
import { Printer } from 'lucide-react'
import api from '../../api/axios'
import TimetableGrid from '../../components/TimetableGrid'
import { useHodDepartment, NoDepartmentMessage } from '../../hooks/useHodDepartment'
import ExportPDFPanel from '../../components/ExportPDFPanel'
import { selectClass } from '../../styles/formControls'
import {
  getActiveDivisionCode,
  prepareScheduleFromApi,
} from '../../utils/scheduleHelpers'

const ACADEMIC_YEAR = '2025-26'
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8]

const MyTimetable = () => {
  const { departmentId, departmentName, departmentCode, user } = useHodDepartment()
  const department = user?.department || null
  const [semester, setSemester] = useState(1)
  const [activeDivision, setActiveDivision] = useState('')
  const [exportPanelOpen, setExportPanelOpen] = useState(false)
  useEffect(() => {
    if (!departmentId) {
      setActiveDivision('')
      return
    }
    api
      .get(`/api/schedule/${departmentId}/${semester}`, {
        params: { academicYear: ACADEMIC_YEAR },
      })
      .then((res) => {
        const dept = department || res.data.departmentConfig
        const sched = prepareScheduleFromApi(res.data.schedule, dept)
        setActiveDivision(getActiveDivisionCode(sched, dept))
      })
      .catch(() => {
        setActiveDivision('')
      })
  }, [departmentId, semester, department])


  if (!departmentId) return <NoDepartmentMessage />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Timetable</h1>
          <p className="text-gray-600 mt-1 text-sm">
            {departmentCode ? `${departmentCode} — ` : ''}
            {departmentName || 'Department'} · Academic Year {ACADEMIC_YEAR}
          </p>
          <p className="text-gray-500 mt-1 text-xs">
            Click cells to add or edit slots. Saves are blocked when scheduling
            conflicts are detected — use Check Conflicts or fix the red warning
            icons first.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Semester
            </label>
            <select
              value={semester}
              onChange={(e) => setSemester(Number(e.target.value))}
              className={selectClass}
            >
              {SEMESTERS.map((s) => (
                <option key={s} value={s}>
                  Semester {s}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => setExportPanelOpen(true)}
            disabled={!departmentId}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Export timetable as PDF"
          >
            <Printer className="w-4 h-4" />
            Download PDF
          </button>
        </div>
      </div>

      <TimetableGrid
        key={`${departmentId}-${semester}`}
        departmentId={departmentId}
        department={department}
        semester={semester}
        division={activeDivision}
        onDivisionChange={setActiveDivision}
        academicYear={ACADEMIC_YEAR}
      />

      <ExportPDFPanel
        open={exportPanelOpen}
        onClose={() => setExportPanelOpen(false)}
        departmentId={departmentId}
        department={department}
        academicYear={ACADEMIC_YEAR}
        defaultSemester={semester}
        defaultDivision={activeDivision}
        generator={{ role: user?.role, name: user?.name }}
      />
    </div>
  )
}

export default MyTimetable
