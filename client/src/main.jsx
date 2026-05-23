import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import toast from 'react-hot-toast'
import './index.css'
import App from './App.jsx'

window.addEventListener('offline', () => {
  toast.error('You are offline. Some features may not work.')
})

window.addEventListener('online', () => {
  toast.success('Back online!')
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
