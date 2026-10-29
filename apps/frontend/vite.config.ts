import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true, proxy: { '/api': process.env['API_PROXY_TARGET'] ?? 'http://127.0.0.1:3000' } },
  // E2E serves the production build through `vite preview`; the dev server's on-demand
  // pipeline crashed with 0xC0000409 on Windows mid suite, so tests avoid it entirely.
  preview: { proxy: { '/api': process.env['API_PROXY_TARGET'] ?? 'http://127.0.0.1:3000' } },
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], include: ['src/**/*.test.{ts,tsx}'] },
});
