import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const roleBadgeStyles = {
  admin: 'bg-purple-100 text-purple-800',
  hod: 'bg-blue-100 text-blue-800',
}

const Navbar = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  if (!user) return null

  return (
    <header className="no-print sticky top-0 z-20 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
        <p className="text-xs text-gray-500 truncate">{user.email}</p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-medium uppercase ${
            roleBadgeStyles[user.role] || 'bg-gray-100 text-gray-800'
          }`}
        >
          {user.role}
        </span>
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </header>
  )
}

export default Navbar
