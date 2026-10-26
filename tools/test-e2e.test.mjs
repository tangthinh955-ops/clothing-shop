import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
for (const scenario of [
  { name: 'non-test database', mode: 'test', url: 'postgresql://test:fake@127.0.0.1:1/clothing_local' },
  { name: 'non-test runtime', mode: 'development', url: 'postgresql://test:fake@127.0.0.1:1/clothing_test' },
  { name: 'malformed database URL', mode: 'test', url: 'not-a-url' },
]) {
  test(`E2E refuses ${scenario.name} before launching Playwright`, () => {
    const result = spawnSync(process.execPath, ['tools/test-e2e.mjs', '--list'], {
      cwd: root, encoding: 'utf8', timeout: 15000,
      env: { ...process.env, NODE_ENV: scenario.mode, DATABASE_URL: scenario.url },
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /E2E requires NODE_ENV=test and a PostgreSQL \*_test database/);
    assert.doesNotMatch(result.stdout, /Listing tests|Running \d+ tests/);
  });
}
