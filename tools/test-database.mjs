import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

/** @param {string | undefined} databaseUrl @param {string | undefined} nodeEnv */
export function assertTestDatabase(databaseUrl, nodeEnv = process.env.NODE_ENV) {
  try {
    const url = new URL(databaseUrl ?? '');
    if (nodeEnv === 'test' && ['postgres:', 'postgresql:'].includes(url.protocol)
      && decodeURIComponent(url.pathname).endsWith('_test')) return;
  } catch { /* Fail without disclosing connection credentials. */ }
  throw new Error('Isolated fixtures require NODE_ENV=test and a PostgreSQL *_test database.');
}

/** @param {string} label */
export function testDatabaseName(label) {
  if (!/^[a-z][a-z0-9_]{0,15}$/.test(label)) throw new Error('Invalid test database label.');
  return `clothing_${label}_${randomUUID().replaceAll('-', '').slice(0, 16)}_test`;
}

/** Create and migrate a fresh, run-owned database; never mutate the source database's tables.
 * @param {string | undefined} databaseUrl @param {string} label
 */
export async function createIsolatedTestDatabase(databaseUrl, label) {
  assertTestDatabase(databaseUrl);
  const name = testDatabaseName(label);
  const target = new URL(databaseUrl);
  target.pathname = `/${name}`;
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
  let created = false;
  let closed = false;
  async function cleanup() {
    if (closed) return;
    try {
      if (created) {
        // The identifier is generated above and only this invocation can mark it as created.
        assertTestDatabase(target.toString());
        await pool.query(`DROP DATABASE "${name}"`);
        created = false;
      }
    } finally { closed = true; await pool.end(); }
  }
  try {
    await pool.query(`CREATE DATABASE "${name}"`);
    created = true;
    const result = spawnSync(process.execPath,
      [fileURLToPath(new URL('../node_modules/prisma/build/index.js', import.meta.url)), 'migrate', 'deploy'], {
        cwd: fileURLToPath(new URL('../apps/backend/', import.meta.url)), encoding: 'utf8',
        env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: target.toString() },
      });
    if (result.error || result.status !== 0) throw new Error('Migration of the isolated test database failed.');
    return { databaseUrl: target.toString(), name, cleanup };
  } catch (error) {
    try { await cleanup(); } catch (cleanupError) { throw new AggregateError([error, cleanupError], 'Test database setup and cleanup failed.'); }
    throw error;
  }
}
