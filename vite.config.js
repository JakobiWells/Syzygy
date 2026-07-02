import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Split the eclipse page's heavyweight vendors into parallel,
        // independently cacheable chunks (only fetched on /eclipse).
        manualChunks(id) {
          if (id.includes('issArchive.json')) return 'iss-archive'
          if (id.includes('node_modules/mapbox-gl')) return 'mapbox'
          if (id.includes('node_modules/@turf')) return 'turf'
          if (id.includes('node_modules/astronomy-engine')) return 'astronomy'
          if (id.includes('node_modules/satellite.js')) return 'astronomy'
        },
      },
    },
  },
})
