import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  css: { postcss: { plugins: [] } },
  esbuild: { jsx: 'automatic' },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { include: ['tests/**/*.test.{ts,tsx}'], environment: 'node', testTimeout: 30_000 },
});
