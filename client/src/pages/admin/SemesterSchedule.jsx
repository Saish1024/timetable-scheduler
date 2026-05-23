import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import { inputClass, selectClass } from '../../styles/formControls'
import {
  batchCodesFromDepartment,
  buildDivisionsFromDepartment,
  divisionToCode,
  normalizeDivisionsList,
} from '../../utils/departmentConfig'
import {
  CLASS_MODE_MULTI,
  CLASS_MODE_SINGLE,
  SINGLE_CLASS_CODE,
  isSingleClassMode,
  prepareScheduleFromApi,
} from '../../utils/scheduleHelpers'

const ACADEMIC_YEAR = '2025-26'
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8]
const WORKING_DAY_OPTIONS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]
const COLUMN_KINDS = [
  { value: 'class', label: 'Class' },
  { value: 'short_break', label: 'Short Break' },
  { value: 'lunch_break', label: 'Lunch Break' },
]

const toDateInput = (value) => {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

const SemesterSchedule = () => {
  const [departments, setDepartments] = useState([])
  const [departmentId, setDepartmentId] = useState('')
  const [semester, setSemester] = useState(1)
  const [schedule, setSchedule] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)

  const activeDept = useMemo(
    () => departments.find((d) => d._id === departmentId) || null,
    [departments, departmentId]
  )
  const defaultBatchCodes = useMemo(
    () => batchCodesFromDepartment(activeDept),
    [activeDept]
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

  const fetchSchedule = useCallback(async () => {
    if (!departmentId) {
      setSchedule(null)
      return
    }
    setLoading(true)
    try {
      const { data } = await api.get(
        `/api/schedule/${departmentId}/${semester}`,
        { params: { academicYear: ACADEMIC_YEAR } }
      )
      setSchedule(prepareScheduleFromApi(data.schedule))
    } catch {
      setSchedule(null)
    } finally {
      setLoading(false)
    }
  }, [departmentId, semester])

  useEffect(() => {
    fetchSchedule()
  }, [fetchSchedule])

  const updateScheduleField = (field, value) => {
    setSchedule((prev) => (prev ? { ...prev, [field]: value } : prev))
  }

  const toggleWorkingDay = (day) => {
    setSchedule((prev) => {
      if (!prev) return prev
      const current = new Set(prev.workingDays || [])
      if (current.has(day)) current.delete(day)
      else current.add(day)
      return {
        ...prev,
        workingDays: WORKING_DAY_OPTIONS.filter((d) => current.has(d)),
      }
    })
  }

  const updateColumn = (idx, patch) => {
    setSchedule((prev) => {
      if (!prev) return prev
      const cols = [...(prev.columns || [])]
      cols[idx] = { ...cols[idx], ...patch }
      return { ...prev, columns: cols }
    })
  }

  const removeColumn = (idx) => {
    setSchedule((prev) => {
      if (!prev) return prev
      const cols = (prev.columns || [])
        .filter((_, i) => i !== idx)
        .map((c, i) => ({ ...c, index: i + 1 }))
      return { ...prev, columns: cols }
    })
  }

  const updateDivision = (idx, patch) => {
    setSchedule((prev) => {
      if (!prev) return prev
      const divisions = [...(prev.divisions || [])]
      divisions[idx] = { ...divisions[idx], ...patch }
      return { ...prev, divisions }
    })
  }

  const updateDivisionBatches = (idx, text) => {
    const batches = text
      .split(',')
      .map((b) => b.trim().toUpperCase())
      .filter(Boolean)
    updateDivision(idx, { batches })
  }

  const addDivision = () => {
    setSchedule((prev) => {
      if (!prev) return prev
      const divisions = [...(prev.divisions || [])]
      const used = new Set(divisions.map((d) => d.code))
      const deptNames = normalizeDivisionsList(activeDept?.divisions)
      let code = divisionToCode(deptNames[0] || 'A')
      for (const name of deptNames) {
        const candidate = divisionToCode(name)
        if (!used.has(candidate)) {
          code = candidate
          break
        }
      }
      divisions.push({ code, label: '', batches: [...defaultBatchCodes] })
      return { ...prev, divisions }
    })
  }

  const removeDivision = (idx) => {
    setSchedule((prev) => {
      if (!prev || (prev.divisions || []).length <= 1) {
        toast.error('At least one division is required')
        return prev
      }
      const divisions = (prev.divisions || []).filter((_, i) => i !== idx)
      return { ...prev, divisions }
    })
  }

  const addColumn = (kind = 'class') => {
    setSchedule((prev) => {
      if (!prev) return prev
      const cols = [...(prev.columns || [])]
      const last = cols[cols.length - 1]
      const nextStart = last ? last.endTime : '09:00'
      cols.push({
        index: cols.length + 1,
        kind,
        startTime: nextStart,
        endTime: nextStart,
        label: kind === 'short_break'
          ? 'SHORT BREAK'
          : kind === 'lunch_break'
            ? 'LUNCH BREAK'
            : '',
      })
      return { ...prev, columns: cols }
    })
  }

  const setClassMode = (mode) => {
    setSchedule((prev) => {
      if (!prev) return prev
      if (mode === CLASS_MODE_SINGLE) {
        const batches = prev.divisions?.[0]?.batches?.length
          ? prev.divisions[0].batches
          : [...defaultBatchCodes]
        return {
          ...prev,
          classMode: CLASS_MODE_SINGLE,
          divisions: [{ code: SINGLE_CLASS_CODE, label: '', batches }],
        }
      }
      const existing = (prev.divisions || []).filter(
        (d) => d.code && d.code !== SINGLE_CLASS_CODE
      )
      const divisions =
        existing.length > 0
          ? existing
          : buildDivisionsFromDepartment(activeDept, CLASS_MODE_MULTI)
      return { ...prev, classMode: CLASS_MODE_MULTI, divisions }
    })
  }

  const updateSingleClassBatches = (text) => {
    const batches = text
      .split(',')
      .map((b) => b.trim().toUpperCase())
      .filter(Boolean)
    setSchedule((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        classMode: CLASS_MODE_SINGLE,
        divisions: [{ code: SINGLE_CLASS_CODE, label: '', batches }],
      }
    })
  }

  const handleSave = async () => {
    if (!schedule) return
    const single = isSingleClassMode(schedule)
    let divisions

    if (single) {
      const batches = (schedule.divisions?.[0]?.batches || [])
        .map((b) => String(b).trim().toUpperCase())
        .filter(Boolean)
      if (batches.length === 0) {
        toast.error('Enter at least one batch (e.g. A, B, C)')
        return
      }
      divisions = [{ code: SINGLE_CLASS_CODE, label: '', batches }]
    } else {
      divisions = (schedule.divisions || [])
        .map((d) => ({
          code: String(d.code || '').trim(),
          label: String(d.label || '').trim(),
          batches: (d.batches || [])
            .map((b) => String(b).trim().toUpperCase())
            .filter(Boolean),
        }))
        .filter((d) => d.code)

      const codes = new Set()
      for (const d of divisions) {
        if (codes.has(d.code)) {
          toast.error(`Duplicate division name: ${d.code}`)
          return
        }
        codes.add(d.code)
        if (d.batches.length === 0) {
          toast.error(`${d.code} needs at least one batch`)
          return
        }
      }
      if (divisions.length === 0) {
        toast.error('Add at least one division')
        return
      }
    }

    setSaving(true)
    try {
      const { data } = await api.put(
        `/api/schedule/${departmentId}/${semester}`,
        {
          ...schedule,
          classMode: single ? CLASS_MODE_SINGLE : CLASS_MODE_MULTI,
          divisions,
          academicYear: ACADEMIC_YEAR,
        }
      )
      setSchedule(prepareScheduleFromApi(data.schedule))
    } catch {
      /* error toast via axios interceptor */
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!departmentId) return
    if (!window.confirm('Reset period columns and working days to defaults? Divisions are kept.')) return
    setResetting(true)
    try {
      const { data } = await api.post(
        `/api/schedule/${departmentId}/${semester}/reset`,
        { academicYear: ACADEMIC_YEAR }
      )
      setSchedule(data.schedule)
      toast.success('Schedule reset to defaults')
    } catch {
      /* error toast via axios interceptor */
    } finally {
      setResetting(false)
    }
  }

  const totalClassColumns = useMemo(
    () =>
      (schedule?.columns || []).filter((c) => c.kind === 'class').length,
    [schedule]
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Semester Schedule</h1>
        <p className="text-gray-600 text-sm mt-1">
          Configure period times, breaks, divisions, and header metadata per
          department and semester.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
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
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Semester
          </label>
          <select
            value={semester}
            onChange={(e) => setSemester(Number(e.target.value))}
            className={selectClass}
            disabled={!departmentId}
          >
            {SEMESTERS.map((s) => (
              <option key={s} value={s}>
                Semester {s}
              </option>
            ))}
          </select>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={!schedule || resetting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            {resetting ? 'Resetting...' : 'Reset Defaults'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!schedule || saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-6 bg-white border border-gray-200 rounded-xl text-sm text-gray-500">
          Loading...
        </div>
      ) : !schedule ? (
        <div className="p-6 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600">
          Select a department to configure its schedule.
        </div>
      ) : (
        <>
          <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">
              Semester {semester} — header &amp; divisions
            </h2>
            <p className="text-xs text-gray-500 -mt-2">
              Choose single class (batches only) or multiple divisions — each
              with its own timetable. Settings apply only to this semester.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Title label"
              value={schedule.titleLabel || ''}
              onChange={(v) => updateScheduleField('titleLabel', v)}
              placeholder="e.g. ACADEMIC SCHEDULE (FIRST HALF – 2026)"
            />
            <Field
              label="Class Advisor"
              value={schedule.classAdvisor || ''}
              onChange={(v) => updateScheduleField('classAdvisor', v)}
              placeholder="e.g. Prof. Utkarsha Pawar"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                W.E.F. (with effect from)
              </label>
              <input
                type="date"
                value={toDateInput(schedule.wef)}
                onChange={(e) => updateScheduleField('wef', e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Working days
              </label>
              <div className="flex flex-wrap gap-2">
                {WORKING_DAY_OPTIONS.map((day) => {
                  const checked = (schedule.workingDays || []).includes(day)
                  return (
                    <label
                      key={day}
                      className={`px-2.5 py-1.5 text-xs font-medium rounded-full border cursor-pointer ${
                        checked
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleWorkingDay(day)}
                        className="hidden"
                      />
                      {day.slice(0, 3)}
                    </label>
                  )
                })}
              </div>
            </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Class structure
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                <label
                  className={`px-3 py-2 text-sm font-medium rounded-lg border cursor-pointer ${
                    isSingleClassMode(schedule)
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="classMode"
                    checked={isSingleClassMode(schedule)}
                    onChange={() => setClassMode(CLASS_MODE_SINGLE)}
                    className="hidden"
                  />
                  Single class (batches only)
                </label>
                <label
                  className={`px-3 py-2 text-sm font-medium rounded-lg border cursor-pointer ${
                    !isSingleClassMode(schedule)
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="classMode"
                    checked={!isSingleClassMode(schedule)}
                    onChange={() => setClassMode(CLASS_MODE_MULTI)}
                    className="hidden"
                  />
                  Multiple divisions
                </label>
              </div>

              {isSingleClassMode(schedule) ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Lab / tutorial batches
                  </label>
                  <input
                    type="text"
                    value={(schedule.divisions?.[0]?.batches || []).join(', ')}
                    onChange={(e) => updateSingleClassBatches(e.target.value)}
                    placeholder="A, B, C, D"
                    className={inputClass}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    One shared timetable for the whole class; use batches for
                    parallel labs and tutorials.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-sm text-gray-600">
                      Each division has its own timetable and batch list.
                    </span>
                    <button
                      type="button"
                      onClick={addDivision}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add division
                    </button>
                  </div>
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">
                            Division name
                          </th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">
                            Label (optional)
                          </th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">
                            Batches (comma separated)
                          </th>
                          <th className="w-10" />
                        </tr>
                      </thead>
                      <tbody>
                        {(schedule.divisions || []).map((div, idx) => (
                          <tr key={idx} className="border-b border-gray-100">
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={div.code || ''}
                                onChange={(e) =>
                                  updateDivision(idx, { code: e.target.value })
                                }
                                placeholder="Division A"
                                className={inputClass}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={div.label || ''}
                                onChange={(e) =>
                                  updateDivision(idx, { label: e.target.value })
                                }
                                placeholder="Section A"
                                className={inputClass}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={(div.batches || []).join(', ')}
                                onChange={(e) =>
                                  updateDivisionBatches(idx, e.target.value)
                                }
                                placeholder="A, B, C"
                                className={inputClass}
                              />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => removeDivision(idx)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                title="Remove division"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white">
            <header className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Time columns — Semester {semester}
                </h2>
                <p className="text-xs text-gray-500">
                  {totalClassColumns} teaching period
                  {totalClassColumns === 1 ? '' : 's'} ·{' '}
                  {(schedule.columns || []).length - totalClassColumns} break
                  column(s)
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => addColumn('class')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100"
                >
                  <Plus className="w-3.5 h-3.5" /> Period
                </button>
                <button
                  type="button"
                  onClick={() => addColumn('short_break')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100"
                >
                  <Plus className="w-3.5 h-3.5" /> Short Break
                </button>
                <button
                  type="button"
                  onClick={() => addColumn('lunch_break')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100"
                >
                  <Plus className="w-3.5 h-3.5" /> Lunch Break
                </button>
              </div>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 w-12">
                      #
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">
                      Kind
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">
                      Start
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">
                      End
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">
                      Label
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-600 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {(schedule.columns || []).map((col, idx) => (
                    <tr
                      key={`${col.index}-${idx}`}
                      className="border-b border-gray-100"
                    >
                      <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                      <td className="px-3 py-2">
                        <select
                          value={col.kind}
                          onChange={(e) =>
                            updateColumn(idx, { kind: e.target.value })
                          }
                          className={`${selectClass} min-w-[140px] py-1.5`}
                        >
                          {COLUMN_KINDS.map((k) => (
                            <option key={k.value} value={k.value}>
                              {k.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="time"
                          value={col.startTime}
                          onChange={(e) =>
                            updateColumn(idx, { startTime: e.target.value })
                          }
                          className={`${inputClass} max-w-[120px]`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="time"
                          value={col.endTime}
                          onChange={(e) =>
                            updateColumn(idx, { endTime: e.target.value })
                          }
                          className={`${inputClass} max-w-[120px]`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={col.label || ''}
                          onChange={(e) =>
                            updateColumn(idx, { label: e.target.value })
                          }
                          placeholder={
                            col.kind === 'class' ? '(optional)' : 'BREAK'
                          }
                          className={inputClass}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeColumn(idx)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Remove column"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

const Field = ({ label, value, onChange, placeholder, type = 'text' }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1.5">
      {label}
    </label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={inputClass}
    />
  </div>
)

export default SemesterSchedule
