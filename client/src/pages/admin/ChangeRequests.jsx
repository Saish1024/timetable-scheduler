import { useCallback, useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import api from '../../api/axios'

const ChangeRequests = () => {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [rejectModal, setRejectModal] = useState({ open: false, request: null })
  const [adminNote, setAdminNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/api/changerequest/admin/pending')
      setRequests(data.requests || [])
    } catch {
      /* error toast via axios interceptor */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const handleApprove = async (request) => {
    if (!window.confirm('Approve this change request?')) return
    try {
      await api.put(`/api/changerequest/${request._id}`, { status: 'approved' })
      fetchRequests()
    } catch {
      /* error toast via axios interceptor */
    }
  }

  const openReject = (request) => {
    setRejectModal({ open: true, request })
    setAdminNote('')
  }

  const closeReject = () => {
    setRejectModal({ open: false, request: null })
    setAdminNote('')
  }

  const handleReject = async (e) => {
    e.preventDefault()
    if (!rejectModal.request) return
    setSubmitting(true)
    try {
      await api.put(`/api/changerequest/${rejectModal.request._id}`, {
        status: 'rejected',
        adminNote,
      })
      closeReject()
      fetchRequests()
    } catch {
      /* error toast via axios interceptor */
    } finally {
      setSubmitting(false)
    }
  }

  const formatSlot = (slot) => {
    if (!slot) return '—'
    return `${slot.day} P${slot.period} · ${slot.subject?.code || slot.subject?.name || '—'} · ${slot.department?.code || '—'}`
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Change Requests</h1>
        <p className="text-gray-600 text-sm mt-1">
          Pending requests across all departments.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Slot</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Department</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Requested by</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Reason</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Date</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : requests.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No pending requests.</td></tr>
            ) : (
              requests.map((row) => (
                <tr key={row._id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">{formatSlot(row.slot)}</td>
                  <td className="px-4 py-3 text-gray-600">{row.slot?.department?.code || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{row.requestedBy?.name || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate" title={row.reason}>{row.reason}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleApprove(row)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => openReject(row)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg"
                      >
                        <X className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {rejectModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <form onSubmit={handleReject}>
              <div className="px-5 py-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Reject request</h3>
                <p className="text-xs text-gray-500 mt-0.5">Add a note for the HOD (optional).</p>
              </div>
              <div className="p-5">
                <textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  rows={3}
                  placeholder="Reason for rejection..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200">
                <button type="button" onClick={closeReject} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-60"
                >
                  {submitting ? 'Rejecting...' : 'Reject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default ChangeRequests
