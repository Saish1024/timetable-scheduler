import { Fragment, useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import FormModal from '../../components/admin/FormModal'
import TagInput from '../../components/admin/TagInput'
import { selectClass } from '../../styles/formControls'
import {
  DEFAULT_BATCHES,
  DEFAULT_DIVISIONS,
  normalizeBatchesList,
  normalizeDivisionsList,
} from '../../utils/departmentConfig'

const ManageDepartments = () => {
  const [departments, setDepartments] = useState([])
  const [hodUsers, setHodUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [settingsDraft, setSettingsDraft] = useState({})
  const [settingsSaving, setSettingsSaving] = useState(null)
  const [form, setForm] = useState({ name: '', code: '', hod: '', totalSemesters: 8 })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [deptRes, usersRes] = await Promise.all([
        api.get('/api/departments'),
        api.get('/api/users', { params: { role: 'hod' } }),
      ])
      setDepartments(deptRes.data.departments || [])
      setHodUsers(usersRes.data.users || [])
    } catch {
      /* error toast via axios interceptor */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const openAdd = () => {
    setEditing(null)
    setForm({ name: '', code: '', hod: '', totalSemesters: 8 })
    setModalOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setForm({
      name: row.name,
      code: row.code,
      hod: row.hod?._id || row.hod || '',
      totalSemesters: row.totalSemesters ?? 8,
    })
    setModalOpen(true)
  }

  const toggleSettings = (row) => {
    if (expandedId === row._id) {
      setExpandedId(null)
      return
    }
    setExpandedId(row._id)
    setSettingsDraft({
      divisions: normalizeDivisionsList(row.divisions),
      batches: normalizeBatchesList(row.batches),
    })
  }

  const saveSettings = async (deptId) => {
    setSettingsSaving(deptId)
    try {
      await api.put(`/api/departments/${deptId}`, {
        divisions: settingsDraft.divisions,
        batches: settingsDraft.batches,
      })
      toast.success('Division and batch settings saved')
      setExpandedId(null)
      fetchData()
    } catch {
      /* error toast via axios interceptor */
    } finally {
      setSettingsSaving(null)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...form,
        hod: form.hod || null,
        totalSemesters: Number(form.totalSemesters) || 8,
        divisions: [...DEFAULT_DIVISIONS],
        batches: [...DEFAULT_BATCHES],
      }
      if (editing) {
        await api.put(`/api/departments/${editing._id}`, payload)
      } else {
        await api.post('/api/departments', payload)
      }
      setModalOpen(false)
      fetchData()
    } catch {
      /* error toast via axios interceptor */
    } finally {
      setSaving(false)
    }
  }

  const handleAssignHod = async (deptId, hod) => {
    try {
      await api.put(`/api/departments/${deptId}`, { hod: hod || null })
      fetchData()
    } catch {
      /* error toast via axios interceptor */
    }
  }

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete department ${row.code}?`)) return
    try {
      await api.delete(`/api/departments/${row._id}`)
      if (expandedId === row._id) setExpandedId(null)
      fetchData()
    } catch {
      /* error toast via axios interceptor */
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Departments</h1>
          <p className="text-gray-600 text-sm mt-1">
            Departments, HOD assignments, and default divisions/batches for timetables.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" />
          Add Department
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="w-8 px-2 py-3" />
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Code</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Name</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">HOD</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Divisions</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Batches</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : departments.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No departments found.
                </td>
              </tr>
            ) : (
              departments.map((row) => (
                <Fragment key={row._id}>
                  <tr
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-2 py-3">
                      <button
                        type="button"
                        onClick={() => toggleSettings(row)}
                        className="p-1 text-gray-500 hover:text-indigo-600 rounded"
                        title="Division & batch settings"
                      >
                        {expandedId === row._id ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{row.code}</td>
                    <td className="px-4 py-3 text-gray-600">{row.name}</td>
                    <td className="px-4 py-3">
                      <select
                        value={row.hod?._id || row.hod || ''}
                        onChange={(e) => handleAssignHod(row._id, e.target.value)}
                        className={`${selectClass} min-w-[180px] py-1.5`}
                      >
                        <option value="">No HOD assigned</option>
                        {hodUsers.map((u) => (
                          <option key={u._id} value={u._id}>
                            {u.name} ({u.email})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {(row.divisions || DEFAULT_DIVISIONS).join(', ')}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {(row.batches || DEFAULT_BATCHES).join(', ')}
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
                  {expandedId === row._id && (
                    <tr className="bg-indigo-50/40">
                      <td colSpan={7} className="px-6 py-4">
                        <div className="max-w-xl space-y-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Divisions
                            </label>
                            <TagInput
                              tags={settingsDraft.divisions || []}
                              onChange={(divisions) =>
                                setSettingsDraft((d) => ({ ...d, divisions }))
                              }
                              placeholder="Type name and press Enter (e.g. C)"
                            />
                            <p className="mt-1 text-[11px] text-gray-500">
                              Short names used as Division A, Division B, etc. in timetables.
                            </p>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Batches
                            </label>
                            <TagInput
                              tags={settingsDraft.batches || []}
                              onChange={(batches) =>
                                setSettingsDraft((d) => ({ ...d, batches }))
                              }
                              placeholder="e.g. Batch D"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => saveSettings(row._id)}
                            disabled={settingsSaving === row._id}
                            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-60"
                          >
                            {settingsSaving === row._id ? 'Saving...' : 'Save settings'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      <FormModal
        open={modalOpen}
        title={editing ? 'Edit Department' : 'Add Department'}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        loading={saving}
      >
        <Field
          label="Code"
          value={form.code}
          onChange={(v) => setForm({ ...form, code: v })}
          required
        />
        <Field
          label="Name"
          value={form.name}
          onChange={(v) => setForm({ ...form, name: v })}
          required
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            HOD (optional)
          </label>
          <select
            value={form.hod}
            onChange={(e) => setForm({ ...form, hod: e.target.value })}
            className={`${selectClass} w-full min-w-0`}
          >
            <option value="">No HOD</option>
            {hodUsers.map((u) => (
              <option key={u._id} value={u._id}>
                {u.name} ({u.email})
              </option>
            ))}
          </select>
        </div>
      </FormModal>
    </div>
  )
}

const Field = ({ label, value, onChange, required }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
    />
  </div>
)

export default ManageDepartments
