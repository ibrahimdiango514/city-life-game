import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Le preview Arena est servi via un hôte dynamique *.e2b.app — on autorise les hôtes externes (dev uniquement).
    allowedHosts: true,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
})
