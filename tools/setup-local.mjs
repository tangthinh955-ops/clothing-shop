import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
for (const name of ['.env', '.env.test']) {
  const destination = new URL(`apps/backend/${name}`, root);
  const example = await readFile(new URL(`apps/backend/${name}.example`, root), 'utf8');
  const content = example.replace('REPLACE_WITH_AT_LEAST_32_RANDOM_BYTES', randomBytes(48).toString('base64url'));
  try {
    await writeFile(destination, content, { flag: 'wx', mode: 0o600 });
    console.log(`Đã tạo ${fileURLToPath(destination)}; không in secret.`);
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error;
    console.log(`Giữ nguyên ${name} đã có.`);
  }
}
