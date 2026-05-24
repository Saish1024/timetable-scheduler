import { useCallback, useEffect, useMemo, useState } from 'react'
import { X, Trash2, AlertCircle, Plus, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../api/axios'
import SearchableSelect from './SearchableSelect'
import { selectClass } from '../styles/formControls'
import {
  isLecture,
  isPractical,
  formatSlotTypeLabel,
} from '../utils/slotTypes'
import { formatBatchLabel, formatDivisionTabLabel } from '../utils/departmentConfig'
import {
  getDivisions,
  getBatchesForDivision,
  isSingleClassMode,
} from '../utils/scheduleHelpers'

const emptyDraft = {
  division: '',
  slotType: 'lecture',
  batch: '',
  subjectId: '',
  facultyId: '',
  roomId: '',
  teachingDepartmentId: '',
}

const CONFLICT_ICONS = {
  FACULTY_CONFLICT: '🔴',
  ROOM_CONFLICT: '🟠',
  DIVISION_CONFLICT: '🟡',
  BATCH_CONFLICT: '🟣',
  LECTURE_BLOCKS_PRACTICAL: '🟡',
}

const conflictIcon = (type) => CONFLICT_ICONS[type] || '⚠️'

const SlotModal = ({
  open,
  onClose,
  onChanged,
  departmentId,
  academicYear,
  semester = 1,
  day,
  period,
  existingSlots = [],
  schedule,
  department = null,
  division = '',
  divisionBatches,
}) => {
  const [subjects, setSubjects] = useState([])
  const [assignments, setAssignments] = useState([])
  const [rooms, setRooms] = useState([])
  const [departments, setDepartments] = useState([])
  const [draft, setDraft] = useState(emptyDraft)
  const [cellSlots, setCellSlots] = useState(existingSlots)
  const [conflicts, setConflicts] = useState([])
  const [checkClean, setCheckClean] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const divisionOptions = useMemo(
    () => getDivisions(schedule, department),
    [schedule, department]
  )
  const showDivisionPicker =
    !isSingleClassMode(schedule) && divisionOptions.length > 1

  const batches = useMemo(() => {
    if (divisionBatches?.length && draft.division === division) {
      return divisionBatches
    }
    if (draft.division) {
      return getBatchesForDivision(schedule, draft.division, department)
    }
    return getBatchesForDivision(schedule, division, department)
  }, [divisionBatches, draft.division, division, schedule, department])

  const hasLecture = cellSlots.some((s) => isLecture(s.slotType))
  const usedBatches = useMemo(
    () =>
      new Set(
        cellSlots.filter((s) => s.batch).map((s) => String(s.batch).toUpperCase())
      ),
    [cellSlots]
  )
  const cellFull = hasLecture
  const hasConflicts = conflicts.length > 0

  const buildPayload = useCallback(() => {
    const periodNum = Number(period)
    const semesterNum = Number(semester)
    const deptId = departmentId || draft.teachingDepartmentId || ''
    return {
      day,
      period: periodNum,
      semester: semesterNum,
      academicYear,
      division: draft.division,
      slotType: draft.slotType,
      batch: isLecture(draft.slotType) ? null : draft.batch,
      subjectId: draft.subjectId,
      facultyId: draft.facultyId,
      roomId: draft.roomId,
      departmentId: deptId,
      teachingDepartmentId: draft.teachingDepartmentId || deptId,
      // Legacy field names (older API versions)
      subject: draft.subjectId,
      faculty: draft.facultyId,
      room: draft.roomId,
      department: deptId,
    }
  }, [day, period, draft, departmentId, semester, academicYear])

  const updateDraft = (patch) => {
    setDraft((d) => ({ ...d, ...patch }))
    setConflicts([])
    setCheckClean(null)
  }

  useEffect(() => {
    if (!open) return

    const defaultDivision =
      division ||
      divisionOptions[0]?.code ||
      ''

    setConflicts([])
    setCheckClean(null)
    setCellSlots(existingSlots)
    setDraft({
      ...emptyDraft,
      division: defaultDivision,
      slotType: 'lecture',
      batch: '',
      teachingDepartmentId: departmentId || '',
    })

    const fetchOptions = async () => {
      setLoading(true)
      try {
        const [subjectsRes, assignmentsRes, roomsRes, deptRes] = await Promise.all([
          api.get(`/api/subjects/${departmentId}/${semester}`),
          api.get(`/api/assignments/${departmentId}/${semester}`, {
            params: { academicYear },
          }),
          api.get('/api/rooms'),
          api.get('/api/departments'),
        ])
        setSubjects(subjectsRes.data.subjects || [])
        setAssignments(assignmentsRes.data.assignments || [])
        setRooms(roomsRes.data.rooms || roomsRes.data.data || [])
        setDepartments(deptRes.data.departments || [])
      } catch {
        toast.error('Failed to load options')
      } finally {
        setLoading(false)
      }
    }

    fetchOptions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, departmentId, semester, academicYear, day, period])

  useEffect(() => {
    setCellSlots(existingSlots)
  }, [existingSlots])

  useEffect(() => {
    if (!open || !draft.division || !day || !period) return

    let cancelled = false
    ;(async () => {
      try {
        const res = await api.get(
          `/api/timetable/${departmentId}/${semester}`,
          { params: { academicYear, division: draft.division } }
        )
        const slots = (res.data.slots || []).filter(
          (s) => s.day === day && Number(s.period) === Number(period)
        )
        if (!cancelled) setCellSlots(slots)
      } catch {
        if (!cancelled) setCellSlots([])
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    open,
    draft.division,
    day,
    period,
    departmentId,
    semester,
    academicYear,
  ])

  const facultyForSubject = useMemo(() => {
    if (!draft.subjectId) return []
    const seen = new Set()
    const list = []
    for (const a of assignments) {
      const sid = a.subject?._id || a.subject
      if (sid !== draft.subjectId) continue
      const fac = a.faculty
      const fid = fac?._id || fac
      if (!fid || seen.has(fid)) continue
      seen.add(fid)
      list.push(fac)
    }
    return list
  }, [assignments, draft.subjectId])

  const noFacultyAssigned =
    Boolean(draft.subjectId) && !loading && facultyForSubject.length === 0

  const subjectOptions = useMemo(
    () =>
      subjects.map((s) => ({
        value: s._id,
        label: `${s.code} — ${s.name}`,
      })),
    [subjects]
  )

  const facultyOptions = useMemo(
    () =>
      facultyForSubject.map((f) => ({
        value: f._id,
        label: `${f.name}${f.shortCode ? ` (${f.shortCode})` : ''}`,
      })),
    [facultyForSubject]
  )

  const roomOptions = useMemo(
    () =>
      rooms.map((r) => ({
        value: r._id,
        label: `${r.name} (${r.type})`,
      })),
    [rooms]
  )

  const facultyPlaceholder = !draft.subjectId
    ? 'Select a subject first...'
    : noFacultyAssigned
      ? 'No faculty assigned...'
      : 'Select faculty...'

  const validateForm = () => {
    if (!day || period == null || Number.isNaN(Number(period))) {
      toast.error('Missing day or period — close and click a cell again')
      return false
    }
    if (!departmentId || !academicYear || semester == null) {
      toast.error('Missing department, semester, or academic year')
      return false
    }
    if (!draft.division) {
      toast.error('Select a division')
      return false
    }
    if (cellFull) {
      toast.error('Cell already has a lecture slot')
      return false
    }
    if (!draft.subjectId || !draft.facultyId || !draft.roomId) {
      toast.error('Please select subject, faculty, and room')
      return false
    }
    if (isPractical(draft.slotType) && !draft.batch) {
      toast.error('Select a batch for practical')
      return false
    }
    if (noFacultyAssigned) {
      toast.error('HOD has not assigned faculty for this subject yet')
      return false
    }
    return true
  }

  const applyConflictResponse = (data, status) => {
    const list = data?.conflicts || []
    if (status === 409 || data?.hasConflicts) {
      setConflicts(list)
      setCheckClean(null)
      return true
    }
    setConflicts([])
    setCheckClean('No conflicts found!')
    return false
  }

  const handleCheckConflicts = async () => {
    if (!validateForm()) return

    setChecking(true)
    setCheckClean(null)
    try {
      const res = await api.post(
        '/api/timetable/check-conflicts',
        buildPayload(),
        {
          skipErrorToast: true,
          skipSuccessToast: true,
          validateStatus: (s) => s === 200 || s === 409,
        }
      )
      applyConflictResponse(res.data, res.status)
    } catch (err) {
      if (err.response?.status === 409) {
        applyConflictResponse(err.response.data, 409)
      } else {
        toast.error(
          err.response?.data?.message || 'Failed to check conflicts'
        )
      }
    } finally {
      setChecking(false)
    }
  }

  const fixConflicts = () => {
    const patch = {}
    for (const c of conflicts) {
      switch (c.type) {
        case 'FACULTY_CONFLICT':
          patch.facultyId = ''
          break
        case 'ROOM_CONFLICT':
          patch.roomId = ''
          break
        case 'BATCH_CONFLICT':
          patch.batch = ''
          break
        case 'DIVISION_CONFLICT':
          patch.subjectId = ''
          patch.facultyId = ''
          patch.roomId = ''
          break
        case 'LECTURE_BLOCKS_PRACTICAL':
          patch.batch = ''
          break
        default:
          break
      }
    }
    updateDraft(patch)
    setConflicts([])
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (hasConflicts) return
    if (!validateForm()) return

    setSaving(true)
    setCheckClean(null)
    try {
      await api.post('/api/timetable/slot', buildPayload(), {
        skipErrorToast: true,
        skipSuccessToast: false,
      })
      onChanged?.()
      setDraft({
        ...emptyDraft,
        division: draft.division,
        slotType: 'lecture',
        batch: '',
        teachingDepartmentId: departmentId || '',
      })
      setConflicts([])
    } catch (err) {
      if (err.response?.status === 409) {
        applyConflictResponse(err.response.data, 409)
      } else {
        toast.error(err.response?.data?.message || 'Failed to save slot')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (slotId) => {
    if (!window.confirm('Delete this slot?')) return
    setDeletingId(slotId)
    try {
      await api.delete(`/api/timetable/slot/${slotId}`)
      onChanged?.()
    } catch {
      /* error toast via axios interceptor */
    } finally {
      setDeletingId(null)
    }
  }

  const setSlotType = (type) => {
    const nextBatch =
      isLecture(type)
        ? ''
        : draft.batch &&
            !usedBatches.has(String(draft.batch).toUpperCase())
          ? draft.batch
          : batches.find((b) => !usedBatches.has(String(b).toUpperCase())) || ''
    updateDraft({ slotType: type, batch: nextBatch })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {day} · Period {period}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Semester {semester} · {academicYear}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-6 space-y-5">
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Existing slots in this cell
            </h3>
            {cellSlots.length === 0 ? (
              <p className="text-sm text-gray-500 italic">
                None yet. Add one below.
              </p>
            ) : (
              <ul className="space-y-2">
                {cellSlots.map((slot) => (
                  <li
                    key={slot._id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 bg-gray-50"
                  >
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">
                        {slot.subject?.code} — {slot.subject?.name}{' '}
                        {slot.batch && (
                          <span className="ml-1 text-xs font-mono bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded">
                            {formatBatchLabel(slot.batch, department)}
                          </span>
                        )}
                        <span className="ml-1 text-[10px] uppercase font-semibold text-gray-500">
                          {formatSlotTypeLabel(slot.slotType)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5">
                        {slot.faculty?.name}
                        {slot.faculty?.shortCode
                          ? ` (${slot.faculty.shortCode})`
                          : ''}{' '}
                        · {slot.room?.name}
                        {slot.teachingDepartment &&
                          String(slot.teachingDepartment._id) !==
                            String(slot.department?._id || slot.department) && (
                            <span className="text-amber-700">
                              {' '}
                              · teaches from {slot.teachingDepartment.code}
                            </span>
                          )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(slot._id)}
                      disabled={deletingId === slot._id}
                      className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                      title="Delete slot"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {cellFull ? (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
              This cell has a lecture — delete it before adding practical
              batches.
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Add slot</h3>

              {hasConflicts && (
                <div className="rounded-lg border border-red-300 bg-red-50 p-4 space-y-3">
                  <div className="flex gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                    <p className="text-sm font-semibold text-red-900">
                      Scheduling Conflicts Found
                    </p>
                  </div>
                  <ul className="space-y-2 text-sm text-red-800">
                    {conflicts.map((c, i) => (
                      <li key={`${c.type}-${i}`} className="flex gap-2">
                        <span className="shrink-0" aria-hidden>
                          {conflictIcon(c.type)}
                        </span>
                        <span>{c.message}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={fixConflicts}
                      className="px-3 py-1.5 text-sm font-medium text-red-900 bg-white border border-red-300 rounded-lg hover:bg-red-100"
                    >
                      Fix Conflicts
                    </button>
                    <button
                      type="button"
                      onClick={() => setConflicts([])}
                      className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {checkClean && !hasConflicts && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-green-600" />
                  {checkClean}
                </div>
              )}

              {showDivisionPicker && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Division
                  </label>
                  <select
                    value={draft.division}
                    onChange={(e) =>
                      updateDraft({
                        division: e.target.value,
                        batch: '',
                      })
                    }
                    disabled={loading}
                    required
                    className={`${selectClass} w-full min-w-0`}
                  >
                    <option value="">Select division...</option>
                    {divisionOptions.map((div) => (
                      <option key={div.code} value={div.code}>
                        {formatDivisionTabLabel(div, department)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Slot type
                </label>
                <div className="inline-flex rounded-lg border border-gray-300 p-0.5 bg-gray-50">
                  <button
                    type="button"
                    onClick={() => setSlotType('lecture')}
                    disabled={loading}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition ${
                      isLecture(draft.slotType)
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Lecture
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlotType('practical')}
                    disabled={loading}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition ${
                      isPractical(draft.slotType)
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Practical
                  </button>
                </div>
              </div>

              {isPractical(draft.slotType) && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Batch
                  </label>
                  <select
                    value={draft.batch}
                    onChange={(e) => updateDraft({ batch: e.target.value })}
                    required
                    disabled={loading}
                    className={`${selectClass} w-full min-w-0`}
                  >
                    <option value="">Select batch...</option>
                    {batches.map((b) => {
                      const taken = usedBatches.has(String(b).toUpperCase())
                      return (
                        <option key={b} value={b} disabled={taken}>
                          {formatBatchLabel(b, department)}
                          {taken ? ' (taken)' : ''}
                        </option>
                      )
                    })}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Subject
                </label>
                <SearchableSelect
                  value={draft.subjectId}
                  onChange={(subjectId) =>
                    updateDraft({
                      subjectId,
                      facultyId: '',
                    })
                  }
                  options={subjectOptions}
                  placeholder="Select subject..."
                  searchPlaceholder="Search subjects..."
                  disabled={loading}
                  required
                />
              </div>

              {noFacultyAssigned && (
                <div className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
                  <AlertCircle className="w-5 h-5 shrink-0 text-amber-600" />
                  <p>HOD has not assigned faculty for this subject yet.</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Teaching department
                </label>
                <select
                  value={draft.teachingDepartmentId}
                  onChange={(e) =>
                    updateDraft({ teachingDepartmentId: e.target.value })
                  }
                  disabled={loading}
                  className={`${selectClass} w-full min-w-0`}
                >
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.code} — {d.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-gray-500">
                  Change this only if faculty is from another department.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Faculty
                </label>
                <SearchableSelect
                  value={draft.facultyId}
                  onChange={(facultyId) => updateDraft({ facultyId })}
                  options={facultyOptions}
                  placeholder={facultyPlaceholder}
                  searchPlaceholder="Search faculty..."
                  disabled={loading || !draft.subjectId || noFacultyAssigned}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Room
                </label>
                <SearchableSelect
                  value={draft.roomId}
                  onChange={(roomId) => updateDraft({ roomId })}
                  options={roomOptions}
                  placeholder="Select room..."
                  searchPlaceholder="Search rooms..."
                  disabled={loading}
                  required
                />
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleCheckConflicts}
                  disabled={checking || loading || saving}
                  className="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg disabled:opacity-60"
                >
                  {checking ? 'Checking...' : 'Check Conflicts'}
                </button>
                <button
                  type="submit"
                  disabled={
                    saving || loading || checking || hasConflicts
                  }
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-60"
                >
                  <Plus className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default SlotModal
