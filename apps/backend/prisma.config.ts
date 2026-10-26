import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    // Generate can run without a live database; migrate still requires explicit env.
    url: process.env['DATABASE_URL'] ?? 'postgresql://unused:unused@localhost:5433/unused',
  },
});
