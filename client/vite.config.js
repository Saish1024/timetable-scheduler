import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 4123,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: 'localhost',
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Vite 8 / Rolldown expects a function (object form maps to vendor + utils chunks)
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (
            id.includes('/react/') ||
            id.includes('react-dom') ||
            id.includes('react-router')
          ) {
            return 'vendor'
          }
          if (id.includes('axios') || id.includes('react-hot-toast')) {
            return 'utils'
          }
        },
      },
    },
  },
})
