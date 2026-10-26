import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.integration.spec.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 30000,
  },
});
