import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import checker from 'vite-plugin-checker'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
// import { visualizer } from 'rollup-plugin-visualizer'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills(),
    checker({ typescript: true }),
    // visualizer({
    //   open: false,
    //   filename: 'dist/stats.html',
    //   gzipSize: true,
    //   brotliSize: true,
    // }),
  ],
  worker: {
    format: 'es'
  },
  server: {
    port: 3000,
    proxy: {
      '/druid/v2': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/druid\/v2/, '/druid/v2'),
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          antd: ['antd'],
          keycloak: ['keycloak-js'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },

})
