import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy /api → the Node API so the React app can call /api/auth/login etc.
    // with a relative URL (VITE_API_BASE=/api) and avoid CORS in dev.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        configure: (proxy) => {
          // Strip Origin so the API's CORS whitelist doesn't reject requests
          // from dev-only origins (preview proxies, LAN IPs, random ports).
          // Browser-side the call stays same-origin (/api), so no CORS
          // response headers are needed anyway.
          proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'));
        },
      },
    },
  },
});
