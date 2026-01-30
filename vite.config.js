import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Base '/' ist für Hosting auf Root-Ebene (z.B. Subdomain: mopped.dein-name.de)
  // Wenn du es in einem Unterordner hast (dein-name.de/mopped), ändere es zu '/mopped/'
  base: '/',
})
