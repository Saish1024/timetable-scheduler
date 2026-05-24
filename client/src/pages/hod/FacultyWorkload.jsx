import { useCallback, useEffect, useState } from 'react'
import api from '../../api/axios'
import { useHodDepartment, NoDepartmentMessage } from '../../hooks/useHodDepartment'
import { selectClass } from '../../styles/formControls'

const ACADEMIC_YEAR = '2025-26'
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8]

const FacultyWorkload = () => {
  const { departmentId } = useHodDepartment()
  const [activeSemester, setActiveSemester] = useState(1)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!departmentId) return
    setLoading(true)
    try {
      const [facultyRes, slotsRes] = await Promise.all([
        api.get('/api/faculty', { params: { department: departmentId } }),
        api.get(`/api/timetable/${departmentId}/${activeSemester}`, {
          params: { academicYear: ACADEMIC_YEAR },
        }),
      ])

      const faculty = facultyRes.data.faculty || []
      const slots = slotsRes.data.slots || []

      const subjectsByFaculty = {}
      const periodsByFaculty = {}
      for (const slot of slots) {
        const fid = String(slot.faculty?._id || slot.faculty || '')
        if (!fid) continue
        periodsByFaculty[fid] = (periodsByFaculty[fid] || 0) + 1
        if (!subjectsByFaculty[fid]) subjectsByFaculty[fid] = new Set()
        const label = slot.subject?.code || slot.subject?.name
        if (label) subjectsByFaculty[fid].add(label)
      }

      const workloadRows = faculty.map((f) => {
        const fid = String(f._id)
        const max = f.maxPeriodsPerWeek || 30
        const total = periodsByFaculty[fid] ?? 0
        const pct = max > 0 ? Math.min(100, Math.round((total / max) * 100)) : 0
        return {
          _id: f._id,
          name: f.name,
          subjects: [...(subjectsByFaculty[fid] || [])].sort().join(', ') || '—',
          totalPeriods: total,
          maxPeriods: max,
          utilization: pct,
          overloaded: total > max,
        }
      })

      setRows(workloadRows)
    } catch {
      /* error toast via axios interceptor */
    } finally {
      setLoading(false)
    }
  }, [departmentId, activeSemester])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (!departmentId) return <NoDepartmentMessage />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Faculty Workload</h1>
          <p className="text-gray-600 text-sm mt-1">
            Weekly period assignments for your department faculty.
          </p>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-600">Semester</span>
          <select
            className={selectClass}
            value={activeSemester}
            onChange={(e) => setActiveSemester(Number(e.target.value))}
          >
            {SEMESTERS.map((sem) => (
              <option key={sem} value={sem}>
                Semester {sem}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Name</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Subjects</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Periods / week</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 min-w-[200px]">Utilization</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  No faculty in this department.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row._id}
                  className={`border-b border-gray-100 ${
                    row.overloaded ? 'bg-red-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs">{row.subjects}</td>
                  <td
                    className={`px-4 py-3 font-medium ${
                      row.overloaded ? 'text-red-700' : 'text-gray-900'
                    }`}
                  >
                    {row.totalPeriods} / {row.maxPeriods}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            row.overloaded
                              ? 'bg-red-500'
                              : row.utilization >= 80
                                ? 'bg-yellow-500'
                                : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(row.utilization, 100)}%` }}
                        />
                      </div>
                      <span
                        className={`text-xs font-medium w-10 text-right ${
                          row.overloaded ? 'text-red-700' : 'text-gray-600'
                        }`}
                      >
                        {row.utilization}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default FacultyWorkload
