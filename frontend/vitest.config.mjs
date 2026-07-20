import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Tests run in plain Node against a local Ollama - no Next.js, no Docker, no database. The `@` alias
// mirrors jsconfig, and `server-only` is stubbed so server modules (e.g. the MCP result parser) can
// be imported directly. The AI evals call a real model, so timeouts are generous and files run one
// at a time to avoid several graphs hammering one local model at once.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./tests/helpers/empty.js', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    testTimeout: 180000,
    hookTimeout: 30000,
    fileParallelism: false,
    // The AI evals call a non-deterministic local model; recovery makes narrated calls reliable, and
    // a couple of retries absorb the rare pure-prose turn. Deterministic unit tests pass on attempt 1.
    retry: 2,
    reporters: ['verbose'],
  },
})
