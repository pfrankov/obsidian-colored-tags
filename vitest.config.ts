import { defineConfig } from 'vitest/config';
import path from 'path';
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: 'coverage',
      exclude: ['tests/**', 'src/main.ts', 'copy-files-plugin.mjs', 'esbuild.config.mjs', 'version-bump.mjs', 'versions.json', 'manifest.json', 'scripts/check-coverage.js'],
      thresholds: {
        global: {
          statements: 45,
          branches: 45,
          functions: 45,
          lines: 45,
        },
      },
    },
  },
  resolve: {
    alias: {
      'obsidian': path.resolve(__dirname, 'tests/__mocks__/obsidian.ts'),
    },
  },
});
