import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Unit tests run in a plain Node environment: every calculation module is a pure
 * function of the snapshot, and the IndexedDB layer is exercised through
 * `fake-indexeddb`, so no DOM is required.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    restoreMocks: true,
  },
});
