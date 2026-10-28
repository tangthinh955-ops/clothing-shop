import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { defineConfig } from 'prisma/config';

// Explicit environment (including .env.test and CI) always takes priority.
// Test mode must never fall back to local database credentials.
const localEnv = new URL('.env', import.meta.url);
if (process.env['DATABASE_URL'] === undefined && process.env['NODE_ENV'] !== 'test' && existsSync(localEnv)) {
  loadEnvFile(localEnv);
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    // Generate can run without a live database; migrate still requires explicit env.
    url: process.env['DATABASE_URL'] ?? 'postgresql://unused:unused@localhost:5433/unused',
  },
});
