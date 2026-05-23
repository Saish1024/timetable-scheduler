import axios from 'axios'
import toast from 'react-hot-toast'

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL !== undefined &&
    import.meta.env.VITE_API_URL !== ''
      ? import.meta.env.VITE_API_URL
      : import.meta.env.DEV
        ? ''
        : 'http://localhost:5000',
  withCredentials: true,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

let refreshPromise = null

const redirectToLogin = () => {
  localStorage.removeItem('token')
  if (window.location.pathname !== '/login') {
    window.location.assign('/login')
  }
}

const refreshAccessToken = async () => {
  const token = localStorage.getItem('token')
  if (!token) {
    throw new Error('No access token')
  }

  const { data } = await api.post(
    '/api/auth/refresh',
    {},
    {
      headers: { Authorization: `Bearer ${token}` },
      skipErrorToast: true,
    }
  )

  localStorage.setItem('token', data.token)
  return data.token
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => {
    const method = response.config.method?.toLowerCase()
    const isMutation = ['post', 'put', 'patch', 'delete'].includes(method)

    const url = response.config.url || ''
    const isAuthRoute =
      url.includes('/api/auth/login') ||
      url.includes('/api/auth/register') ||
      url.includes('/api/auth/create-hod')

    if (isMutation && !response.config.skipSuccessToast && !isAuthRoute) {
      const message =
        response.data?.message ||
        (method === 'post'
          ? 'Created successfully'
          : method === 'delete'
            ? 'Deleted successfully'
            : 'Saved successfully')
      toast.success(message)
    }

    return response
  },
  async (error) => {
    const originalRequest = error.config
    const url = originalRequest?.url || ''
    const isAuthRoute =
      url.includes('/api/auth/login') ||
      url.includes('/api/auth/register') ||
      url.includes('/api/auth/refresh')

    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      if (!originalRequest?.skipErrorToast) {
        toast.error(
          'The server is taking too long to respond. Please try again in a moment.'
        )
      }
      return Promise.reject(error)
    }

    if (
      error.response?.status === 401 &&
      !originalRequest?._retry &&
      !isAuthRoute &&
      localStorage.getItem('token')
    ) {
      originalRequest._retry = true
      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null
          })
        }
        const newToken = await refreshPromise
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return api(originalRequest)
      } catch {
        redirectToLogin()
        return Promise.reject(error)
      }
    }

    if (error.response?.status === 401 && !isAuthRoute) {
      redirectToLogin()
      return Promise.reject(error)
    }

    if (!originalRequest?.skipErrorToast && !isAuthRoute) {
      const message =
        error.response?.data?.message ||
        error.message ||
        'Something went wrong'
      toast.error(message)
    }
    return Promise.reject(error)
  }
)

export default api
