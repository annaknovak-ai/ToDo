import { defineConfig } from 'vitest/config';

// Integration tests run against the Dev Supabase project only (ADR-7).
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.integration.test.ts'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
