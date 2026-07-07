'use client'

import { useEffect, useState } from 'react'
import { APP_USERS } from '@/lib/wallet-data'
import { WalletHeader } from '@/components/wallet/shell/WalletHeader/WalletHeader'
import { BottomNav } from '@/components/wallet/shell/BottomNav/BottomNav'
import { HomeTab } from '@/components/wallet/home/HomeTab/HomeTab'
import { ActivityTab } from '@/components/wallet/activity/ActivityTab/ActivityTab'
import { PeopleTab } from '@/components/wallet/people/PeopleTab/PeopleTab'
import { AiTab } from '@/components/wallet/assistant/AiTab/AiTab'
import { TxDetail } from '@/components/wallet/transactions/TxDetail/TxDetail'
import { SendFlow } from '@/components/wallet/send/SendFlow/SendFlow'

/**
 * The wallet app shell: switches between the tab bar screens, the send/request
 * flow, and the transaction detail sheet, and reports the active screen up to
 * the presenter stage via `onFlowChange`.
 * @param {object} props
 * @param {() => void} props.onSignOut
 * @param {(flow: string) => void} [props.onFlowChange] - Called whenever the active screen changes.
 * @param {boolean} [props.isOnline] - Whether the simulated connection is up.
 */
export function WalletApp({ onSignOut, onFlowChange, isOnline = true }) {
  const [user] = useState(APP_USERS[0])
  const [tab, setTab] = useState('home')
  const [detail, setDetail] = useState(null)
  const [sendContact, setSendContact] = useState(null)
  const [isSendOpen, setIsSendOpen] = useState(false)
  const [sendMode, setSendMode] = useState('send')

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

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-background">
      {!isSendOpen && (
        <>
          <WalletHeader user={user} onSignOut={onSignOut} />

          {tab === 'ai' ? (
            <AiTab />
          ) : (
            <div className="no-scrollbar flex-1 overflow-y-auto pb-24">
              {tab === 'home' && (
                <HomeTab
                  onSetTab={setTab}
                  onDetail={setDetail}
                  onSend={() => handleOpenSend('send')}
                  onRequest={() => handleOpenSend('request')}
                />
              )}
              {tab === 'activity' && <ActivityTab onDetail={setDetail} />}
              {tab === 'people' && <PeopleTab onSendTo={(c) => handleOpenSend('send', c)} />}
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
    </div>
  )
}
