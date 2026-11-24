import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // ส่ง /api ไปที่ NestJS (เปลี่ยนได้ด้วย API_URL) เบราว์เซอร์เห็นเป็น origin เดียวกัน ไม่ต้องตั้ง CORS
    proxy: {
      '/api': process.env.API_URL ?? 'http://localhost:3000',
    },
  },
})
