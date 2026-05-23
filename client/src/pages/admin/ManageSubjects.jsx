import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import api from '../../api/axios'
import FormModal from '../../components/admin/FormModal'
import { inputClass, selectClass } from '../../styles/formControls'

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8]

const emptyForm = {
  name: '',
  code: '',
  theoryHours: 3,
  tutorialHours: 0,
  practicalHours: 0,
}

const totalOf = (form) =>
  (Number(form.theoryHours) || 0) +
  (Number(form.tutorialHours) || 0) +
  (Number(form.practicalHours) || 0)

const ManageSubjects = () => {
  const [departments, setDepartments] = useState([])
  const [departmentId, setDepartmentId] = useState('')
  const [semester, setSemester] = useState(1)
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const selectionReady = Boolean(departmentId)

  const selectedDept = useMemo(
    () => departments.find((d) => d._id === departmentId),
    [departments, departmentId]
  )

  const summary = useMemo(() => {
    const count = subjects.length
    const totals = subjects.reduce(
      (acc, s) => {
        acc.theory += Number(s.theoryHours) || 0
        acc.tutorial += Number(s.tutorialHours) || 0
        acc.practical += Number(s.practicalHours) || 0
        return acc
      },
      { theory: 0, tutorial: 0, practical: 0 }
    )
    totals.total = totals.theory + totals.tutorial + totals.practical
    return { count, ...totals }
  }, [subjects])

  const fetchSubjects = useCallback(async () => {
    if (!departmentId) {
      setSubjects([])
      return
    }
    setLoading(true)
    try {
      const { data } = await api.get(
        `/api/subjects/${departmentId}/${semester}`
      )
      setSubjects(data.subjects || [])
    } catch {
      setSubjects([])
    } finally {
      setLoading(false)
    }
  }, [departmentId, semester])

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

  useEffect(() => {
    fetchSubjects()
  }, [fetchSubjects])

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setForm({
      name: row.name,
      code: row.code,
      theoryHours: row.theoryHours ?? 0,
      tutorialHours: row.tutorialHours ?? 0,
      practicalHours: row.practicalHours ?? 0,
    })
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!departmentId) return
    setSaving(true)
    try {
      const body = {
        name: form.name.trim(),
        code: form.code.trim(),
        departmentId,
        semester: Number(semester),
        theoryHours: Number(form.theoryHours) || 0,
        tutorialHours: Number(form.tutorialHours) || 0,
        practicalHours: Number(form.practicalHours) || 0,
      }
      if (editing) {
        await api.put(`/api/subjects/${editing._id}`, body)
      } else {
        await api.post('/api/subjects', body)
      }
      setModalOpen(false)
      setEditing(null)
      fetchSubjects()
    } catch {
      /* error toast via axios interceptor */
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete subject ${row.code} — ${row.name}?`)) return
    try {
      await api.delete(`/api/subjects/${row._id}`)
      fetchSubjects()
    } catch {
      /* error toast via axios interceptor */
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Manage Subjects</h1>
        <p className="text-gray-600 text-sm mt-1">
          Theory, tutorial, and practical hours per subject for each
          department + semester.
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
        <button
          type="button"
          onClick={openAdd}
          disabled={!selectionReady}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
        >
          <Plus className="w-4 h-4" />
          Add Subject
        </button>
      </div>

      {selectionReady && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-5 py-4 text-sm text-indigo-900">
          <p className="font-medium">
            Semester {semester} has {summary.count} subject
            {summary.count === 1 ? '' : 's'} · {summary.theory}T · {summary.tutorial}Tu · {summary.practical}P · {summary.total} total hours/week
          </p>
          {selectedDept && (
            <p className="text-indigo-700 mt-0.5">
              {selectedDept.code} — {selectedDept.name}
            </p>
          )}
        </div>
      )}

      {!selectionReady ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-600">
          Select a department to view and manage subjects.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">
                  Subject Name
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">
                  Code
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">
                  Theory
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">
                  Tutorial
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">
                  Practical
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">
                  Total
                </th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : subjects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No subjects for this semester. Click Add Subject to create one.
                  </td>
                </tr>
              ) : (
                subjects.map((row) => {
                  const total =
                    (Number(row.theoryHours) || 0) +
                    (Number(row.tutorialHours) || 0) +
                    (Number(row.practicalHours) || 0)
                  return (
                    <tr
                      key={row._id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {row.name}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{row.code}</td>
                      <td className="px-4 py-3 text-center text-gray-900">
                        {row.theoryHours ?? 0}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-900">
                        {row.tutorialHours ?? 0}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-900">
                        {row.practicalHours ?? 0}
                      </td>
                      <td className="px-4 py-3 text-center font-medium text-gray-900">
                        {total}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="inline-flex items-center gap-1 px-2 py-1.5 text-sm text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                          >
                            <Pencil className="w-4 h-4" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(row)}
                            className="inline-flex items-center gap-1 px-2 py-1.5 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <FormModal
        open={modalOpen}
        title={editing ? 'Edit Subject' : 'Add Subject'}
        onClose={() => {
          setModalOpen(false)
          setEditing(null)
        }}
        onSubmit={handleSubmit}
        loading={saving}
        submitLabel={editing ? 'Update' : 'Create'}
      >
        <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 text-sm text-gray-600">
          <span className="font-medium text-gray-800">Department:</span>{' '}
          {selectedDept
            ? `${selectedDept.code} — ${selectedDept.name}`
            : '—'}
          <span className="mx-2 text-gray-300">|</span>
          <span className="font-medium text-gray-800">Semester:</span> {semester}
        </div>
        <Field
          label="Subject Name"
          value={form.name}
          onChange={(v) => setForm({ ...form, name: v })}
          required
        />
        <Field
          label="Subject Code"
          value={form.code}
          onChange={(v) => setForm({ ...form, code: v })}
          required
        />
        <div className="grid grid-cols-3 gap-3">
          <Field
            label="Theory"
            type="number"
            min={0}
            max={20}
            value={form.theoryHours}
            onChange={(v) => setForm({ ...form, theoryHours: v })}
          />
          <Field
            label="Tutorial"
            type="number"
            min={0}
            max={20}
            value={form.tutorialHours}
            onChange={(v) => setForm({ ...form, tutorialHours: v })}
          />
          <Field
            label="Practical"
            type="number"
            min={0}
            max={20}
            value={form.practicalHours}
            onChange={(v) => setForm({ ...form, practicalHours: v })}
          />
        </div>
        <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2 text-sm text-indigo-800">
          Total hours per week: <strong>{totalOf(form)}</strong>
        </div>
      </FormModal>
    </div>
  )
}

const Field = ({ label, value, onChange, type = 'text', required, min, max }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      min={min}
      max={max}
      className={inputClass}
    />
  </div>
)

export default ManageSubjects
