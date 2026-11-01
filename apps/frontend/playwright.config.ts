import { defineConfig } from '@playwright/test';
import { readdirSync } from 'node:fs';

// Each spec is a separate client. Fast CI must not pool unrelated users into
// one rate-limit bucket; limits and guards stay enabled in the test server.
const specs = readdirSync(new URL('./e2e/', import.meta.url))
  .filter((file) => file.endsWith('.spec.ts')).sort();

export default defineConfig({
  testDir: './e2e', workers: 1, retries: 0, timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:5174', browserName: 'chromium', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: specs.map((file, index) => ({
    name: file.slice(0, -'.spec.ts'.length),
    testMatch: `**/${file}`,
    use: { extraHTTPHeaders: { 'X-Forwarded-For': `10.250.${Math.floor(index / 254)}.${index % 254 + 1}` } },
  })),
  webServer: [
    { command: 'npm run build && node --env-file-if-exists=.env.test dist/main.js', cwd: '../backend',
      // Trust the single local Vite proxy only in this E2E server process.
      env: { APP_ORIGIN: 'http://127.0.0.1:5174', PORT: '3001', TRUST_PROXY: '1' },
      url: 'http://127.0.0.1:3001/api/v1/health/ready', timeout: 120000, reuseExistingServer: false },
    { command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 5174', env: { API_PROXY_TARGET: 'http://127.0.0.1:3001' },
      url: 'http://127.0.0.1:5174', timeout: 120000, reuseExistingServer: false },
  ],
});
