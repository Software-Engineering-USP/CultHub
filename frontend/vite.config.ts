import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // A API do Django fica na mesma origem do front (sem CORS). No Docker,
    // API_PROXY_TARGET aponta para o serviço `backend`.
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET ?? 'http://localhost:8000',
        // Mantém o Host original para a checagem de CSRF do Django
        changeOrigin: false,
      },
    },
  },
})
