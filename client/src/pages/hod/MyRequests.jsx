import { useCallback, useEffect, useState } from 'react'
import api from '../../api/axios'
import { useHodDepartment, NoDepartmentMessage } from '../../hooks/useHodDepartment'

const statusStyles = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

const MyRequests = () => {
  const { departmentId, user } = useHodDepartment()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchRequests = useCallback(async () => {
    if (!departmentId) return
    setLoading(true)
    try {
      const { data } = await api.get(`/api/changerequest/${departmentId}`)
      const mine = (data.requests || []).filter(
        (r) =>
          (r.requestedBy?._id || r.requestedBy)?.toString() ===
          user?._id?.toString()
      )
      setRequests(mine)
    } catch {
      /* error toast via axios interceptor */
    } finally {
      setLoading(false)
    }
  }, [departmentId, user?._id])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const formatSlot = (slot) => {
    if (!slot) return '—'
    return `${slot.day} P${slot.period} · ${slot.subject?.code || slot.subject?.name || '—'} · ${slot.faculty?.name || '—'} · ${slot.room?.name || '—'}`
  }

  if (!departmentId) return <NoDepartmentMessage />

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Requests</h1>
        <p className="text-gray-600 text-sm mt-1">
          Track change requests you have submitted.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Slot</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Reason</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Admin note</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No change requests submitted yet.
                </td>
              </tr>
            ) : (
              requests.map((row) => (
                <tr key={row._id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">{formatSlot(row.slot)}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs">{row.reason}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                        statusStyles[row.status] || 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {row.status === 'rejected' && row.adminNote ? (
                      <span className="text-red-700">{row.adminNote}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {row.createdAt
                      ? new Date(row.createdAt).toLocaleDateString()
                      : '—'}
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

export default MyRequests
