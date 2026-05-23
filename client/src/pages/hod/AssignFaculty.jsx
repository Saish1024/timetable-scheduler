import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import { useHodDepartment, NoDepartmentMessage } from '../../hooks/useHodDepartment'
import { selectClass } from '../../styles/formControls'

const ACADEMIC_YEAR = '2025-26'
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8]

const AssignFaculty = () => {
  const { departmentId, departmentCode, departmentName } = useHodDepartment()
  const [activeSemester, setActiveSemester] = useState(1)
  const [subjects, setSubjects] = useState([])
  const [assignments, setAssignments] = useState([])
  const [facultyList, setFacultyList] = useState([])
  const [selections, setSelections] = useState({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)

  const assignmentBySubject = useMemo(() => {
    const map = {}
    for (const a of assignments) {
      const sid = a.subject?._id || a.subject
      if (sid) map[sid] = a
    }
    return map
  }, [assignments])

  const assignedCount = useMemo(
    () => subjects.filter((s) => assignmentBySubject[s._id]).length,
    [subjects, assignmentBySubject]
  )

  const fetchData = useCallback(async () => {
    if (!departmentId) return
    setLoading(true)
    try {
      const [subjectsRes, assignmentsRes, facultyRes] = await Promise.all([
        api.get(`/api/subjects/${departmentId}/${activeSemester}`),
        api.get(`/api/assignments/${departmentId}/${activeSemester}`, {
          params: { academicYear: ACADEMIC_YEAR },
        }),
        api.get('/api/faculty', { params: { department: departmentId } }),
      ])

      const subjectList = subjectsRes.data.subjects || []
      const assignmentList = assignmentsRes.data.assignments || []
      const faculty = facultyRes.data.faculty || []

      const initialSelections = {}
      for (const s of subjectList) {
        const a = assignmentList.find(
          (x) => (x.subject?._id || x.subject) === s._id
        )
        initialSelections[s._id] =
          a?.faculty?._id || a?.faculty || ''
      }

      setSubjects(subjectList)
      setAssignments(assignmentList)
      setFacultyList(faculty)
      setSelections(initialSelections)
    } catch {
      setSubjects([])
      setAssignments([])
      setFacultyList([])
      setSelections({})
    } finally {
      setLoading(false)
    }
  }, [departmentId, activeSemester])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSave = async (subject) => {
    const facultyId = selections[subject._id]
    if (!facultyId) {
      toast.error('Please select a faculty member')
      return
    }

    const existing = assignmentBySubject[subject._id]
    setSavingId(subject._id)

    try {
      if (existing) {
        const currentFaculty =
          existing.faculty?._id || existing.faculty || ''
        if (currentFaculty === facultyId) {
          toast.success('No changes to save')
          return
        }
        await api.put(`/api/assignments/${existing._id}`, { facultyId })
      } else {
        await api.post('/api/assignments', {
          facultyId,
          subjectId: subject._id,
          semester: activeSemester,
          academicYear: ACADEMIC_YEAR,
        })
      }
      await fetchData()
    } catch {
      /* error toast via axios interceptor */
    } finally {
      setSavingId(null)
    }
  }

  const isDirty = (subjectId) => {
    const existing = assignmentBySubject[subjectId]
    const selected = selections[subjectId] || ''
    const saved = existing?.faculty?._id || existing?.faculty || ''
    return selected !== saved
  }

  if (!departmentId) return <NoDepartmentMessage />

  const deptLabel =
    departmentCode && departmentName
      ? `${departmentCode} — ${departmentName}`
      : 'your department'

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Assign Faculty</h1>
        <p className="text-gray-600 text-sm mt-1">
          Assign department faculty to subjects for {deptLabel}.
        </p>
      </div>

      <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-5 py-4 text-sm text-indigo-900">
        <p className="font-medium">
          {assignedCount} of {subjects.length} subjects have faculty assigned for
          Semester {activeSemester}
        </p>
        <p className="text-indigo-700 mt-0.5">Academic year {ACADEMIC_YEAR}</p>
      </div>

      <div className="border-b border-gray-200">
        <div
          className="flex gap-1 overflow-x-auto pb-px"
          role="tablist"
          aria-label="Semester tabs"
        >
          {SEMESTERS.map((sem) => {
            const isActive = activeSemester === sem
            return (
              <button
                key={sem}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveSemester(sem)}
                className={`shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
                  isActive
                    ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Sem {sem}
              </button>
            )
          })}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 w-8" />
              <th className="px-4 py-3 text-left font-semibold text-gray-600">
                Subject Name
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">
                Code
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">
                Weekly Periods
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 min-w-[220px]">
                Assigned Faculty
              </th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : subjects.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No subjects for Semester {activeSemester}. Ask admin to add
                  subjects first.
                </td>
              </tr>
            ) : (
              subjects.map((subject) => {
                const assigned = Boolean(assignmentBySubject[subject._id])
                const dirty = isDirty(subject._id)
                const isSaving = savingId === subject._id

                return (
                  <tr
                    key={subject._id}
                    className={`border-b border-gray-100 ${
                      !assigned ? 'bg-amber-50/40' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-4 py-3">
                      {!assigned && (
                        <span title="No faculty assigned yet">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                        </span>
                      )}
                      {assigned && !dirty && (
                        <span title="Faculty assigned">
                          <Check className="w-4 h-4 text-green-600" />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {subject.name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{subject.code}</td>
                    <td className="px-4 py-3 text-gray-900">
                      {subject.weeklyCount}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={selections[subject._id] || ''}
                        onChange={(e) =>
                          setSelections((prev) => ({
                            ...prev,
                            [subject._id]: e.target.value,
                          }))
                        }
                        disabled={isSaving || facultyList.length === 0}
                        className={`${selectClass} w-full min-w-0 py-2`}
                      >
                        <option value="">Select faculty...</option>
                        {facultyList.map((f) => (
                          <option key={f._id} value={f._id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleSave(subject)}
                        disabled={
                          isSaving ||
                          !selections[subject._id] ||
                          (!dirty && assigned)
                        }
                        className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSaving ? 'Saving...' : 'Save'}
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {facultyList.length === 0 && !loading && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          No faculty found in your department. Ask admin to add faculty first.
        </p>
      )}
    </div>
  )
}

export default AssignFaculty
