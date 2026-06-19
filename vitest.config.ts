import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// '@/*' maps to the repo root (mirrors tsconfig paths) so component imports resolve under test.
const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': root.replace(/\/$/, '') },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Keep Playwright's e2e/ specs out of the unit runner — they use a different runner.
    exclude: ['e2e/**', 'node_modules/**', '.next/**'],
    css: false,
  },
})
