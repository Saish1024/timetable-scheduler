import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import api from '../../api/axios'
import FormModal from '../../components/admin/FormModal'
import { selectClass } from '../../styles/formControls'

const ROOM_TYPES = ['lecture', 'lab', 'seminar']

const ManageRooms = () => {
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', capacity: 60, type: 'lecture' })

  const fetchRooms = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/api/rooms')
      setRooms(data.rooms || [])
    } catch {
      /* error toast via axios interceptor */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRooms()
  }, [fetchRooms])

  const openAdd = () => {
    setEditing(null)
    setForm({ name: '', capacity: 60, type: 'lecture' })
    setModalOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setForm({ name: row.name, capacity: row.capacity, type: row.type })
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form, capacity: Number(form.capacity) }
      if (editing) {
        await api.put(`/api/rooms/${editing._id}`, payload)
      } else {
        await api.post('/api/rooms', payload)
      }
      setModalOpen(false)
      fetchRooms()
    } catch {
      /* error toast via axios interceptor */
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete room ${row.name}?`)) return
    try {
      await api.delete(`/api/rooms/${row._id}`)
      fetchRooms()
    } catch {
      /* error toast via axios interceptor */
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Rooms</h1>
          <p className="text-gray-600 text-sm mt-1">Lecture halls, labs, and seminar rooms.</p>
        </div>
        <button type="button" onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
          <Plus className="w-4 h-4" />
          Add Room
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Name</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Type</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Capacity</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : rooms.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No rooms found.</td></tr>
            ) : (
              rooms.map((row) => (
                <tr key={row._id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{row.type}</td>
                  <td className="px-4 py-3 text-gray-900">{row.capacity}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => openEdit(row)} className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => handleDelete(row)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded">
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

      <FormModal open={modalOpen} title={editing ? 'Edit Room' : 'Add Room'} onClose={() => setModalOpen(false)} onSubmit={handleSubmit} loading={saving}>
        <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={`${selectClass} w-full min-w-0`}>
            {ROOM_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
          </select>
        </div>
        <Field label="Capacity" type="number" value={form.capacity} onChange={(v) => setForm({ ...form, capacity: v })} required />
      </FormModal>
    </div>
  )
}

const Field = ({ label, value, onChange, type = 'text', required }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
  </div>
)

export default ManageRooms
