import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NotFound = () => {
  const { user } = useAuth()

  const homeTo = !user
    ? '/login'
    : user.role === 'admin'
      ? '/admin'
      : '/hod'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <h1 className="text-6xl font-bold text-indigo-600">404</h1>
      <p className="text-xl text-gray-700 mt-2">Page not found</p>
      <p className="text-gray-500 mt-1 mb-6">
        The page you are looking for does not exist.
      </p>
      <Link
        to={homeTo}
        className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition"
      >
        Go home
      </Link>
    </div>
  )
}

export default NotFound
