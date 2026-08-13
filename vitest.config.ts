import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 15_000,
    include: ['packages/**/*.test.ts', 'apps/api/**/*.test.ts', 'apps/web/**/*.test.ts?(x)'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
    coverage: {
      provider: 'v8',
      include: ['packages/core/src/**/*.ts', 'packages/templates/src/**/*.ts'],
      exclude: ['**/index.ts'],
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
      reporter: ['text', 'html', 'lcov'],
    },
  },
});
