import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { CalendarDays, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { wakeServer } from '../api/axios'

const inputClass =
  'w-full px-4 py-3 text-sm text-gray-900 bg-white border border-gray-200 rounded-xl shadow-sm placeholder:text-gray-400 transition-[border-color,box-shadow] focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15'

const Login = () => {
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [serverStatus, setServerStatus] = useState('checking')

  useEffect(() => {
    let cancelled = false
    wakeServer()
      .then(() => {
        if (!cancelled) setServerStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setServerStatus('slow')
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    )
  }

  if (user) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/hod'} replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    setSubmitting(true)
    try {
      const loggedInUser = await login(email.trim().toLowerCase(), password, {
        skipSuccessToast: true,
        skipErrorToast: true,
      })
      toast.success(`Welcome back, ${loggedInUser.name}`)
      navigate(loggedInUser.role === 'admin' ? '/admin' : '/hod')
    } catch (err) {
      if (!err.response) {
        setFormError(
          import.meta.env.PROD
            ? 'The server is still starting (first visit can take up to a minute). Please wait, then try again.'
            : 'Cannot reach the server. Start the API with npm run dev in the server folder, then run npm run seed.'
        )
      } else {
        setFormError(
          err.response?.data?.message || 'Login failed. Please try again.'
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Brand panel — hidden on small screens */}
      <div className="hidden lg:flex lg:w-1/2 bg-indigo-600 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800" />
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-white/15 backdrop-blur">
              <CalendarDays className="w-7 h-7" />
            </div>
            <span className="text-xl font-semibold tracking-tight">
              Timetable Scheduler
            </span>
          </div>
          <h2 className="text-3xl font-bold leading-tight max-w-md">
            College timetable management, simplified.
          </h2>
          <p className="mt-4 text-indigo-100 text-lg max-w-md leading-relaxed">
            Plan schedules, track faculty workload, and handle change requests —
            all in one place for admins and HODs.
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 bg-slate-50">
        <div className="w-full max-w-[400px]">
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 text-white mb-4 shadow-lg shadow-indigo-600/25">
              <CalendarDays className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Timetable Scheduler
            </h1>
          </div>

          <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/60 border border-gray-100 p-8">
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900">Sign in</h2>
              <p className="text-sm text-gray-500 mt-1">
                Enter your credentials to access your dashboard
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {serverStatus === 'checking' && !formError && (
                <div className="flex gap-2 p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-sm text-indigo-800">
                  <Loader2 className="w-5 h-5 shrink-0 animate-spin text-indigo-600" />
                  <span>Connecting to server… first load may take a moment.</span>
                </div>
              )}

              {formError && (
                <div
                  role="alert"
                  className="flex gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800"
                >
                  <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setFormError('')
                  }}
                  className={inputClass}
                  placeholder="name@college.edu"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setFormError('')
                    }}
                    className={`${inputClass} pr-11`}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-md transition"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || serverStatus === 'checking'}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 text-white text-sm font-semibold rounded-xl shadow-md shadow-indigo-600/20 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-60 disabled:cursor-not-allowed transition"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Signing in...
                  </>
                ) : serverStatus === 'checking' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Connecting to server...
                  </>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                Demo accounts
              </p>
              <div className="space-y-2 text-xs text-gray-600">
                <div className="flex justify-between gap-4 rounded-lg bg-gray-50 px-3 py-2">
                  <span className="font-medium text-gray-700">Admin</span>
                  <span className="text-gray-500 truncate">admin@college.com</span>
                </div>
                <div className="flex justify-between gap-4 rounded-lg bg-gray-50 px-3 py-2">
                  <span className="font-medium text-gray-700">HOD (CS)</span>
                  <span className="text-gray-500 truncate">hod.cs@college.com</span>
                </div>
                <p className="text-gray-400 pt-1">
                  Password: <span className="font-mono text-gray-500">Admin@123</span> /{' '}
                  <span className="font-mono text-gray-500">Hod@123</span>
                </p>
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            College Timetable Management System
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
