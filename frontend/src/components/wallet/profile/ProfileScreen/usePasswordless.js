'use client'

import { useEffect, useState } from 'react'
import {
  hasCredential,
  createCredential,
  saveMeta,
  signWithCredential,
  deleteCredential,
} from '@/lib/auth/authenticator'
import { enrollChallenge, enroll } from '@/lib/auth/actions'

const AUTHENTICATOR_METADATA = { deviceName: 'This browser', createdVia: 'leafy-wallet' }

/**
 * Passwordless-login control for the Profile screen. Reads the current enrollment on mount, runs the
 * enroll ceremony on enable, and confirms before removing the local credential.
 * @param {{sub: string, email: string}} user - The authenticated identity, stored with the credential.
 * @returns {object} Enrollment state and handlers for the UI.
 */
export function usePasswordless(user) {
  const [isEnabled, setIsEnabled] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [isRemoveOpen, setIsRemoveOpen] = useState(false)

  useEffect(() => {
    hasCredential()
      .then(setIsEnabled)
      .catch(() => setIsEnabled(false))
  }, [])

  async function enrollDevice() {
    setIsBusy(true)
    setErrorMsg('')
    try {
      const cred = await createCredential()
      const challenge = await enrollChallenge()
      if (!challenge.ok) throw new Error(challenge.error || 'Could not get an enrollment challenge')
      const signature = await signWithCredential(cred.credentialId, challenge.challenge)
      const registration = await enroll({
        challenge: challenge.challenge,
        publicKeyPem: cred.publicKeyPem,
        alg: cred.alg,
        signature,
        credentialId: cred.credentialId,
        authenticatorMetadata: AUTHENTICATOR_METADATA,
      })
      if (!registration.ok) throw new Error(registration.error || 'Enrollment failed')
      await saveMeta({
        credentialId: cred.credentialId,
        alg: cred.alg,
        sub: user.sub,
        email: user.email,
        createdAt: new Date().toISOString(),
      })
      setIsEnabled(true)
    } catch (e) {
      await deleteCredential().catch(() => {})
      setIsEnabled(false)
      setErrorMsg(e.message || 'Enrollment failed')
    } finally {
      setIsBusy(false)
    }
  }

  // Enabling runs the enrollment ceremony. Disabling asks for confirmation first.
  function handleToggle(next) {
    if (next) {
      enrollDevice()
    } else {
      setIsRemoveOpen(true)
    }
  }

  async function handleConfirmRemove() {
    await deleteCredential().catch(() => {})
    setIsEnabled(false)
    setIsRemoveOpen(false)
  }

  function handleCancelRemove() {
    setIsRemoveOpen(false)
  }

  let statusText
  if (errorMsg) {
    statusText = errorMsg
  } else if (isBusy) {
    statusText = 'Enrolling this device…'
  } else if (isEnabled) {
    statusText = 'Enabled. This browser can unlock without a password.'
  } else {
    statusText = 'Sign in with Face ID instead of the full login next time.'
  }

  return {
    isEnabled,
    isBusy,
    errorMsg,
    statusText,
    isRemoveOpen,
    handleToggle,
    handleConfirmRemove,
    handleCancelRemove,
  }
}
