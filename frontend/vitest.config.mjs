import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Next reads .env.local, Vitest does not, so the Grove/Voyage keys would need typing out each run.
// A real environment variable still wins, which is how the npm scripts set APP_ENV for one run.
try {
  process.loadEnvFile(fileURLToPath(new URL('.env.local', import.meta.url)))
} catch {
  /* no .env.local: the evals' preflight says what is unset */
}

// Tests run in plain Node - no Next.js, no Docker, no database. The `@` alias mirrors jsconfig, and
// `server-only` is stubbed so server modules (e.g. the MCP result parser) can be imported directly.
// The AI evals call a real model - local Ollama by default, or Grove with APP_ENV and GROVE_API_KEY
// set - so timeouts are generous and files run one at a time rather than hammering one local model.
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
    // Against Grove, a failing test bills three gateway calls rather than one.
    retry: 2,
    reporters: ['verbose'],
  },
})
