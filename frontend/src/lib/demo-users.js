/**
 * The demo identities the whole demo revolves around, shown on the sign-in walkthrough.
 *
 * This is the single place to edit when pointing the app at your own Leafy Pay instance:
 * replace these entries with users that exist in YOUR Leafy Pay (email login only), and the
 * walkthrough will display whatever is listed here. The values below match MongoDB's shared
 * demo environment.
 */
export const DEMO_USERS = [
  { name: 'Amara Okafor', email: 'amara.okafor@back.es', password: 'demo-password' },
  { name: 'Luis Fernandez', email: 'luis.fernandez@back.es', password: 'demo-password' },
  { name: 'Priya Patel', email: 'priya.patel@back.es', password: 'demo-password' },
]

const firstNameOf = (user) => user.name.split(' ')[0]

/**
 * Chat suggestion chips for the signed-in user. Money actions target the other demo users, so
 * every suggestion resolves against contacts that actually exist for whoever is logged in.
 * @param {string} [email] - The signed-in user's email.
 * @returns {{label: string, query: string}[]}
 */
export function suggestionsFor(email) {
  const others = DEMO_USERS.filter((u) => u.email !== email)
  const [sendTo, requestFrom] = others.length >= 2 ? others : DEMO_USERS
  return [
    { label: 'Summarize my week', query: 'How much did I spend this week?' },
    { label: 'Break down my spending', query: 'Where did my money go?' },
    { label: `Send money to ${firstNameOf(sendTo)}`, query: `Send €20 to ${firstNameOf(sendTo)} for lunch` },
    { label: `Request from ${firstNameOf(requestFrom)}`, query: `Request €15 from ${firstNameOf(requestFrom)}` },
  ]
}
