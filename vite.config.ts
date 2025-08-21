import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // Exclude problematic dependencies from Vite's dependency optimization
    exclude: [
      'plotly.js', // Large library that can cause optimization issues
      '@e965/xlsx'  // Excel library that may have compatibility issues
    ],
    // Force include common dependencies that should be optimized
    include: [
      'react',
      'react-dom',
      'papaparse',
      'dexie'
    ]
  },
  // Additional server configuration for better development experience
  server: {
    // Force dependency re-optimization on server restart
    force: true
  }
})
