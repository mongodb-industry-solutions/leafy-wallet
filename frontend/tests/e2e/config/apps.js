/**
 * URL registry for the E2E suite, one entry per app and environment, mirroring `config/apps.json` in
 * the central ist-endtoend-tests-demo-solutions repo. Production is absent on purpose.
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
