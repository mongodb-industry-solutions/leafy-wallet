import { defineConfig, devices } from '@playwright/test'
import { EnvironmentHelper } from './tests/e2e/utils/environment-helper.js'

const { appName, envName, frontendUrl } = EnvironmentHelper.resolveTarget()
const isCi = Boolean(process.env.CI)
const isLocal = envName === 'local'

// Generous enough for the stage's entry animations, short enough that a genuinely missing element
// fails the run rather than stalling it.
const ACTION_TIMEOUT_MS = 10_000
const TEST_TIMEOUT_MS = 30_000
const SERVER_BOOT_TIMEOUT_MS = 180_000

/**
 * Playwright config for the Leafy Wallet E2E suite.
 *
 * Only `local` gets a managed web server. Staging is a corp-network deployment that is already
 * running, and pointing a `webServer` at it would try to boot a second copy.
 *
 * In CI the server is the production build (`npm run start`), which is what the demo actually ships.
 * Locally it is `npm run dev`, and an already-running dev server is reused rather than replaced, so
 * this never fights the one you started yourself.
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.js',
  // Vitest owns tests/unit and tests/ai; both use *.test.js, so the two runners never collide.
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  workers: isCi ? 2 : undefined,
  timeout: TEST_TIMEOUT_MS,
  expect: { timeout: ACTION_TIMEOUT_MS },
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['json', { outputFile: 'test-results/results.json' }],
    [isCi ? 'github' : 'list'],
  ],
  metadata: { app: appName, environment: envName },
  use: {
    baseURL: frontendUrl,
    actionTimeout: ACTION_TIMEOUT_MS,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: isLocal
    ? {
        command: isCi ? 'npm run start' : 'npm run dev',
        url: frontendUrl,
        reuseExistingServer: !isCi,
        timeout: SERVER_BOOT_TIMEOUT_MS,
      }
    : undefined,
})
