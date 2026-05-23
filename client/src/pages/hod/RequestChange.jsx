import { useEffect, useState } from 'react'
import api from '../../api/axios'
import TimetableGrid from '../../components/TimetableGrid'
import ChangeRequestModal from '../../components/hod/ChangeRequestModal'
import { useHodDepartment, NoDepartmentMessage } from '../../hooks/useHodDepartment'
import { selectClass } from '../../styles/formControls'
import {
  getActiveDivisionCode,
  getDivisions,
  isSingleClassMode,
  prepareScheduleFromApi,
} from '../../utils/scheduleHelpers'

const ACADEMIC_YEAR = '2025-26'
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8]

const RequestChange = () => {
  const { departmentId } = useHodDepartment()
  const [semester, setSemester] = useState(1)
  const [scheduleConfig, setScheduleConfig] = useState(null)
  const [divisions, setDivisions] = useState([])
  const [activeDivision, setActiveDivision] = useState('')
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [gridKey, setGridKey] = useState(0)
  const singleClass = isSingleClassMode(scheduleConfig)

  useEffect(() => {
    if (!departmentId) {
      setScheduleConfig(null)
      setDivisions([])
      setActiveDivision('')
      return
    }
    api
      .get(`/api/schedule/${departmentId}/${semester}`, {
        params: { academicYear: ACADEMIC_YEAR },
      })
      .then((res) => {
        const sched = prepareScheduleFromApi(res.data.schedule)
        setScheduleConfig(sched)
        setDivisions(getDivisions(sched))
        setActiveDivision(getActiveDivisionCode(sched))
      })
      .catch(() => {
        setScheduleConfig(null)
        setDivisions([])
        setActiveDivision('')
      })
  }, [departmentId, semester])

  const handleRequestChange = (slot) => {
    setSelectedSlot(slot)
    setModalOpen(true)
  }

  const handleSubmitted = () => setGridKey((k) => k + 1)

  if (!departmentId) return <NoDepartmentMessage />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Request Change</h1>
          <p className="text-gray-600 text-sm mt-1">
            Click &quot;Request Change&quot; on any scheduled slot to submit a change
            request to the admin.
          </p>
        </div>
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
      </div>

      <TimetableGrid
        key={`${gridKey}-${departmentId}-${semester}`}
        departmentId={departmentId}
        semester={semester}
        division={activeDivision}
        onDivisionChange={setActiveDivision}
        isReadOnly
        requestChangeMode
        onRequestChange={handleRequestChange}
        academicYear={ACADEMIC_YEAR}
      />

      <ChangeRequestModal
        open={modalOpen}
        slot={selectedSlot}
        onClose={() => {
          setModalOpen(false)
          setSelectedSlot(null)
        }}
        onSubmitted={handleSubmitted}
      />
    </div>
  )
}

export default RequestChange
