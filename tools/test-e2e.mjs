import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from 'node:process';

const root = new URL('../', import.meta.url);
const install = process.argv[2] === 'install';
if (!install) {
  try { loadEnvFile(fileURLToPath(new URL('apps/backend/.env.test', root))); }
  catch (error) {
    if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ENOENT') throw error;
  }
  let valid = false;
  try {
    const url = new URL(process.env.DATABASE_URL ?? '');
    valid = process.env.NODE_ENV === 'test' && ['postgres:', 'postgresql:'].includes(url.protocol)
      && decodeURIComponent(url.pathname).endsWith('_test');
  } catch { /* Reject invalid configuration without printing credentials. */ }
  if (!valid) {
    console.error('E2E requires NODE_ENV=test and a PostgreSQL *_test database. No servers or tests were started.');
    process.exit(1);
  }
}
const args = install ? ['install', 'chromium', ...(process.argv.includes('--with-deps') ? ['--with-deps'] : [])] : ['test', ...process.argv.slice(2)];
const result = spawnSync(process.execPath,
  ['--env-file-if-exists=../backend/.env.test', fileURLToPath(new URL('node_modules/@playwright/test/cli.js', root)), ...args], {
    cwd: fileURLToPath(new URL('apps/frontend', root)), stdio: 'inherit',
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: fileURLToPath(new URL('.local/ms-playwright', root)) },
  });
if (result.error) { console.error('Could not start Playwright. Check dependencies and Node version.'); }
process.exitCode = result.status ?? 1;
