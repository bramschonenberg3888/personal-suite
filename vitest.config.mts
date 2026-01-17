import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./__tests__/setup.ts'],
    // Include test files from __tests__ directory and any .test.ts(x) files
    include: ['__tests__/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    // Exclude node_modules and e2e tests (handled by Playwright)
    exclude: ['node_modules', 'tests/**/*'],
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        '__tests__/setup.ts',
        '**/*.config.{ts,mts,js,mjs}',
        '**/generated/**',
        'src/env.ts',
        '.next/**',
      ],
      // Thresholds can be enabled when ready
      // thresholds: {
      //   lines: 80,
      //   functions: 80,
      //   branches: 80,
      //   statements: 80,
      // },
    },
    // Improve test isolation
    isolate: true,
    // Reporter configuration
    reporters: ['default'],
  },
});
