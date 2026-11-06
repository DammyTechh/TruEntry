import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Where `npm run dev` forwards /api requests. Point it at a local backend
  // with VITE_PROXY_TARGET=http://localhost:5000
  const target = env.VITE_PROXY_TARGET || 'https://tru-entry.vercel.app';

  return {
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        '/api': { target, changeOrigin: true, secure: true },
      },
    },
    preview: {
      proxy: {
        '/api': { target, changeOrigin: true, secure: true },
      },
    },
  };
});
