/**
 * Leafy Wallet end-to-end user workflows.
 *
 * Every test here runs against the Next.js frontend alone: `me()` only decrypts a cookie, the
 * passwordless check only reads IndexedDB, and the PSP env vars default to empty instead of throwing,
 * so an unconfigured frontend lands on the sign-in screen with the whole presenter stage reachable.
 * No Leafy Pay, no Atlas, no ObjectBox, no Ollama, which is what lets this run unchanged in CI.
 *
 * That is also the boundary. Anything past sign-in belongs to Leafy Pay in the separate sec-fsi repo,
 * and there is no way to automate that login from here (it is a hosted page on another origin). Where
 * a workflow crosses over, the test asserts our side of the contract and stops: FS-LW-05 and FS-LW-06
 * intercept the handoff instead of following it.
 *
 * The AI assistant is not covered here either. The vitest evals in tests/ai already drive the real
 * LangGraph graph, which is a better place to assert on answers than a browser.
 */
import { test, expect } from '@playwright/test'
import { EnvironmentHelper } from './utils/environment-helper.js'
import { DEMO_USERS } from '../../src/lib/demo-users.js'

const SIGN_IN_STEP_TITLE = 'Sign in as a demo user'

let frontendUrl

/** Close the first-run welcome overlay, which otherwise covers the whole stage and swallows clicks. */
async function dismissWelcome(page) {
  const skip = page.getByRole('button', { name: 'Just let me try it' })
  await skip.click()
  await expect(skip).toBeHidden()
}

/** The presenter's simulated connection switch, which sits beside the phone rather than inside it. */
function connectionSwitch(page) {
  return page.getByRole('switch', { name: 'Simulated connection' })
}

/** Best-effort teardown so one test's storage never leaks into the next. */
async function clearBrowserState(page, context) {
  try {
    await Promise.all(
      context
        .pages()
        .filter((p) => p !== page && !p.isClosed())
        .map((p) => p.close()),
    )
    await context.clearPermissions()
    if (!page.isClosed()) {
      // Belt and braces: each test already gets a fresh context. Ignored on failure because the error
      // page an aborted navigation leaves behind denies storage access, which does not matter here.
      await page
        .evaluate(() => {
          localStorage.clear()
          sessionStorage.clear()
        })
        .catch(() => {})
    }
  } catch (error) {
    console.warn('Cleanup error in afterEach:', error.message)
  }
}

test.describe('Leafy Wallet - E2E User Workflows', () => {
  test.beforeAll(() => {
    const appName = process.env.APP_NAME || 'leafy-wallet'
    const envName = process.env.ENV_NAME || 'local'
    frontendUrl = EnvironmentHelper.getFrontendUrl(appName, envName)
  })

  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies()
    await page.goto(frontendUrl)
    await page.waitForLoadState('networkidle')
  })

  test.afterEach(async ({ page, context }) => {
    await clearBrowserState(page, context)
  })

  test('FS-LW-01: Presenter stage pairs the phone with the "Built on MongoDB" panel', async ({ page }) => {
    // Assert initial state: the welcome greets a first-time visitor before anything else.
    await expect(page.getByRole('heading', { name: 'Welcome to Leafy Wallet' })).toBeVisible()

    // Act
    await dismissWelcome(page)

    // Assert the stage itself: narration panel, its sign-in talking point, and the connection control.
    await expect(page.getByRole('heading', { name: 'Built on MongoDB', level: 2 })).toBeVisible()
    await expect(page.getByRole('heading', { name: SIGN_IN_STEP_TITLE, level: 3 })).toBeVisible()
    await expect(connectionSwitch(page)).toHaveAttribute('aria-checked', 'true')
  })

  test('FS-LW-02: Welcome overlay orients a booth visitor and points at sign-in first', async ({ page }) => {
    const welcome = page.getByRole('heading', { name: 'Welcome to Leafy Wallet' })
    await expect(welcome).toBeVisible()
    await expect(
      page.getByText('The panel on the right explains what MongoDB is doing on each screen.'),
    ).toBeVisible()

    // Pre-auth the tour cannot drive the SSO redirect, so the primary action asks for sign-in instead.
    await expect(page.getByRole('button', { name: 'Sign in to watch the tour' })).toBeVisible()
    await expect(page.getByText('Sign in on the phone first. The tour starts right after.')).toBeVisible()
  })

  test('FS-LW-03: Dismissing the welcome leaves a way back into the intro', async ({ page }) => {
    await dismissWelcome(page)
    await expect(page.getByRole('heading', { name: 'Welcome to Leafy Wallet' })).toBeHidden()

    // Act: the low-prominence re-entry point a presenter uses between conversations.
    const reopen = page.getByRole('button', { name: 'Watch the intro' })
    await expect(reopen).toBeVisible()
    await reopen.click()

    await expect(page.getByRole('heading', { name: 'Welcome to Leafy Wallet' })).toBeVisible()
    await expect(reopen).toBeHidden()
  })

  test('FS-LW-04: Sign-in screen offers every configured demo profile plus the SSO entry point', async ({
    page,
  }) => {
    await dismissWelcome(page)

    // Sourced from the app's own demo-user config, so pointing the demo at another Leafy Pay instance
    // updates the expectation instead of breaking the test.
    for (const user of DEMO_USERS) {
      const firstName = user.name.split(' ')[0]
      await expect(page.getByRole('button', { name: firstName, exact: true })).toBeVisible()
    }

    await expect(page.getByRole('button', { name: 'Continue with SSO' })).toBeVisible()
    await expect(page.getByText('Privacy policy')).toBeVisible()
    await expect(page.getByText('Terms of service')).toBeVisible()
  })

  test('FS-LW-05: Continue with SSO hands off to the authorization route with an empty form', async ({
    page,
  }) => {
    await dismissWelcome(page)

    // The route redirects to Leafy Pay, which is not part of this repo. Aborting keeps the assertion on
    // our side of the contract: the handoff is made, with the right shape, and no user hint attached.
    await page.route('**/api/auth/login**', (route) => route.abort())
    const handoff = page.waitForRequest('**/api/auth/login**')

    await page.getByRole('button', { name: 'Continue with SSO' }).click()

    const url = new URL((await handoff).url())
    expect(url.pathname).toBe('/api/auth/login')
    expect(url.searchParams.get('user')).toBeNull()
  })

  test('FS-LW-06: Tapping a demo profile carries that user as a prefill hint', async ({ page }) => {
    await dismissWelcome(page)

    const [firstUser] = DEMO_USERS
    await page.route('**/api/auth/login**', (route) => route.abort())
    const handoff = page.waitForRequest('**/api/auth/login**')

    await page.getByRole('button', { name: firstUser.name.split(' ')[0], exact: true }).click()

    // Only the email travels; the password is matched server-side against the repo's demo config.
    const url = new URL((await handoff).url())
    expect(url.pathname).toBe('/api/auth/login')
    expect(url.searchParams.get('user')).toBe(firstUser.email)
  })

  test('FS-LW-07: Connection control toggles the simulated network both ways', async ({ page }) => {
    await dismissWelcome(page)
    const connection = connectionSwitch(page)

    await expect(connection).toContainText('Connected')

    await connection.click()
    await expect(connection).toHaveAttribute('aria-checked', 'false')
    await expect(connection).toContainText('Offline')

    await connection.click()
    await expect(connection).toHaveAttribute('aria-checked', 'true')
    await expect(connection).toContainText('Connected')
  })

  test('FS-LW-08: The keyboard shortcut toggles the connection without touching the control', async ({
    page,
  }) => {
    await dismissWelcome(page)
    const connection = connectionSwitch(page)
    await expect(connection).toHaveAttribute('aria-checked', 'true')

    await page.keyboard.press('ControlOrMeta+k')

    await expect(connection).toHaveAttribute('aria-checked', 'false')
    await expect(connection).toContainText('Offline')
  })

  test('FS-LW-09: ?offline=1 boots the stage straight into the offline story', async ({ page }) => {
    await page.goto(`${frontendUrl}/?offline=1`)
    await page.waitForLoadState('networkidle')
    await dismissWelcome(page)

    await expect(connectionSwitch(page)).toHaveAttribute('aria-checked', 'false')
    await expect(connectionSwitch(page)).toContainText('Offline')
  })

  test('FS-LW-10: The sign-in talking point surfaces a copyable shared credential', async ({
    page,
    context,
  }) => {
    // The copy helper calls navigator.clipboard with no fallback, so without this the click rejects.
    await context.grantPermissions(['clipboard-write'], { origin: frontendUrl })
    await dismissWelcome(page)

    await expect(page.getByRole('heading', { name: SIGN_IN_STEP_TITLE, level: 3 })).toBeVisible()

    // Asserted as "present and non-empty" rather than by value: the repo ships placeholders that each
    // deployment replaces, and a real credential must never be pinned in a test file.
    const credential = page.locator('code').first()
    await expect(credential).toBeVisible()
    await expect(credential).not.toBeEmpty()

    const copyButton = page.getByRole('button', { name: /^Copy / })
    await copyButton.click()
    await expect(copyButton).toContainText('Copied')
  })

  test('FS-LW-11: The stage survives Leafy Pay being unconfigured, with no uncaught errors', async ({
    page,
  }) => {
    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    // Re-navigate so the listener sees the whole boot, including the session and credential probes.
    await page.goto(frontendUrl)
    await page.waitForLoadState('networkidle')
    await dismissWelcome(page)

    // Falling back to the sign-in screen is the correct unconfigured behaviour, not an error state.
    await expect(page.getByRole('button', { name: 'Continue with SSO' })).toBeVisible()
    expect(pageErrors).toEqual([])
  })
})
