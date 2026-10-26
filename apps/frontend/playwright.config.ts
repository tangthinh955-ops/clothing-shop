import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e', workers: 1, retries: 0, timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:5174', browserName: 'chromium', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: [
    { command: 'npm run build && node --env-file-if-exists=.env.test dist/main.js', cwd: '../backend',
      env: { APP_ORIGIN: 'http://127.0.0.1:5174', PORT: '3001' },
      url: 'http://127.0.0.1:3001/api/v1/health/ready', timeout: 120000, reuseExistingServer: false },
    { command: 'npm run dev -- --port 5174', env: { API_PROXY_TARGET: 'http://127.0.0.1:3001' },
      url: 'http://127.0.0.1:5174', timeout: 120000, reuseExistingServer: false },
  ],
});
