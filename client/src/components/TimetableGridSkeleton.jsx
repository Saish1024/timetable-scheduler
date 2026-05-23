const DAYS = 6
const PERIODS = 8

const TimetableGridSkeleton = () => (
  <div className="space-y-3 animate-pulse">
    <div className="flex gap-4">
      <div className="h-4 w-20 bg-gray-200 rounded" />
      <div className="h-4 w-16 bg-gray-200 rounded" />
      <div className="h-4 w-16 bg-gray-200 rounded" />
    </div>

    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full min-w-[900px] border-collapse">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-3 py-3 border-b border-r border-gray-200 w-28">
              <div className="h-4 bg-gray-200 rounded w-20" />
            </th>
            {Array.from({ length: PERIODS }).map((_, i) => (
              <th key={i} className="px-3 py-3 border-b border-gray-200">
                <div className="h-4 bg-gray-200 rounded w-14 mx-auto" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: DAYS }).map((_, dayIdx) => (
            <tr key={dayIdx} className="border-b border-gray-200">
              <th className="px-3 py-2 border-r border-gray-200">
                <div className="h-4 bg-gray-200 rounded w-16" />
              </th>
              {Array.from({ length: PERIODS }).map((_, periodIdx) => (
                <td
                  key={periodIdx}
                  className="p-2 border-r border-gray-200 min-w-[120px] h-24"
                >
                  <div className="space-y-2 h-full">
                    <div className="h-3 bg-gray-200 rounded w-3/4" />
                    <div className="h-2.5 bg-gray-100 rounded w-1/2" />
                    <div className="h-2.5 bg-gray-100 rounded w-2/3" />
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
)

export default TimetableGridSkeleton
