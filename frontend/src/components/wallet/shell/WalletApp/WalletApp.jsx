'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { WalletDataProvider } from '@/lib/wallet/WalletDataProvider'
import { BottomNav } from '@/components/wallet/shell/BottomNav/BottomNav'
import { HomeTab } from '@/components/wallet/home/HomeTab/HomeTab'
import { ActivityTab } from '@/components/wallet/activity/ActivityTab/ActivityTab'
import { PeopleTab } from '@/components/wallet/people/PeopleTab/PeopleTab'
import { AiTab } from '@/components/wallet/assistant/AiTab/AiTab'
import { TxDetail } from '@/components/wallet/transactions/TxDetail/TxDetail'
import { SendFlow } from '@/components/wallet/send/SendFlow/SendFlow'
import { PayRequestFlow } from '@/components/wallet/send/PayRequestFlow/PayRequestFlow'
import { ProfileScreen } from '@/components/wallet/profile/ProfileScreen/ProfileScreen'
import { AddContactSheet } from '@/components/wallet/people/AddContactSheet/AddContactSheet'
import { NotificationsPanel } from '@/components/wallet/shell/NotificationsPanel/NotificationsPanel'
import { SettlementToast } from '@/components/wallet/shell/SettlementToast/SettlementToast'

/**
 * The wallet app shell: switches between tab screens, the send/request flow, and the detail sheet, reporting the active screen via `onFlowChange`.
 * @param {object} props
 * @param {{name: string, email: string, seed: string, bg: string, sub: string}} props.user - The authenticated identity.
 * @param {() => void} props.onSignOut
 * @param {(flow: string) => void} [props.onFlowChange] - Called whenever the active screen changes.
 * @param {boolean} [props.isOnline] - Whether the simulated connection is up.
 */
export function WalletApp({ user, onSignOut, onFlowChange, isOnline = true }) {
  const [tab, setTab] = useState('home')
  const [detail, setDetail] = useState(null)
  const [sendContact, setSendContact] = useState(null)
  const [isSendOpen, setIsSendOpen] = useState(false)
  const [sendMode, setSendMode] = useState('send')
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isAddContactOpen, setIsAddContactOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [payRequestNotification, setPayRequestNotification] = useState(null)
  // Reset each time WalletApp mounts (i.e. each authentication), so the Home
  // aurora intro plays once per login, not on every return to the Home tab.
  const heroIntroPlayedRef = useRef(false)

  let flow
  if (isSendOpen || payRequestNotification) {
    flow = sendMode === 'request' && !payRequestNotification ? 'request' : 'send'
  } else if (detail) {
    flow = 'transaction'
  } else {
    flow = tab
  }

  useEffect(() => {
    onFlowChange?.(flow)
  }, [flow, onFlowChange])

  const handleOpenSend = useCallback((mode, contact = null) => {
    setSendMode(mode)
    setSendContact(contact)
    setIsSendOpen(true)
  }, [])

  const handleCloseSend = useCallback(() => {
    setIsSendOpen(false)
    setSendContact(null)
    setSendMode('send')
    setTab('home')
  }, [])

  const handleHeroIntroPlayed = useCallback(() => {
    heroIntroPlayedRef.current = true
  }, [])

  return (
    <WalletDataProvider isOnline={isOnline} ownerKey={user?.sub}>
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-muted">
        {!isSendOpen && !payRequestNotification && (
          <>
            {/* Home has its own gradient hero (with the profile menu). Activity /
                People / Chat stand on their own titles, no top bar. */}
            {tab === 'ai' ? (
              <AiTab user={user} />
            ) : (
              <div
                data-tour-target="wallet-scroll"
                className="no-scrollbar flex-1 overflow-y-auto overflow-x-hidden overscroll-none pb-24"
              >
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
        {payRequestNotification && (
          <PayRequestFlow
            notification={payRequestNotification}
            isOnline={isOnline}
            onClose={() => setPayRequestNotification(null)}
          />
        )}
        {detail && <TxDetail tx={detail} onClose={() => setDetail(null)} />}
        {isAddContactOpen && <AddContactSheet onClose={() => setIsAddContactOpen(false)} />}
        {isNotificationsOpen && (
          <NotificationsPanel
            onPayRequest={setPayRequestNotification}
            onClose={() => setIsNotificationsOpen(false)}
          />
        )}
        {isProfileOpen && (
          <div className="absolute inset-0 z-40">
            <ProfileScreen user={user} onClose={() => setIsProfileOpen(false)} onSignOut={onSignOut} />
          </div>
        )}
        {/* Last, so it layers over whichever screen or sheet is open. */}
        <SettlementToast />
      </div>
    </WalletDataProvider>
  )
}
