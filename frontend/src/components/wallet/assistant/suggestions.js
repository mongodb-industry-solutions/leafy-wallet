import { DEMO_USERS } from '@/lib/demo-users'

const firstNameOf = (person) => person.name.split(' ')[0]

/**
 * Chat suggestion chips for the signed-in user. The send/request chips target the user's own saved
 * contacts, so the drafts they open always resolve to a real beneficiary; before contacts load, they
 * fall back to the other demo users.
 * @param {string} [email] - The signed-in user's email.
 * @param {{name: string}[]} [contacts] - The user's saved contacts.
 * @returns {{label: string, query: string}[]}
 */
export function suggestionsFor(email, contacts = []) {
  const fromContacts = contacts.map(firstNameOf).filter(Boolean)
  const fromDemoUsers = DEMO_USERS.filter((u) => u.email !== email).map(firstNameOf)
  const pool = fromContacts.length >= 2 ? fromContacts : fromDemoUsers
  const [sendTo, requestFrom = sendTo] = pool
  return [
    { label: 'Summarize my week', query: 'How much did I spend this week?' },
    { label: 'Spending by category', query: 'What are my spending categories?' },
    { label: `Send money to ${sendTo}`, query: `Send €20 to ${sendTo} for lunch` },
    { label: `Request from ${requestFrom}`, query: `Request €15 from ${requestFrom}` },
  ]
}
