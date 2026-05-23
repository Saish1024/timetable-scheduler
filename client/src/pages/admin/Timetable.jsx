import { useCallback, useEffect, useMemo, useState } from 'react'
import { Printer, Send } from 'lucide-react'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import TimetableGrid from '../../components/TimetableGrid'
import ExportPDFPanel from '../../components/ExportPDFPanel'
import { selectClass } from '../../styles/formControls'
import {
  getActiveDivisionCode,
  isSingleClassMode,
  prepareScheduleFromApi,
} from '../../utils/scheduleHelpers'

const ACADEMIC_YEAR = '2025-26'
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8]

const deriveSemesterStatus = (slots) => {
  if (!slots?.length) return 'draft'
  return slots.every((s) => s.status === 'published') ? 'published' : 'draft'
}

const StatusBadge = ({ status }) => {
  const published = status === 'published'
  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        published
          ? 'bg-green-100 text-green-800'
          : 'bg-amber-100 text-amber-800'
      }`}
    >
      {published ? 'Published' : 'Draft'}
    </span>
  )
}

const Timetable = () => {
  const { user } = useAuth()
  const [departments, setDepartments] = useState([])
  const [departmentId, setDepartmentId] = useState('')
  const [activeSemester, setActiveSemester] = useState(1)
  const [semesterStatuses, setSemesterStatuses] = useState({})
  const [statusLoading, setStatusLoading] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [exportPanelOpen, setExportPanelOpen] = useState(false)
  const [gridKey, setGridKey] = useState(0)
  const [scheduleConfig, setScheduleConfig] = useState(null)
  const [activeDivision, setActiveDivision] = useState('')
  const singleClass = isSingleClassMode(scheduleConfig)

  const activeDepartment = useMemo(
    () => departments.find((d) => d._id === departmentId) || null,
    [departments, departmentId]
  )

  useEffect(() => {
    api
      .get('/api/departments')
      .then((res) => {
        const list = res.data.departments || []
        setDepartments(list)
        if (list[0]) setDepartmentId((prev) => prev || list[0]._id)
      })
      .catch(() => {})
  }, [])

  const fetchSemesterStatuses = useCallback(async () => {
    if (!departmentId) {
      setSemesterStatuses({})
      return
    }
    setStatusLoading(true)
    try {
      const results = await Promise.all(
        SEMESTERS.map((sem) =>
          api
            .get(`/api/timetable/${departmentId}/${sem}`, {
              params: { academicYear: ACADEMIC_YEAR },
            })
            .then((res) => {
              const slots = res.data.slots || []
              return {
                sem,
                status: deriveSemesterStatus(slots),
                slotCount: slots.length,
              }
            })
            .catch(() => ({ sem, status: 'draft', slotCount: 0 }))
        )
      )
      setSemesterStatuses(
        results.reduce((acc, { sem, status }) => {
          acc[sem] = status
          return acc
        }, {})
      )
    } finally {
      setStatusLoading(false)
    }
  }, [departmentId])

  useEffect(() => {
    fetchSemesterStatuses()
  }, [fetchSemesterStatuses])

  useEffect(() => {
    if (!departmentId) {
      setScheduleConfig(null)
      setActiveDivision('')
      return
    }
    api
      .get(`/api/schedule/${departmentId}/${activeSemester}`, {
        params: { academicYear: ACADEMIC_YEAR },
      })
      .then((res) => {
        const dept =
          departments.find((d) => d._id === departmentId) ||
          res.data.departmentConfig
        const sched = prepareScheduleFromApi(res.data.schedule, dept)
        setScheduleConfig(sched)
        setActiveDivision(getActiveDivisionCode(sched, dept))
      })
      .catch(() => {
        setScheduleConfig(null)
        setActiveDivision('')
      })
  }, [departmentId, activeSemester, departments])

  const handleGridChange = () => {
    fetchSemesterStatuses()
  }

  const handlePublish = async (semester, divisionCode) => {
    if (!departmentId) return
    const dept = departments.find((d) => d._id === departmentId)
    const label = dept ? `${dept.code} — ${dept.name}` : 'this department'
    const divLabel = divisionCode ? `, Division ${divisionCode}` : ''
    if (
      !window.confirm(
        `Publish draft timetable slots for ${label}, Semester ${semester}${divLabel}? This will make them visible to HODs.`
      )
    ) {
      return
    }

    setPublishing(true)
    try {
      await api.post(`/api/timetable/publish/${departmentId}/${semester}`, {
        academicYear: ACADEMIC_YEAR,
        ...(divisionCode ? { division: divisionCode } : {}),
      })
      await fetchSemesterStatuses()
      if (semester === activeSemester) {
        setGridKey((k) => k + 1)
      }
    } catch {
      /* error toast via axios interceptor */
    } finally {
      setPublishing(false)
    }
  }

  const activeStatus = semesterStatuses[activeSemester] || 'draft'


  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Timetable</h1>
        <p className="text-gray-600 mt-1 text-sm">
          Create slots by semester, resolve conflicts, and publish timetables.
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Department
        </label>
        <select
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          className={selectClass}
        >
          <option value="">Select department...</option>
          {departments.map((d) => (
            <option key={d._id} value={d._id}>
              {d.code} — {d.name}
            </option>
          ))}
        </select>
      </div>

      {departmentId ? (
        <>
          <div className="border-b border-gray-200">
            <div
              className="flex gap-1 overflow-x-auto pb-px"
              role="tablist"
              aria-label="Semester tabs"
            >
              {SEMESTERS.map((sem) => {
                const isActive = activeSemester === sem
                const status = semesterStatuses[sem] || 'draft'
                const isPublished = status === 'published'
                return (
                  <div
                    key={sem}
                    className={`shrink-0 flex items-stretch border-b-2 ${
                      isActive ? 'border-indigo-600' : 'border-transparent'
                    }`}
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveSemester(sem)}
                      className={`flex flex-col items-center gap-1 px-3 py-2.5 text-sm font-medium transition ${
                        isActive
                          ? 'text-indigo-700 bg-indigo-50/50'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      <span>Sem {sem}</span>
                      <StatusBadge
                        status={statusLoading ? 'draft' : status}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePublish(sem)}
                      disabled={publishing || isPublished}
                      title={
                        isPublished
                          ? `Semester ${sem} is fully published`
                          : `Publish all draft slots for semester ${sem}`
                      }
                      className="px-2 text-gray-400 hover:text-green-700 hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed border-l border-gray-100"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-600">
              Semester {activeSemester}
              {!singleClass && activeDivision ? ` · ${activeDivision}` : ''}
              <span className="mx-2 text-gray-300">·</span>
              <StatusBadge status={activeStatus} />
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setExportPanelOpen(true)}
                disabled={!departmentId}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-800 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Export timetable as PDF"
              >
                <Printer className="w-4 h-4" />
                Download PDF
              </button>
              <button
                type="button"
                onClick={() => handlePublish(activeSemester, activeDivision)}
                disabled={
                  publishing ||
                  !activeDivision ||
                  activeStatus === 'published'
                }
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  activeStatus === 'published'
                    ? 'All slots are already published'
                    : `Publish draft slots for division ${activeDivision || ''}`
                }
              >
                <Send className="w-4 h-4" />
                {publishing
                  ? 'Publishing...'
                  : activeDivision
                    ? `Publish ${activeDivision}`
                    : 'Publish'}
              </button>
            </div>
          </div>

          <TimetableGrid
            key={`${gridKey}-${departmentId}-${activeSemester}`}
            departmentId={departmentId}
            department={activeDepartment}
            semester={activeSemester}
            division={activeDivision}
            onDivisionChange={setActiveDivision}
            academicYear={ACADEMIC_YEAR}
            onDataChange={handleGridChange}
          />

          <ExportPDFPanel
            open={exportPanelOpen}
            onClose={() => setExportPanelOpen(false)}
            departmentId={departmentId}
            department={activeDepartment}
            academicYear={ACADEMIC_YEAR}
            defaultSemester={activeSemester}
            defaultDivision={activeDivision}
            generator={{ role: user?.role, name: user?.name }}
          />
        </>
      ) : (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
          Select a department to view and edit timetables.
        </div>
      )}
    </div>
  )
}

export default Timetable
