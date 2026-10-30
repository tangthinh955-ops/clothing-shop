import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { assertTestDatabase, testDatabaseName } from './test-database.mjs';

test('isolated database guard rejects local, production, missing and non-PostgreSQL targets', () => {
  for (const [url, mode] of [
    [undefined, 'test'], ['postgresql://localhost/clothing_local', 'test'],
    ['postgresql://localhost/clothing_test', 'production'], ['https://localhost/clothing_test', 'test'],
  ]) assert.throws(() => assertTestDatabase(url, mode), /require NODE_ENV=test/);
  assert.doesNotThrow(() => assertTestDatabase('postgresql://localhost/clothing_test', 'test'));
});

test('run-owned database names are unique, safe identifiers with the required suffix', () => {
  const first = testDatabaseName('settings');
  assert.match(first, /^clothing_settings_[a-f0-9]{16}_test$/);
  assert.notEqual(first, testDatabaseName('settings'));
  assert.ok(first.length < 64);
  assert.throws(() => testDatabaseName('settings";DROP'), /Invalid/);
});
