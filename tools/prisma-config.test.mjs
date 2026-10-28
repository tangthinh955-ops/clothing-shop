import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const temporaryRoot = join(root, '.local');
const localUrl = 'postgresql://demo:fake@127.0.0.1:1/demo_local';
const testUrl = 'postgresql://demo:fake@127.0.0.1:1/demo_test';
const fallbackUrl = 'postgresql://unused:unused@localhost:5433/unused';

for (const scenario of [
  { name: 'loads backend .env when DATABASE_URL is missing', file: true, expected: localUrl },
  { name: 'preserves an explicit DATABASE_URL without NODE_ENV', file: true, url: testUrl, expected: testUrl },
  { name: 'preserves an explicit test DATABASE_URL', file: true, mode: 'test', url: testUrl, expected: testUrl },
  { name: 'does not load local credentials in test mode', file: true, mode: 'test', expected: fallbackUrl },
  { name: 'allows offline generation without an .env file', file: false, expected: fallbackUrl },
]) {
  test(`Prisma config ${scenario.name}`, () => {
    mkdirSync(temporaryRoot, { recursive: true });
    const fixture = mkdtempSync(join(temporaryRoot, 'prisma-config-'));
    try {
      copyFileSync(join(root, 'apps/backend/prisma.config.ts'), join(fixture, 'prisma.config.ts'));
      if (scenario.file) writeFileSync(join(fixture, '.env'), `DATABASE_URL=${localUrl}\n`);
      const env = { ...process.env };
      delete env.DATABASE_URL;
      delete env.NODE_ENV;
      if (scenario.mode) env.NODE_ENV = scenario.mode;
      if (scenario.url) env.DATABASE_URL = scenario.url;
      const script = `import assert from 'node:assert/strict';
        const { default: config } = await import(${JSON.stringify(pathToFileURL(join(fixture, 'prisma.config.ts')).href)});
        assert.equal(config.datasource.url, ${JSON.stringify(scenario.expected)});`;
      // A different cwd verifies that .env is resolved beside the config file.
      const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
        cwd: root, env, encoding: 'utf8', timeout: 15000,
      });
      assert.equal(result.status, 0, result.stderr);
    } finally {
      assert.equal(dirname(fixture), temporaryRoot);
      rmSync(fixture, { recursive: true, force: true });
    }
  });
}
