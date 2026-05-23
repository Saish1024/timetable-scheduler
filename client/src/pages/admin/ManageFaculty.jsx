import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import api from '../../api/axios'
import FormModal from '../../components/admin/FormModal'
import { selectClass } from '../../styles/formControls'

const ACADEMIC_YEAR = '2025-26'

const ManageFaculty = () => {
  const [faculty, setFaculty] = useState([])
  const [workloads, setWorkloads] = useState({})
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    shortCode: '',
    department: '',
    maxPeriodsPerWeek: 30,
  })

  const fetchFaculty = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/api/faculty')
      const list = data.faculty || []
      setFaculty(list)

      const workloadResults = await Promise.all(
        list.map((f) =>
          api
            .get(`/api/faculty/${f._id}/workload`, {
              params: { academicYear: ACADEMIC_YEAR },
            })
            .then((res) => ({ id: f._id, total: res.data.totalPeriods }))
            .catch(() => ({ id: f._id, total: 0 }))
        )
      )
      setWorkloads(
        workloadResults.reduce((acc, { id, total }) => {
          acc[id] = total
          return acc
        }, {})
      )
    } catch {
      /* error toast via axios interceptor */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFaculty()
    api
      .get('/api/departments')
      .then((res) => setDepartments(res.data.departments || []))
      .catch(() => {})
  }, [fetchFaculty])

  const openAdd = () => {
    setEditing(null)
    setForm({
      name: '',
      email: '',
      shortCode: '',
      department: '',
      maxPeriodsPerWeek: 30,
    })
    setModalOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setForm({
      name: row.name,
      email: row.email,
      shortCode: row.shortCode || '',
      department: row.department?._id || row.department || '',
      maxPeriodsPerWeek: row.maxPeriodsPerWeek ?? 30,
    })
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) {
        await api.put(`/api/faculty/${editing._id}`, form)
      } else {
        await api.post('/api/faculty', form)
      }
      setModalOpen(false)
      fetchFaculty()
    } catch {
      /* error toast via axios interceptor */
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete ${row.name}?`)) return
    try {
      await api.delete(`/api/faculty/${row._id}`)
      fetchFaculty()
    } catch {
      /* error toast via axios interceptor */
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Faculty</h1>
          <p className="text-gray-600 text-sm mt-1">
            Add, edit, and view weekly period assignments.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" />
          Add Faculty
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Name</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Short Code</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Email</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Department</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Periods / week</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : faculty.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No faculty found.
                </td>
              </tr>
            ) : (
              faculty.map((row) => (
                <tr key={row._id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                  <td className="px-4 py-3">
                    {row.shortCode ? (
                      <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-mono font-semibold text-indigo-700">
                        {row.shortCode}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{row.email}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {row.department?.code || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        workloads[row._id] > (row.maxPeriodsPerWeek || 30)
                          ? 'text-red-600 font-medium'
                          : 'text-gray-900'
                      }
                    >
                      {workloads[row._id] ?? '—'} / {row.maxPeriodsPerWeek || 30}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(row)}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <FormModal
        open={modalOpen}
        title={editing ? 'Edit Faculty' : 'Add Faculty'}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        loading={saving}
      >
        <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
        <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
        <Field
          label="Short Code (e.g. RK) — shown inline on timetable"
          value={form.shortCode}
          onChange={(v) => setForm({ ...form, shortCode: v.toUpperCase() })}
          maxLength={6}
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Department</label>
          <select
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
            required
            className={`${selectClass} w-full min-w-0`}
          >
            <option value="">Select department...</option>
            {departments.map((d) => (
              <option key={d._id} value={d._id}>{d.code} — {d.name}</option>
            ))}
          </select>
        </div>
        <Field
          label="Max periods per week"
          type="number"
          value={form.maxPeriodsPerWeek}
          onChange={(v) => setForm({ ...form, maxPeriodsPerWeek: Number(v) })}
          required
        />
      </FormModal>
    </div>
  )
}

const Field = ({ label, value, onChange, type = 'text', required, maxLength }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      maxLength={maxLength}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
    />
  </div>
)

export default ManageFaculty
