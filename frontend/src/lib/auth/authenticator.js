'use client'

/**
 * Browser software authenticator for the passwordless login credential.
 *
 * Generates a real ECDSA P-256 (ES256) key pair with the private key NON-EXTRACTABLE and stores the
 * CryptoKey handle in IndexedDB (never localStorage, never serialized, never downloadable). The private
 * key cannot be exfiltrated even under XSS. Only the public key + minimal metadata leave the browser.
 */

const DB_NAME = 'lw-passwordless'
const KEY_STORE = 'authenticators' // credentialId -> non-extractable CryptoKey
const META_STORE = 'meta' // 'current' -> credential metadata
const META_KEY = 'current'

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(KEY_STORE)) db.createObjectStore(KEY_STORE)
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// Each helper closes its connection once the transaction settles (avoids leaked connections on Safari).
function idbPut(store, key, value) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite')
        tx.objectStore(store).put(value, key)
        tx.oncomplete = () => {
          db.close()
          resolve()
        }
        tx.onerror = () => {
          db.close()
          reject(tx.error)
        }
      }),
  )
}

function idbGet(store, key) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readonly')
        const req = tx.objectStore(store).get(key)
        req.onsuccess = () => {
          db.close()
          resolve(req.result)
        }
        req.onerror = () => {
          db.close()
          reject(req.error)
        }
      }),
  )
}

function idbDelete(store, key) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite')
        tx.objectStore(store).delete(key)
        tx.oncomplete = () => {
          db.close()
          resolve()
        }
        tx.onerror = () => {
          db.close()
          reject(tx.error)
        }
      }),
  )
}

function toB64(bytes) {
  const b = new Uint8Array(bytes)
  let s = ''
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i])
  return btoa(s)
}

function b64UrlFromBuffer(buf) {
  return toB64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function spkiToPem(spki) {
  const b64 = toB64(spki)
  const lines = b64.match(/.{1,64}/g)?.join('\n') ?? b64
  return `-----BEGIN PUBLIC KEY-----\n${lines}\n-----END PUBLIC KEY-----\n`
}

/** Is there an enrolled login credential (key + metadata) in this browser? */
export async function hasCredential() {
  const meta = await idbGet(META_STORE, META_KEY)
  if (!meta) return false
  const key = await idbGet(KEY_STORE, meta.credentialId)
  return !!key
}

/** The stored credential metadata, or undefined. */
export async function getMeta() {
  return idbGet(META_STORE, META_KEY)
}

/**
 * Generate a new login key pair (ES256), persist the non-extractable private key under a fresh
 * credentialId, and return { credentialId, publicKeyPem, alg } to register at Leafy Pay.
 */
export async function createCredential() {
  const credentialId = crypto.randomUUID()
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, // private key non-extractable (public key stays exportable)
    ['sign', 'verify'],
  )
  const spki = await crypto.subtle.exportKey('spki', pair.publicKey)
  await idbPut(KEY_STORE, credentialId, pair.privateKey)
  return { credentialId, publicKeyPem: spkiToPem(spki), alg: 'ES256' }
}

/** Persist credential metadata after a successful enrollment. */
export async function saveMeta(meta) {
  await idbPut(META_STORE, META_KEY, meta)
}

/** Sign a challenge with a specific stored key (used during enrollment, before metadata is saved). */
export async function signWithCredential(credentialId, challenge) {
  const key = await idbGet(KEY_STORE, credentialId)
  if (!key) throw new Error('No local key for this credential')
  const data = new TextEncoder().encode(challenge)
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, data)
  return b64UrlFromBuffer(sig)
}

/** Sign a challenge with the enrolled credential → { credentialId, signature } (base64url raw r||s). */
export async function sign(challenge) {
  const meta = await idbGet(META_STORE, META_KEY)
  if (!meta) throw new Error('No local credential (enroll on this device first)')
  const signature = await signWithCredential(meta.credentialId, challenge)
  return { credentialId: meta.credentialId, signature }
}

/** Build a compact login_hint_token (base64url JSON of the opaque sub) — no raw PII. */
export function loginHintToken(sub) {
  const json = JSON.stringify({ sub })
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Remove the local login credential (key + metadata). */
export async function deleteCredential() {
  const meta = await idbGet(META_STORE, META_KEY)
  if (meta) await idbDelete(KEY_STORE, meta.credentialId).catch(() => {})
  await idbDelete(META_STORE, META_KEY).catch(() => {})
}
