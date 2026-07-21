import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

// Next 16 dropped the `next lint` command, so the config it used to generate lives here instead.
// eslint-config-next 16 ships flat config natively, so it spreads straight in.
const config = [
  { ignores: ['.next/**', 'node_modules/**', 'local-store-db/**'] },
  ...nextCoreWebVitals,
]

export default config
