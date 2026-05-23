import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, AlertTriangle, GripVertical, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../api/axios'
import SlotModal from './SlotModal'
import TimetableGridSkeleton from './TimetableGridSkeleton'
import { isLecture, isPractical } from '../utils/slotTypes'
import {
  formatBatchLabel,
  formatDivisionTabLabel,
} from '../utils/departmentConfig'
import {
  getDivisions,
  getBatchesForDivision,
  getActiveDivisionCode,
  isSingleClassMode,
  prepareScheduleFromApi,
} from '../utils/scheduleHelpers'

const DEFAULT_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

const FILTER_ALL = 'all'
const FILTER_LECTURE = 'lecture'
const FILTER_PRACTICAL = 'practical'

const cellKey = (day, period) => `${day}-${period}`

const DRAG_SLOT_MIME = 'application/x-timetable-slot-id'

const validateSlotDrop = (slot, targetSlots, toDay, toPeriod) => {
  if (!slot) return { ok: false, message: 'No slot to move' }
  if (slot.day === toDay && Number(slot.period) === Number(toPeriod)) {
    return { ok: false, message: 'Already in this cell' }
  }
  const others = targetSlots.filter(
    (s) => String(s._id) !== String(slot._id)
  )
  if (isLecture(slot.slotType)) {
    if (others.some((s) => isLecture(s.slotType))) {
      return { ok: false, message: 'This cell already has a lecture' }
    }
    return { ok: true }
  }
  if (isPractical(slot.slotType)) {
    if (others.some((s) => isLecture(s.slotType))) {
      return {
        ok: false,
        message: 'This cell has a lecture — remove it before adding practicals',
      }
    }
    const batch = String(slot.batch || '').toUpperCase()
    if (
      batch &&
      others.some((s) => String(s.batch || '').toUpperCase() === batch)
    ) {
      return { ok: false, message: `Batch ${slot.batch} is already in this cell` }
    }
    return { ok: true }
  }
  return { ok: true }
}

const getIntraCellConflictIds = (slots) => {
  const ids = new Set()
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i]
      const b = slots[j]
      const facultyA = a.faculty?._id || a.faculty
      const facultyB = b.faculty?._id || b.faculty
      const roomA = a.room?._id || a.room
      const roomB = b.room?._id || b.room
      if (facultyA && facultyB && String(facultyA) === String(facultyB)) {
        ids.add(a._id)
        ids.add(b._id)
      }
      if (roomA && roomB && String(roomA) === String(roomB)) {
        ids.add(a._id)
        ids.add(b._id)
      }
    }
  }
  return ids
}

const filterSlotsByView = (slots, viewFilter) => {
  if (viewFilter === FILTER_ALL) return slots
  if (viewFilter === FILTER_LECTURE) {
    return slots.filter((s) => isLecture(s.slotType))
  }
  if (viewFilter === FILTER_PRACTICAL) {
    return slots.filter((s) => isPractical(s.slotType))
  }
  return slots.filter(
    (s) => String(s.batch || '').toUpperCase() === viewFilter
  )
}

const TimetableGrid = ({
  departmentId,
  department = null,
  isReadOnly = false,
  requestChangeMode = false,
  onRequestChange,
  academicYear = '2025-26',
  semester = 1,
  division: divisionProp = '',
  onDivisionChange,
  onDataChange,
  onSlotsLoaded,
  className = '',
}) => {
  const [schedule, setSchedule] = useState(null)
  const [slots, setSlots] = useState([])
  const [activeDivision, setActiveDivision] = useState(divisionProp || '')
  const [viewFilter, setViewFilter] = useState(FILTER_ALL)
  const [conflictEntries, setConflictEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalState, setModalState] = useState({
    open: false,
    day: null,
    period: null,
  })
  const [dragSlot, setDragSlot] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)
  const [movingSlotId, setMovingSlotId] = useState(null)
  const [deletingSlotId, setDeletingSlotId] = useState(null)

  const divisions = useMemo(
    () => getDivisions(schedule, department),
    [schedule, department]
  )
  const showDivisionTabs =
    !isSingleClassMode(schedule) && divisions.length > 1
  const divisionBatches = useMemo(
    () => getBatchesForDivision(schedule, activeDivision, department),
    [schedule, activeDivision, department]
  )

  const conflictReasonsBySlotId = useMemo(() => {
    const map = new Map()
    for (const entry of conflictEntries) {
      const reasons = (entry.reasons || []).filter((r) => r.message)
      if (reasons.length) map.set(String(entry.slotId), reasons)
    }
    return map
  }, [conflictEntries])

  const conflictSlotIds = useMemo(
    () => new Set(conflictEntries.map((c) => String(c.slotId))),
    [conflictEntries]
  )

  const slotsByCell = useMemo(() => {
    const map = new Map()
    for (const slot of slots) {
      const key = cellKey(slot.day, slot.period)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(slot)
    }
    return map
  }, [slots])

  useEffect(() => {
    if (divisionProp) setActiveDivision(divisionProp)
  }, [divisionProp])

  useEffect(() => {
    if (!schedule && !department) return
    const divs = getDivisions(schedule, department)
    if (divs.length === 0) {
      setActiveDivision('')
      onDivisionChange?.('')
      return
    }
    const valid = divs.some((d) => d.code === activeDivision)
    if (!valid) {
      const next = getActiveDivisionCode(schedule, department)
      if (next !== activeDivision) {
        setActiveDivision(next)
        onDivisionChange?.(next)
      }
    }
  }, [schedule, department, activeDivision, onDivisionChange])

  const selectDivision = (code) => {
    setActiveDivision(code)
    setViewFilter(FILTER_ALL)
    onDivisionChange?.(code)
  }

  const fetchData = useCallback(async () => {
    if (!departmentId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const scheduleRes = await api.get(
        `/api/schedule/${departmentId}/${semester}`,
        { params: { academicYear } }
      )
      const sched = prepareScheduleFromApi(
        scheduleRes.data.schedule || null,
        department || scheduleRes.data.departmentConfig
      )
      setSchedule(sched)

      const divs = getDivisions(sched, department)
      const division =
        activeDivision ||
        getActiveDivisionCode(sched, department) ||
        divs[0]?.code ||
        ''

      if (!division) {
        setSlots([])
        setConflictEntries([])
        onSlotsLoaded?.(0)
        return
      }

      const [slotsRes, conflictsRes] = await Promise.all([
        api.get(`/api/timetable/${departmentId}/${semester}`, {
          params: { academicYear, division },
        }),
        api.get(`/api/timetable/${departmentId}/${semester}/conflicts`, {
          params: { academicYear, division },
        }),
      ])
      const loaded = slotsRes.data.slots || []
      setSlots(loaded)
      onSlotsLoaded?.(loaded.length)
      setConflictEntries(conflictsRes.data.conflicts || [])
    } catch {
      setSchedule(null)
      setSlots([])
      setConflictEntries([])
      onSlotsLoaded?.(0)
    } finally {
      setLoading(false)
    }
  }, [departmentId, department, academicYear, semester, activeDivision, onSlotsLoaded])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const days = schedule?.workingDays?.length
    ? schedule.workingDays
    : DEFAULT_DAYS
  const columns = schedule?.columns?.length
    ? [...schedule.columns].sort((a, b) => a.index - b.index)
    : DEFAULT_COLUMNS

  const filterOptions = useMemo(() => {
    const opts = [
      { id: FILTER_ALL, label: 'All' },
      { id: FILTER_LECTURE, label: 'Lectures only' },
      { id: FILTER_PRACTICAL, label: 'Practicals only' },
    ]
    for (const b of divisionBatches) {
      opts.push({
        id: String(b).toUpperCase(),
        label: formatBatchLabel(b, department),
      })
    }
    return opts
  }, [divisionBatches, department])

  const openCell = (day, period, kind) => {
    if (isReadOnly || requestChangeMode || kind !== 'class') return
    setModalState({ open: true, day, period })
  }

  const closeModal = () =>
    setModalState({ open: false, day: null, period: null })

  const handleChanged = () => {
    fetchData()
    onDataChange?.()
  }

  const handleDeleteSlot = useCallback(
    async (slot) => {
      const label =
        slot.subject?.code || slot.subject?.name || 'this slot'
      if (!window.confirm(`Delete ${label} from the timetable?`)) return

      setDeletingSlotId(String(slot._id))
      try {
        await api.delete(`/api/timetable/slot/${slot._id}`, {
          skipSuccessToast: true,
        })
        toast.success('Slot deleted')
        await fetchData()
        onDataChange?.()
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to delete slot')
      } finally {
        setDeletingSlotId(null)
      }
    },
    [fetchData, onDataChange]
  )

  const buildSlotPayload = useCallback(
    (slot, toDay, toPeriod) => {
      const deptId =
        slot.department?._id || slot.department || departmentId || ''
      const teachingDeptId =
        slot.teachingDepartment?._id ||
        slot.teachingDepartment ||
        deptId
      const subjectId = slot.subject?._id || slot.subject
      const facultyId = slot.faculty?._id || slot.faculty
      const roomId = slot.room?._id || slot.room
      return {
        day: toDay,
        period: Number(toPeriod),
        semester: Number(semester),
        academicYear,
        division: slot.division,
        slotType: slot.slotType,
        batch: isLecture(slot.slotType) ? null : slot.batch,
        subjectId,
        facultyId,
        roomId,
        departmentId: deptId,
        teachingDepartmentId: teachingDeptId,
        subject: subjectId,
        faculty: facultyId,
        room: roomId,
        department: deptId,
      }
    },
    [departmentId, semester, academicYear]
  )

  const copySlotToCell = useCallback(
    async (slot, toDay, toPeriod) => {
      const targetSlots = slotsByCell.get(cellKey(toDay, toPeriod)) || []
      const check = validateSlotDrop(slot, targetSlots, toDay, toPeriod)
      if (!check.ok) {
        toast.error(check.message)
        return
      }

      setMovingSlotId(String(slot._id))
      try {
        await api.post(
          '/api/timetable/slot',
          buildSlotPayload(slot, toDay, toPeriod),
          { skipErrorToast: true, skipSuccessToast: true }
        )
        toast.success('Slot copied')
        await fetchData()
        onDataChange?.()
      } catch (err) {
        if (err.response?.status === 409) {
          const list = err.response.data?.conflicts || []
          const msg =
            list[0]?.message ||
            err.response.data?.message ||
            'Cannot copy — scheduling conflict'
          toast.error(msg)
        } else {
          toast.error(
            err.response?.data?.message || 'Failed to copy slot'
          )
        }
      } finally {
        setMovingSlotId(null)
      }
    },
    [slotsByCell, buildSlotPayload, fetchData, onDataChange]
  )

  const handleSlotDragStart = useCallback((slot, e) => {
    setDragSlot(slot)
    e.dataTransfer.setData(DRAG_SLOT_MIME, String(slot._id))
    e.dataTransfer.effectAllowed = 'copy'
  }, [])

  const handleSlotDragEnd = useCallback(() => {
    setDragSlot(null)
    setDropTarget(null)
  }, [])

  const handleCellDragOver = useCallback(
    (day, period, e) => {
      if (!dragSlot || isReadOnly || requestChangeMode) return
      e.preventDefault()
      const targetSlots = slotsByCell.get(cellKey(day, period)) || []
      const check = validateSlotDrop(dragSlot, targetSlots, day, period)
      setDropTarget({ day, period, valid: check.ok, message: check.message })
      e.dataTransfer.dropEffect = check.ok ? 'copy' : 'none'
    },
    [dragSlot, slotsByCell, isReadOnly, requestChangeMode]
  )

  const handleCellDragLeave = useCallback((day, period, e) => {
    const next = e.relatedTarget
    if (next && e.currentTarget.contains(next)) return
    setDropTarget((prev) =>
      prev?.day === day && Number(prev?.period) === Number(period)
        ? null
        : prev
    )
  }, [])

  const handleCellDrop = useCallback(
    (day, period, e) => {
      e.preventDefault()
      e.stopPropagation()
      const slot = dragSlot
      setDropTarget(null)
      setDragSlot(null)
      if (!slot || isReadOnly || requestChangeMode) return
      copySlotToCell(slot, day, period)
    },
    [dragSlot, isReadOnly, requestChangeMode, copySlotToCell]
  )

  const cellSlots = (day, period) =>
    slotsByCell.get(cellKey(day, period)) || []

  const cellSlotsFiltered = (day, period) =>
    filterSlotsByView(cellSlots(day, period), viewFilter)

  if (loading) return <TimetableGridSkeleton />

  if (!activeDivision && divisions.length === 0) {
    return (
      <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900">
        Configure class structure on the Schedule page for this semester (single
        class or multiple divisions).
      </div>
    )
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {showDivisionTabs && (
        <div className="border-b border-gray-200">
          <div
            className="flex gap-1 overflow-x-auto pb-px"
            role="tablist"
            aria-label="Division tabs"
          >
            {divisions.map((div) => {
              const isActive = activeDivision === div.code
              return (
                <button
                  key={div.code}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => selectDivision(div.code)}
                  className={`shrink-0 px-4 py-2 text-sm font-medium border-b-2 transition ${
                    isActive
                      ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {formatDivisionTabLabel(div, department)}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 no-print">
        {filterOptions.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setViewFilter(opt.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition ${
              viewFilter === opt.id
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {!requestChangeMode && <Legend />}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white print-timetable">
        <table className="w-full min-w-[1100px] border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="sticky left-0 z-10 bg-gray-50 px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide border-b border-r border-gray-200 w-28">
                Day / Time
              </th>
              {columns.map((col) => (
                <th
                  key={col.index}
                  className={`px-2 py-3 text-[11px] font-semibold uppercase tracking-wide border-b border-gray-200 ${
                    col.kind === 'class'
                      ? 'text-gray-600'
                      : 'text-amber-800 bg-amber-50/80 align-middle min-w-[36px] w-[36px]'
                  }`}
                >
                  {col.kind === 'class' ? (
                    <span className="whitespace-nowrap">
                      {col.startTime}–{col.endTime}
                    </span>
                  ) : (
                    <span className="vertical-break-label">
                      {col.label ||
                        (col.kind === 'lunch_break'
                          ? 'LUNCH BREAK'
                          : 'SHORT BREAK')}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day} className="border-b border-gray-200 last:border-b-0">
                <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-left text-sm font-medium text-gray-700 border-r border-gray-200">
                  {day}
                </th>
                {columns.map((col) => {
                  if (col.kind !== 'class') {
                    return (
                      <td
                        key={`${day}-${col.index}`}
                        className="bg-amber-50/60 border-r border-gray-200 last:border-r-0 align-middle"
                      >
                        <span className="vertical-break-label text-amber-800 text-[10px] font-semibold">
                          {col.label ||
                            (col.kind === 'lunch_break' ? 'LUNCH' : 'BREAK')}
                        </span>
                      </td>
                    )
                  }
                  const allInCell = cellSlots(day, col.index)
                  const visible = cellSlotsFiltered(day, col.index)
                  return (
                    <Cell
                      key={`${day}-${col.index}`}
                      day={day}
                      period={col.index}
                      allSlots={allInCell}
                      visibleSlots={visible}
                      department={department}
                      conflictSlotIds={conflictSlotIds}
                      conflictReasonsBySlotId={conflictReasonsBySlotId}
                      isReadOnly={isReadOnly}
                      requestChangeMode={requestChangeMode}
                      dragEnabled={!isReadOnly && !requestChangeMode}
                      draggingSlotId={dragSlot?._id}
                      movingSlotId={movingSlotId}
                      dropTarget={dropTarget}
                      onSlotDragStart={handleSlotDragStart}
                      onSlotDragEnd={handleSlotDragEnd}
                      onCellDragOver={handleCellDragOver}
                      onCellDragLeave={handleCellDragLeave}
                      onCellDrop={handleCellDrop}
                      onRequestChange={onRequestChange}
                      onDeleteSlot={handleDeleteSlot}
                      canDelete={!isReadOnly && !requestChangeMode}
                      deletingSlotId={deletingSlotId}
                      onClick={() => openCell(day, col.index, col.kind)}
                    />
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!requestChangeMode && (
        <SlotModal
          open={modalState.open}
          onClose={closeModal}
          onChanged={handleChanged}
          departmentId={departmentId}
          academicYear={academicYear}
          semester={semester}
          day={modalState.day}
          period={modalState.period}
          existingSlots={
            modalState.day
              ? cellSlots(modalState.day, modalState.period)
              : []
          }
          schedule={schedule}
          department={department}
          division={activeDivision}
          divisionBatches={divisionBatches}
        />
      )}
    </div>
  )
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

const Cell = ({
  day,
  period,
  allSlots,
  visibleSlots,
  department,
  conflictSlotIds,
  conflictReasonsBySlotId,
  isReadOnly,
  requestChangeMode,
  dragEnabled = false,
  draggingSlotId,
  movingSlotId,
  dropTarget,
  onSlotDragStart,
  onSlotDragEnd,
  onCellDragOver,
  onCellDragLeave,
  onCellDrop,
  onRequestChange,
  onDeleteSlot,
  canDelete = false,
  deletingSlotId,
  onClick,
}) => {
  const isDropHere =
    dropTarget?.day === day && Number(dropTarget?.period) === Number(period)
  const dropValid = isDropHere && dropTarget?.valid
  const dropInvalid = isDropHere && !dropTarget?.valid

  const baseClasses =
    'align-top p-1 border-r border-gray-200 last:border-r-0 min-w-[120px] min-h-[7rem] transition relative'

  const dropHighlight = dropValid
    ? 'ring-2 ring-inset ring-indigo-400 bg-indigo-50/60'
    : dropInvalid
      ? 'ring-2 ring-inset ring-red-300 bg-red-50/40'
      : ''

  const cellDragProps =
    dragEnabled && !isReadOnly && !requestChangeMode
      ? {
          onDragOver: (e) => onCellDragOver?.(day, period, e),
          onDragLeave: (e) => onCellDragLeave?.(day, period, e),
          onDrop: (e) => onCellDrop?.(day, period, e),
        }
      : {}

  const intraCellConflictIds = getIntraCellConflictIds(allSlots)

  const cellConflictReasons = useMemo(() => {
    const seen = new Set()
    const reasons = []
    const add = (r) => {
      const key = `${r.type}:${r.message}`
      if (seen.has(key)) return
      seen.add(key)
      reasons.push(r)
    }
    for (const slot of allSlots) {
      const sid = String(slot._id)
      if (conflictSlotIds.has(sid)) {
        for (const r of conflictReasonsBySlotId.get(sid) || []) add(r)
      }
      if (intraCellConflictIds.has(slot._id)) {
        add({
          type: 'INTRA_CELL',
          message: 'Duplicate faculty or room in this cell',
        })
      }
    }
    return reasons
  }, [allSlots, conflictSlotIds, conflictReasonsBySlotId, intraCellConflictIds])

  const cellHasConflict = cellConflictReasons.length > 0

  if (visibleSlots.length === 0 && allSlots.length === 0) {
    if (isReadOnly || requestChangeMode) {
      return (
        <td className={`${baseClasses} bg-white`}>
          <span className="flex w-full h-full min-h-[6rem] text-gray-300 text-xs items-center justify-center">
            —
          </span>
        </td>
      )
    }
    return (
      <td className={`${baseClasses} ${dropHighlight}`} {...cellDragProps}>
        <button
          type="button"
          onClick={onClick}
          className="w-full min-h-[6rem] flex flex-col items-center justify-center gap-1 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition"
          aria-label="Add slot"
        >
          {dropValid ? (
            <span className="text-[11px] font-medium text-indigo-600">
              Drop to copy
            </span>
          ) : (
            <Plus className="w-5 h-5" />
          )}
          {dropInvalid && (
            <span className="text-[10px] text-red-600 px-2 text-center">
              {dropTarget.message}
            </span>
          )}
        </button>
      </td>
    )
  }

  const inner = (
    <div className="relative w-full min-h-[6rem]">
      {cellHasConflict && (
        <ConflictPopover reasons={cellConflictReasons} />
      )}
      {dropValid && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none rounded-md bg-indigo-100/70 border-2 border-dashed border-indigo-400">
          <span className="text-[11px] font-semibold text-indigo-700">
            Drop to copy
          </span>
        </div>
      )}
      {dropInvalid && (
        <div className="absolute bottom-1 left-1 right-6 z-10 pointer-events-none">
          <span className="text-[10px] text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
            {dropTarget.message}
          </span>
        </div>
      )}
      <div className="flex flex-col gap-1.5 pt-1 pr-6">
        {visibleSlots.map((slot) => (
          <SlotCard
            key={slot._id}
            slot={slot}
            department={department}
            draggable={dragEnabled}
            isDragging={String(draggingSlotId) === String(slot._id)}
            isMoving={String(movingSlotId) === String(slot._id)}
            isDeleting={String(deletingSlotId) === String(slot._id)}
            canDelete={canDelete}
            hasConflict={
              conflictSlotIds.has(String(slot._id)) ||
              intraCellConflictIds.has(slot._id)
            }
            onDragStart={onSlotDragStart}
            onDragEnd={onSlotDragEnd}
            onDelete={onDeleteSlot}
          />
        ))}
        {visibleSlots.length === 0 && allSlots.length > 0 && (
          <p className="text-[10px] text-gray-400 italic px-1 py-2">
            Hidden by filter ({allSlots.length} slot
            {allSlots.length === 1 ? '' : 's'} in cell)
          </p>
        )}
      </div>
      {requestChangeMode && visibleSlots[0] && (
        <button
          type="button"
          onClick={() => onRequestChange?.(visibleSlots[0])}
          className="mt-1 w-full px-2 py-0.5 text-[10px] font-medium text-indigo-700 bg-indigo-100 hover:bg-indigo-200 rounded transition no-print"
        >
          Request Change
        </button>
      )}
      {dragEnabled && !requestChangeMode && (
        <button
          type="button"
          onClick={onClick}
          className="mt-1 w-full py-1 text-[10px] text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
        >
          + Add slot
        </button>
      )}
    </div>
  )

  if (isReadOnly || requestChangeMode) {
    return <td className={`${baseClasses} ${dropHighlight}`}>{inner}</td>
  }

  return (
    <td className={`${baseClasses} ${dropHighlight}`} {...cellDragProps}>
      <div
        role="presentation"
        className="w-full min-h-[6rem] text-left rounded-md"
      >
        {inner}
      </div>
    </td>
  )
}

const CONFLICT_TYPE_META = {
  FACULTY_CONFLICT: { label: 'Faculty double-booked', icon: '🔴' },
  faculty: { label: 'Faculty double-booked', icon: '🔴' },
  ROOM_CONFLICT: { label: 'Room already in use', icon: '🟠' },
  room: { label: 'Room already in use', icon: '🟠' },
  DIVISION_CONFLICT: { label: 'Division lecture clash', icon: '🟡' },
  BATCH_CONFLICT: { label: 'Batch practical clash', icon: '🟣' },
  LECTURE_BLOCKS_PRACTICAL: { label: 'Lecture blocks practical', icon: '🟡' },
  INTRA_CELL_FACULTY: { label: 'Duplicate faculty in cell', icon: '🔴' },
  INTRA_CELL_ROOM: { label: 'Duplicate room in cell', icon: '🟠' },
  INTRA_CELL: { label: 'Cell conflict', icon: '⚠️' },
}

const PANEL_WIDTH = 300
const PANEL_MAX_HEIGHT = 320

const conflictTypeKey = (type) => String(type || '').toUpperCase()

const slotLocationLabel = (slot) => {
  if (!slot) return ''
  const parts = []
  const dept = slot.department?.code || slot.department?.name
  if (dept) parts.push(dept)
  if (slot.division) parts.push(slot.division)
  if (slot.batch) parts.push(`Batch ${slot.batch}`)
  if (slot.day) parts.push(slot.day)
  if (slot.period != null) parts.push(`Period ${slot.period}`)
  return parts.join(' · ')
}

const formatConflictMessage = (reason) => {
  const msg = (reason.message || '').trim()
  const slot = reason.existingSlot
  const type = conflictTypeKey(reason.type)

  const isVague =
    !msg ||
    /^conflict at\b/i.test(msg) ||
    (msg.length < 48 && /scheduled at|already used at/i.test(msg))

  if (!isVague) return msg

  const loc = slotLocationLabel(slot)
  const subject = slot?.subject?.code || slot?.subject?.name || 'another class'
  const faculty = slot?.faculty?.name || 'Faculty'
  const room = slot?.room?.name || 'Room'

  if (type === 'FACULTY_CONFLICT' || reason.type === 'faculty') {
    return `${faculty} is already teaching ${subject}${loc ? ` (${loc})` : ''}${slot?.room?.name ? ` in ${slot.room.name}` : ''}`
  }
  if (type === 'ROOM_CONFLICT' || reason.type === 'room') {
    return `${room} is already booked for ${subject} with ${faculty}${loc ? ` (${loc})` : ''}`
  }
  if (type === 'INTRA_CELL_FACULTY') {
    return `${faculty} is listed twice in this time slot (${subject})`
  }
  if (type === 'INTRA_CELL_ROOM') {
    return `${room} is listed twice in this time slot (${subject})`
  }
  if (type === 'DIVISION_CONFLICT') {
    return `This division already has a lecture here (${subject}${loc ? ` · ${loc}` : ''})`
  }
  if (type === 'BATCH_CONFLICT') {
    return `This batch already has a practical here (${subject}${loc ? ` · ${loc}` : ''})`
  }
  if (type === 'LECTURE_BLOCKS_PRACTICAL') {
    return `A lecture in this division blocks this practical (${subject}${loc ? ` · ${loc}` : ''})`
  }

  return msg || 'Scheduling conflict detected'
}

const conflictMeta = (type) => {
  const key = conflictTypeKey(type)
  return (
    CONFLICT_TYPE_META[type] ||
    CONFLICT_TYPE_META[key] || {
      label: 'Scheduling conflict',
      icon: '⚠️',
    }
  )
}

const ConflictPopover = ({ reasons }) => {
  const [open, setOpen] = useState(false)
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 })
  const anchorRef = useRef(null)
  const panelRef = useRef(null)

  const updatePanelPosition = useCallback(() => {
    const anchor = anchorRef.current
    if (!anchor) return

    const rect = anchor.getBoundingClientRect()
    const margin = 8
    const panelHeight = panelRef.current?.offsetHeight || PANEL_MAX_HEIGHT

    let left = rect.right - PANEL_WIDTH
    if (left < margin) left = margin
    if (left + PANEL_WIDTH > window.innerWidth - margin) {
      left = window.innerWidth - PANEL_WIDTH - margin
    }

    let top = rect.bottom + margin
    if (top + panelHeight > window.innerHeight - margin) {
      top = rect.top - panelHeight - margin
    }
    if (top < margin) top = margin

    setPanelPos({ top, left })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updatePanelPosition()
    const raf = requestAnimationFrame(updatePanelPosition)
    window.addEventListener('resize', updatePanelPosition)
    window.addEventListener('scroll', updatePanelPosition, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', updatePanelPosition)
      window.removeEventListener('scroll', updatePanelPosition, true)
    }
  }, [open, updatePanelPosition, reasons])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e) => {
      const anchor = anchorRef.current
      const panel = panelRef.current
      if (
        anchor?.contains(e.target) ||
        panel?.contains(e.target)
      ) {
        return
      }
      setOpen(false)
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const toggle = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setOpen((v) => !v)
  }

  const panel = open
    ? createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Conflict details"
          className="fixed rounded-lg border border-red-200 bg-white shadow-2xl text-left"
          style={{
            top: panelPos.top,
            left: panelPos.left,
            width: PANEL_WIDTH,
            maxHeight: PANEL_MAX_HEIGHT,
            zIndex: 9999,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 border-b border-red-100 bg-red-50 rounded-t-lg">
            <p className="text-xs font-semibold text-red-900">
              Scheduling conflicts
            </p>
            <p className="text-[10px] text-red-700 mt-0.5">
              Click outside or press Esc to close
            </p>
          </div>
          <ul className="overflow-y-auto p-2 space-y-2 max-h-[260px]">
            {reasons.map((r, i) => {
              const meta = conflictMeta(r.type)
              const detail = formatConflictMessage(r)
              return (
                <li
                  key={`${r.type}-${i}`}
                  className="rounded-md border border-gray-200 bg-gray-50 px-2.5 py-2"
                >
                  <p className="text-[11px] font-semibold text-gray-900 flex items-center gap-1.5">
                    <span className="shrink-0" aria-hidden>
                      {meta.icon}
                    </span>
                    <span>{meta.label}</span>
                  </p>
                  <p className="text-[11px] text-gray-800 mt-1 leading-relaxed break-words">
                    {detail}
                  </p>
                  {r.existingSlot && (
                    <ConflictSlotSummary slot={r.existingSlot} />
                  )}
                </li>
              )
            })}
          </ul>
        </div>,
        document.body
      )
    : null

  return (
    <>
      <span className="absolute top-1 right-1 z-20">
        <button
          ref={anchorRef}
          type="button"
          onClick={toggle}
          className="p-0.5 rounded hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400"
          aria-label="View scheduling conflicts"
          aria-expanded={open}
        >
          <AlertTriangle className="w-4 h-4 text-red-600 drop-shadow-sm" />
        </button>
      </span>
      {panel}
    </>
  )
}

const ConflictSlotSummary = ({ slot }) => {
  const loc = slotLocationLabel(slot)
  const subject = slot.subject?.code || slot.subject?.name
  const faculty = slot.faculty?.name
  const room = slot.room?.name
  if (!loc && !subject && !faculty && !room) return null

  return (
    <div className="text-[10px] text-gray-600 mt-2 pt-2 border-t border-gray-200 space-y-1">
      {loc && (
        <p>
          <span className="font-medium text-gray-500">When / where: </span>
          {loc}
        </p>
      )}
      {subject && (
        <p>
          <span className="font-medium text-gray-500">Subject: </span>
          {subject}
        </p>
      )}
      {faculty && (
        <p>
          <span className="font-medium text-gray-500">Faculty: </span>
          {faculty}
        </p>
      )}
      {room && (
        <p>
          <span className="font-medium text-gray-500">Room: </span>
          {room}
        </p>
      )}
    </div>
  )
}

const SlotCard = ({
  slot,
  hasConflict,
  department,
  draggable = false,
  canDelete = false,
  isDragging = false,
  isMoving = false,
  isDeleting = false,
  onDragStart,
  onDragEnd,
  onDelete,
}) => {
  const lecture = isLecture(slot.slotType)
  const subjectCode = slot.subject?.code || '?'
  const facultyName = slot.faculty?.name || '—'
  const roomName = slot.room?.name || '—'
  const badge = lecture
    ? 'Lec'
    : formatBatchLabel(slot.batch || '?', department)

  const handleDragStart = (e) => {
    if (!draggable) return
    e.stopPropagation()
    onDragStart?.(slot, e)
  }

  const handleDelete = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isDeleting) onDelete?.(slot)
  }

  return (
    <div
      draggable={draggable && !isDeleting}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      className={`relative rounded-md bg-white border border-gray-200 shadow-sm overflow-hidden select-none ${
        hasConflict ? 'ring-1 ring-red-300' : ''
      } ${isDragging ? 'opacity-40 scale-[0.98]' : ''} ${
        isMoving || isDeleting ? 'opacity-60 animate-pulse' : ''
      } ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
      title={draggable ? 'Drag to copy to another time slot' : undefined}
    >
      {canDelete && onDelete && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className="absolute top-0.5 right-0.5 z-10 p-0.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 no-print"
          aria-label={`Delete ${subjectCode}`}
          title="Delete slot"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
      <div
        className={`border-l-4 py-1.5 ${
          lecture ? 'border-blue-500' : 'border-orange-500'
        } ${draggable ? 'pl-1 pr-1.5' : 'pl-2 pr-1.5'} ${
          canDelete ? 'pr-5' : ''
        }`}
      >
        <div className="flex items-start gap-0.5">
          {draggable && (
            <span
              className="shrink-0 pt-0.5 text-gray-400 touch-none"
              aria-hidden
            >
              <GripVertical className="w-3.5 h-3.5" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-1 pr-1">
              <span className="font-bold text-[11px] text-gray-900 leading-tight">
                {subjectCode}
              </span>
              <span
                className={`shrink-0 text-[9px] font-semibold uppercase px-1 py-0.5 rounded ${
                  lecture
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-orange-100 text-orange-800'
                }`}
              >
                {badge}
              </span>
            </div>
            <p className="text-[10px] text-gray-700 mt-0.5 truncate">
              {facultyName}
            </p>
            <p className="text-[10px] text-gray-500 truncate">{roomName}</p>
            <StatusDot status={slot.status} />
          </div>
        </div>
      </div>
    </div>
  )
}

const StatusDot = ({ status }) => {
  const published = status === 'published'
  return (
    <span
      className={`inline-block mt-1 w-1.5 h-1.5 rounded-full ${
        published ? 'bg-green-500' : 'bg-yellow-400'
      }`}
      title={published ? 'Published' : 'Draft'}
    />
  )
}

const Legend = () => (
  <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600 no-print">
    <div className="flex items-center gap-1.5">
      <span className="w-1 h-4 rounded-sm bg-blue-500" />
      <span>Lecture</span>
    </div>
    <div className="flex items-center gap-1.5">
      <span className="w-1 h-4 rounded-sm bg-orange-500" />
      <span>Practical</span>
    </div>
    <div className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full bg-green-500" />
      <span>Published</span>
    </div>
    <div className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full bg-yellow-400" />
      <span>Draft</span>
    </div>
    <div className="flex items-center gap-1.5">
      <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
      <span>Conflict (click icon for details)</span>
    </div>
    <div className="flex items-center gap-1.5">
      <GripVertical className="w-3.5 h-3.5 text-gray-500" />
      <span>Drag slot to copy</span>
    </div>
  </div>
)

export default TimetableGrid
