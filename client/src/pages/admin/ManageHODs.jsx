import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import FormModal from '../../components/admin/FormModal'
import { inputClass, selectClass } from '../../styles/formControls'

const emptyCreateForm = { name: '', email: '', password: '', departmentId: '' }

const ManageHODs = () => {
  const [hods, setHods] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState(emptyCreateForm)
  const [lastCreated, setLastCreated] = useState(null)
  const [copied, setCopied] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', departmentId: '' })
  const [saving, setSaving] = useState(false)

  const fetchHods = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/api/auth/hods')
      setHods(data.hods || [])
    } catch {
      /* error toast via axios interceptor */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHods()
    api
      .get('/api/departments')
      .then((res) => setDepartments(res.data.departments || []))
      .catch(() => {})
  }, [fetchHods])

  const handleCreate = async (e) => {
    e.preventDefault()
    setCreating(true)
    setCopied(false)
    try {
      const { data } = await api.post(
        '/api/auth/create-hod',
        {
          name: createForm.name.trim(),
          email: createForm.email.trim(),
          password: createForm.password,
          departmentId: createForm.departmentId,
        },
        { skipSuccessToast: true }
      )

      const user = data.user
      const deptLabel = user.department
        ? `${user.department.code} — ${user.department.name}`
        : '—'

      const credentials = {
        name: user.name,
        email: user.email,
        password: createForm.password,
        department: deptLabel,
      }

      setLastCreated(credentials)
      toast.success(
        `HOD created: ${user.name} (${user.email}) — ${deptLabel}. Password was set as entered.`,
        { duration: 6000 }
      )

      setCreateForm(emptyCreateForm)
      fetchHods()
    } catch {
      /* error toast via axios interceptor */
    } finally {
      setCreating(false)
    }
  }

  const handleCopyCredentials = async () => {
    if (!lastCreated) return
    const text = `HOD Login Credentials\nName: ${lastCreated.name}\nEmail: ${lastCreated.email}\nPassword: ${lastCreated.password}\nDepartment: ${lastCreated.department}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('Credentials copied to clipboard')
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.error('Could not copy to clipboard')
    }
  }

  const openEdit = (row) => {
    setEditing(row)
    setEditForm({
      name: row.name,
      email: row.email,
      departmentId: row.department?._id || row.department || '',
    })
    setEditOpen(true)
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    if (!editing) return
    setSaving(true)
    try {
      await api.put(`/api/auth/hod/${editing._id}`, {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        departmentId: editForm.departmentId,
      })
      setEditOpen(false)
      setEditing(null)
      fetchHods()
    } catch {
      /* error toast via axios interceptor */
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    const deptLabel = row.department
      ? `${row.department.code} — ${row.department.name}`
      : 'no department'
    if (
      !window.confirm(
        `Delete HOD account for ${row.name} (${row.email})?\nThey will be removed from ${deptLabel}.`
      )
    ) {
      return
    }
    try {
      await api.delete(`/api/auth/hod/${row._id}`)
      if (lastCreated?.email === row.email) setLastCreated(null)
      fetchHods()
    } catch {
      /* error toast via axios interceptor */
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Manage HODs</h1>
        <p className="text-gray-600 text-sm mt-1">
          Create Head of Department accounts and assign them to departments.
        </p>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Create HOD account</h2>
        <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Name"
            value={createForm.name}
            onChange={(v) => setCreateForm({ ...createForm, name: v })}
            required
          />
          <Field
            label="Email"
            type="email"
            value={createForm.email}
            onChange={(v) => setCreateForm({ ...createForm, email: v })}
            required
          />
          <Field
            label="Password"
            type="password"
            value={createForm.password}
            onChange={(v) => setCreateForm({ ...createForm, password: v })}
            required
            minLength={6}
            autoComplete="new-password"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Department
            </label>
            <select
              value={createForm.departmentId}
              onChange={(e) =>
                setCreateForm({ ...createForm, departmentId: e.target.value })
              }
              required
              className={`${selectClass} w-full min-w-0`}
            >
              <option value="">Select department...</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2 flex flex-wrap items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-60"
            >
              {creating ? 'Creating...' : 'Create HOD'}
            </button>
            {lastCreated && (
              <button
                type="button"
                onClick={handleCopyCredentials}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100"
              >
                {copied ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {copied ? 'Copied!' : 'Copy Credentials'}
              </button>
            )}
          </div>
        </form>
        {lastCreated && (
          <p className="mt-4 text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-4 py-3">
            Last created: <span className="font-medium text-gray-900">{lastCreated.email}</span>
            {' · '}
            Password: <span className="font-mono text-gray-800">{lastCreated.password}</span>
            {' · '}
            {lastCreated.department}
          </p>
        )}
      </section>

      <section className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Name</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Email</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Department</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : hods.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  No HOD accounts yet. Create one above.
                </td>
              </tr>
            ) : (
              hods.map((row) => (
                <tr
                  key={row._id}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                  <td className="px-4 py-3 text-gray-600">{row.email}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {row.department
                      ? `${row.department.code} — ${row.department.name}`
                      : '—'}
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
              ))
            )}
          </tbody>
        </table>
      </section>

      <FormModal
        open={editOpen}
        title="Edit HOD"
        onClose={() => {
          setEditOpen(false)
          setEditing(null)
        }}
        onSubmit={handleEditSubmit}
        loading={saving}
        submitLabel="Update"
      >
        <Field
          label="Name"
          value={editForm.name}
          onChange={(v) => setEditForm({ ...editForm, name: v })}
          required
        />
        <Field
          label="Email"
          type="email"
          value={editForm.email}
          onChange={(v) => setEditForm({ ...editForm, email: v })}
          required
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Department
          </label>
          <select
            value={editForm.departmentId}
            onChange={(e) =>
              setEditForm({ ...editForm, departmentId: e.target.value })
            }
            required
            className={`${selectClass} w-full min-w-0`}
          >
            <option value="">Select department...</option>
            {departments.map((d) => (
              <option key={d._id} value={d._id}>
                {d.code} — {d.name}
              </option>
            ))}
          </select>
        </div>
      </FormModal>
    </div>
  )
}

const Field = ({
  label,
  value,
  onChange,
  type = 'text',
  required,
  minLength,
  autoComplete,
}) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      minLength={minLength}
      autoComplete={autoComplete}
      className={inputClass}
    />
  </div>
)

export default ManageHODs
