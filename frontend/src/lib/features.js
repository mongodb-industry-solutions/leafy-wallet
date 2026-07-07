// Feature flags for functionality that's built but not yet shown to users.

// Multiple currencies/balances per account, and the currency picker in the
// send/request flow. Off for now — wallet is EUR-only — but the data and
// logic (CURRENCIES in wallet-data.js, the picker in NumpadStep.jsx) stay
// in place to turn back on later.
export const MULTI_CURRENCY_ENABLED = false
