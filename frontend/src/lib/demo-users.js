/**
 * The demo identities the whole demo revolves around, shown on the sign-in walkthrough.
 *
 * The single place to edit when pointing the app at your own Leafy Pay: replace these with users that
 * exist there (email login only). The values below match MongoDB's shared demo environment.
 */
// `seed`/`bg` pin each user's Peep avatar; `bg` is a hex color with no leading `#`. `phone` is their
// Leafy Pay registration, so a contact's masked hint can be matched back to the same avatar.
export const DEMO_USERS = [
  { name: 'Amara Okafor', email: 'amara.okafor@back.es', phone: '+234 806 543 2109', password: 'demo-password', seed: 'amara', bg: 'dcfce7' },
  { name: 'Luis Fernandez', email: 'luis.fernandez@back.es', phone: '+34 612 345 678', password: 'demo-password', seed: 'luis-fernandez', bg: 'dbeafe' },
  { name: 'Priya Patel', email: 'priya.patel@back.es', phone: '+44 7712 345678', password: 'demo-password', seed: 'priya-patel', bg: 'fce7f3' },
]

/**
 * The demo profile a row is about, or undefined. Matches on the pinned avatar seed first, since a row's
 * `name` is whatever the user saved ("Luis (work)") while the seed only comes from a demo identity.
 * @param {{name?: string, seed?: string}} row
 * @returns {{name: string, email: string, seed: string} | undefined}
 */
export function demoUserFor({ name, seed }) {
  const bySeed = seed ? DEMO_USERS.find((u) => u.seed === seed) : undefined
  if (bySeed) return bySeed
  const key = name?.trim().toLowerCase()
  return key ? DEMO_USERS.find((u) => u.name.toLowerCase() === key) : undefined
}

/**
 * Look up a demo user's pinned avatar by email, so the in-app profile picture matches the login card.
 * @param {string} [email]
 * @returns {{seed: string, bg: string} | undefined}
 */
export function demoAvatarFor(email) {
  const user = email ? DEMO_USERS.find((u) => u.email === email) : undefined
  return user ? { seed: user.seed, bg: user.bg } : undefined
}
