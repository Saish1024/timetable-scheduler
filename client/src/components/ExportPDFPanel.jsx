import { useEffect, useMemo, useState } from 'react'
import { X, Printer } from 'lucide-react'
import toast from 'react-hot-toast'
import { selectClass } from '../styles/formControls'
import { downloadTimetablePDF, PDF_VIEW } from '../utils/exportPDF'
import { formatBatchLabel, formatDivisionTabLabel } from '../utils/departmentConfig'
import {
  getBatchesForDivision,
  getDivisions,
  isSingleClassMode,
  prepareScheduleFromApi,
} from '../utils/scheduleHelpers'
import api from '../api/axios'

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8]

const ExportPDFPanel = ({
  open,
  onClose,
  departmentId,
  department = null,
  academicYear = '2025-26',
  defaultSemester = 1,
  defaultDivision = '',
  generator,
}) => {
  const [semester, setSemester] = useState(defaultSemester)
  const [division, setDivision] = useState(defaultDivision || '')
  const [view, setView] = useState(PDF_VIEW.FULL)
  const [batch, setBatch] = useState('A')
  const [schedule, setSchedule] = useState(null)
  const [loadingSchedule, setLoadingSchedule] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (!open) return
    setSemester(defaultSemester)
    setDivision(defaultDivision || '')
    setView(PDF_VIEW.FULL)
    setBatch('A')
  }, [open, defaultSemester, defaultDivision])

  useEffect(() => {
    if (!open || !departmentId) {
      setSchedule(null)
      return
    }
    setLoadingSchedule(true)
    api
      .get(`/api/schedule/${departmentId}/${semester}`, {
        params: { academicYear },
      })
      .then((res) => {
        const dept = department || res.data.departmentConfig
        setSchedule(prepareScheduleFromApi(res.data.schedule, dept))
      })
      .catch(() => setSchedule(null))
      .finally(() => setLoadingSchedule(false))
  }, [open, departmentId, department, semester, academicYear])

  const divisions = useMemo(
    () => getDivisions(schedule, department),
    [schedule, department]
  )
  const singleClass = isSingleClassMode(schedule)

  const activeDivisionCode =
    division && division !== 'all'
      ? division
      : defaultDivision || divisions[0]?.code || ''

  const batches = useMemo(
    () => getBatchesForDivision(schedule, activeDivisionCode, department),
    [schedule, activeDivisionCode, department]
  )

  useEffect(() => {
    if (batches.length && !batches.includes(batch)) {
      setBatch(batches[0])
    }
  }, [batches, batch])

  const handleExport = async () => {
    if (!departmentId) return
    const exportDivision =
      division === 'all'
        ? 'all'
        : division || divisions[0]?.code

    if (!exportDivision) {
      toast.error('Select a division')
      return
    }

    setExporting(true)
    try {
      await downloadTimetablePDF(departmentId, semester, {
        academicYear,
        division: exportDivision,
        view,
        batch: view === PDF_VIEW.BATCH ? batch : undefined,
        generator,
      })
      onClose?.()
    } catch (err) {
      toast.error(err.message || 'Failed to export PDF')
    } finally {
      setExporting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md"
        role="dialog"
        aria-labelledby="export-pdf-title"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 id="export-pdf-title" className="text-lg font-semibold text-gray-900">
            Export PDF
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Semester
            </label>
            <select
              value={semester}
              onChange={(e) => setSemester(Number(e.target.value))}
              className={`${selectClass} w-full`}
            >
              {SEMESTERS.map((s) => (
                <option key={s} value={s}>
                  Semester {s}
                </option>
              ))}
            </select>
          </div>

          {!singleClass && divisions.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Division
              </label>
              <select
                value={division || divisions[0]?.code || ''}
                onChange={(e) => setDivision(e.target.value)}
                disabled={loadingSchedule}
                className={`${selectClass} w-full`}
              >
                {divisions.map((div) => (
                  <option key={div.code} value={div.code}>
                    {formatDivisionTabLabel(div, department)}
                  </option>
                ))}
                {divisions.length > 1 && (
                  <option value="all">All divisions</option>
                )}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              View
            </label>
            <select
              value={view}
              onChange={(e) => setView(e.target.value)}
              className={`${selectClass} w-full`}
            >
              <option value={PDF_VIEW.FULL}>Full Timetable</option>
              <option value={PDF_VIEW.LECTURE}>Lectures Only</option>
              <option value={PDF_VIEW.PRACTICAL}>Practicals Only</option>
              <option value={PDF_VIEW.BATCH}>Specific Batch</option>
            </select>
          </div>

          {view === PDF_VIEW.BATCH && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Batch
              </label>
              <select
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
                className={`${selectClass} w-full`}
              >
                {batches.map((b) => (
                  <option key={b} value={b}>
                    {formatBatchLabel(b, department)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <p className="text-xs text-gray-500">
            Opens the print dialog — choose &quot;Save as PDF&quot; and A4
            landscape. Multiple divisions export as separate pages.
          </p>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || loadingSchedule}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-60"
          >
            <Printer className="w-4 h-4" />
            {exporting ? 'Preparing...' : 'Print / Save PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ExportPDFPanel
