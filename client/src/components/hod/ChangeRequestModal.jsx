import { useState } from 'react'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../api/axios'

const ChangeRequestModal = ({ open, slot, onClose, onSubmitted }) => {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!open || !slot) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!reason.trim()) {
      toast.error('Please provide a reason for the change request')
      return
    }

    setSubmitting(true)
    try {
      await api.post('/api/changerequest', {
        slot: slot._id,
        reason: reason.trim(),
      })
      setReason('')
      onSubmitted?.()
      onClose()
    } catch {
      /* error toast via axios interceptor */
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Request Change</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 bg-gray-50 rounded-lg text-sm space-y-1">
            <p>
              <span className="font-medium text-gray-700">Day:</span> {slot.day}
            </p>
            <p>
              <span className="font-medium text-gray-700">Period:</span>{' '}
              {slot.period}
            </p>
            <p>
              <span className="font-medium text-gray-700">Subject:</span>{' '}
              {slot.subject?.code || slot.subject?.name || '—'}
            </p>
            <p>
              <span className="font-medium text-gray-700">Faculty:</span>{' '}
              {slot.faculty?.name || '—'}
            </p>
            <p>
              <span className="font-medium text-gray-700">Room:</span>{' '}
              {slot.room?.name || '—'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Reason for change
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              required
              placeholder="Describe the change you are requesting..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-60"
            >
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ChangeRequestModal
