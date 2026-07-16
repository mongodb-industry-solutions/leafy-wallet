'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { APP_USERS } from '@/lib/wallet-data'
import { WalletDataProvider } from '@/lib/wallet/WalletDataProvider'
import { BottomNav } from '@/components/wallet/shell/BottomNav/BottomNav'
import { HomeTab } from '@/components/wallet/home/HomeTab/HomeTab'
import { ActivityTab } from '@/components/wallet/activity/ActivityTab/ActivityTab'
import { PeopleTab } from '@/components/wallet/people/PeopleTab/PeopleTab'
import { AiTab } from '@/components/wallet/assistant/AiTab/AiTab'
import { TxDetail } from '@/components/wallet/transactions/TxDetail/TxDetail'
import { SendFlow } from '@/components/wallet/send/SendFlow/SendFlow'
import { ProfileScreen } from '@/components/wallet/profile/ProfileScreen/ProfileScreen'
import { AddContactSheet } from '@/components/wallet/people/AddContactSheet/AddContactSheet'
import { NotificationsPanel } from '@/components/wallet/shell/NotificationsPanel/NotificationsPanel'

/**
 * The wallet app shell: switches between tab screens, the send/request flow, and the detail sheet, reporting the active screen via `onFlowChange`.
 * @param {object} props
 * @param {{name: string, email: string, seed: string, bg: string}} [props.user] - The authenticated identity (falls back to seed data).
 * @param {() => void} props.onSignOut
 * @param {(flow: string) => void} [props.onFlowChange] - Called whenever the active screen changes.
 * @param {boolean} [props.isOnline] - Whether the simulated connection is up.
 */
export function WalletApp({ user: userProp, onSignOut, onFlowChange, isOnline = true }) {
  const user = userProp ?? APP_USERS[0]
  const [tab, setTab] = useState('home')
  const [detail, setDetail] = useState(null)
  const [sendContact, setSendContact] = useState(null)
  const [isSendOpen, setIsSendOpen] = useState(false)
  const [sendMode, setSendMode] = useState('send')
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isAddContactOpen, setIsAddContactOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  // Reset each time WalletApp mounts (i.e. each authentication), so the Home
  // aurora intro plays once per login, not on every return to the Home tab.
  const heroIntroPlayedRef = useRef(false)

  let flow
  if (isSendOpen) {
    flow = sendMode === 'request' ? 'request' : 'send'
  } else if (detail) {
    flow = 'transaction'
  } else {
    flow = tab
  }

  useEffect(() => {
    onFlowChange?.(flow)
  }, [flow, onFlowChange])

  function handleOpenSend(mode, contact = null) {
    setSendMode(mode)
    setSendContact(contact)
    setIsSendOpen(true)
  }

  function handleCloseSend() {
    setIsSendOpen(false)
    setSendContact(null)
    setSendMode('send')
    setTab('home')
  }

  const handleHeroIntroPlayed = useCallback(() => {
    heroIntroPlayedRef.current = true
  }, [])

  return (
    <WalletDataProvider isOnline={isOnline} ownerKey={user?.sub}>
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-muted">
        {!isSendOpen && (
          <>
            {/* Home has its own gradient hero (with the profile menu). Activity /
                People / Chat stand on their own titles, no top bar. */}
            {tab === 'ai' ? (
              <AiTab user={user} />
            ) : (
              <div className="no-scrollbar flex-1 overflow-y-auto overflow-x-hidden overscroll-none pb-24">
                {tab === 'home' && (
                  <HomeTab
                    user={user}
                    onSignOut={onSignOut}
                    onProfile={() => setIsProfileOpen(true)}
                    onOpenNotifications={() => setIsNotificationsOpen(true)}
                    onSetTab={setTab}
                    onDetail={setDetail}
                    onSend={() => handleOpenSend('send')}
                    onRequest={() => handleOpenSend('request')}
                    playHeroIntro={!heroIntroPlayedRef.current}
                    onHeroIntroPlayed={handleHeroIntroPlayed}
                  />
                )}
                {tab === 'activity' && <ActivityTab onDetail={setDetail} />}
                {tab === 'people' && (
                  <PeopleTab
                    onSendTo={(c) => handleOpenSend('send', c)}
                    onAddContact={() => setIsAddContactOpen(true)}
                  />
                )}
              </div>
            )}

            <BottomNav tab={tab} setTab={setTab} />
          </>
        )}

        {isSendOpen && (
          <SendFlow
            initialContact={sendContact || undefined}
            initialMode={sendMode}
            isOnline={isOnline}
            onClose={handleCloseSend}
          />
        )}
        {detail && <TxDetail tx={detail} onClose={() => setDetail(null)} />}
        {isAddContactOpen && <AddContactSheet onClose={() => setIsAddContactOpen(false)} />}
        {isNotificationsOpen && <NotificationsPanel onClose={() => setIsNotificationsOpen(false)} />}
        {isProfileOpen && (
          <div className="absolute inset-0 z-40">
            <ProfileScreen user={user} onClose={() => setIsProfileOpen(false)} onSignOut={onSignOut} />
          </div>
        )}
      </div>
    </WalletDataProvider>
  )
}
