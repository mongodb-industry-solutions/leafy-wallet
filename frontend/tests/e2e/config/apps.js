/**
 * URL registry for the E2E suite, one entry per app and environment.
 *
 * Mirrors the shape of `config/apps.json` in the central ist-endtoend-tests-demo-solutions repo, so
 * the entry below can be lifted into that file verbatim. It is a JS module rather than JSON only
 * because Playwright transpiles this suite to CommonJS (the frontend package is not `type: module`),
 * and a JSON import behaves differently under each module system.
 *
 * Production is deliberately absent: a test run must never be able to point itself at the live demo.
 */
export const APPS = {
  'leafy-wallet': {
    displayName: 'Leafy Wallet',
    vertical: 'fsi',
    testIdPrefix: 'FS-LW',
    environments: {
      // `npm run dev` and `npm run start` both listen on 8080.
      local: { frontend: 'http://localhost:8080' },
      // Corp network only, so this environment is unreachable from GitHub Actions.
      staging: { frontend: 'https://leafy-wallet-frontend.industrysolutions.staging.corp.mongodb.com' },
    },
  },
}
