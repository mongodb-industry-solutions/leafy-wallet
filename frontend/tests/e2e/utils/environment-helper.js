import { APPS } from '../config/apps.js'

export const DEFAULT_APP = 'leafy-wallet'
export const DEFAULT_ENV = 'local'

/** Format a list for an error message, so a typo names the valid options instead of just failing. */
function listOf(values) {
  return values.length ? values.join(', ') : '(none)'
}

/**
 * Resolves app URLs from the registry in `../config/apps.js`. API-compatible with `EnvironmentHelper`
 * in the central ist-endtoend-tests-demo-solutions repo, so a spec runs against either unchanged.
 */
export class EnvironmentHelper {
  /**
   * Frontend URL for an app in an environment, with no trailing slash.
   * `BASE_URL` overrides everything, which is how you point a run at an ad-hoc port or a branch deploy.
   * @param {string} [appName] - Key in the registry.
   * @param {string} [envName] - Environment key for that app.
   * @returns {string}
   */
  static getFrontendUrl(appName = DEFAULT_APP, envName = DEFAULT_ENV) {
    if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, '')

    const app = APPS[appName]
    if (!app) {
      throw new Error(`Unknown app "${appName}". Registered apps: ${listOf(Object.keys(APPS))}.`)
    }

    const environment = app.environments[envName]
    if (!environment) {
      throw new Error(
        `Unknown environment "${envName}" for app "${appName}". ` +
          `Available: ${listOf(Object.keys(app.environments))}.`,
      )
    }

    return environment.frontend.replace(/\/$/, '')
  }

  /**
   * Every app key in the registry.
   * @returns {string[]}
   */
  static getAvailableApps() {
    return Object.keys(APPS)
  }

  /**
   * Every environment key registered for one app.
   * @param {string} [appName]
   * @returns {string[]}
   */
  static getAvailableEnvironments(appName = DEFAULT_APP) {
    const app = APPS[appName]
    if (!app) {
      throw new Error(`Unknown app "${appName}". Registered apps: ${listOf(Object.keys(APPS))}.`)
    }
    return Object.keys(app.environments)
  }

  /**
   * The app and environment the current run targets, from APP_NAME/ENV_NAME.
   * @returns {{appName: string, envName: string, frontendUrl: string}}
   */
  static resolveTarget() {
    const appName = process.env.APP_NAME || DEFAULT_APP
    const envName = process.env.ENV_NAME || DEFAULT_ENV
    return { appName, envName, frontendUrl: EnvironmentHelper.getFrontendUrl(appName, envName) }
  }
}
