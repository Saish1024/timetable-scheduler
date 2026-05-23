import { NavLink } from 'react-router-dom'
import { CalendarDays } from 'lucide-react'
import Navbar from './Navbar'

const DashboardLayout = ({ title, navItems, children }) => {
  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="dashboard-sidebar w-64 bg-white border-r border-gray-200 flex flex-col shrink-0 print:hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-7 h-7 text-indigo-600" />
            <span className="font-semibold text-gray-900">Timetable</span>
          </div>
          <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">
            {title}
          </p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

      </aside>

      <div className="dashboard-main flex-1 flex flex-col min-w-0">
        <Navbar />
        <main className="flex-1 overflow-auto print:overflow-visible">
          <div className="p-8 print:p-4">{children}</div>
        </main>
      </div>
    </div>
  )
}

export default DashboardLayout
