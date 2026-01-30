import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Mit eigener Domain (mopped.vjbackhaus.de) ist das wieder Root '/'
  base: '/',
})
