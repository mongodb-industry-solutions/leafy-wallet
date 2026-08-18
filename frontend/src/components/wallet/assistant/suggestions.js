import { DEMO_USERS } from '@/lib/demo-users'

const firstNameOf = (person) => person.name.split(' ')[0]

// The bill the split chip proposes. Named in the query so the draft carries "dinner" as its note.
const SPLIT_AMOUNT = 40

// How many contacts the bill is split with, on top of the user themselves.
const SPLIT_CONTACTS = 2

// "me, Ana and Bo". Listing every share-holder, the user included, is what gets the local model
// dividing by the right count: asked to split "with Ana and Bo" it divides by two and forgets itself.
const joinNames = (names) =>
  names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0]

/**
 * Chat suggestion chips for the signed-in user, targeting their own saved contacts so every draft
 * resolves to a real beneficiary; before contacts load they fall back to the other demo users.
 * @param {string} [email] - The signed-in user's email.
 * @param {{name: string}[]} [contacts] - The user's saved contacts.
 * @returns {{label: string, query: string}[]}
 */
export function suggestionsFor(email, contacts = []) {
  const fromContacts = contacts.map(firstNameOf).filter(Boolean)
  const fromDemoUsers = DEMO_USERS.filter((u) => u.email !== email).map(firstNameOf)
  const pool = fromContacts.length >= 2 ? fromContacts : fromDemoUsers
  const [sendTo, requestFrom = sendTo] = pool
  const splitWith = joinNames(['me', ...pool.slice(0, SPLIT_CONTACTS)])
  return [
    {
      label: 'Split the bill',
      query: `Split my €${SPLIT_AMOUNT} dinner bill evenly between ${splitWith}`,
    },
    { label: 'Spending by category', query: 'What are my spending categories?' },
    { label: `Send money to ${sendTo}`, query: `Send €20 to ${sendTo} for lunch` },
    { label: `Request from ${requestFrom}`, query: `Request €15 from ${requestFrom}` },
  ]
}
