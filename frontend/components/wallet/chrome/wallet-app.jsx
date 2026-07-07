'use client'

import { useEffect, useState } from 'react'
import { APP_USERS } from '@/lib/wallet-data'
import { WalletHeader } from '@/components/wallet/chrome/wallet-header'
import { BottomNav } from '@/components/wallet/chrome/bottom-nav'
import { HomeTab } from '@/components/wallet/home/home-tab'
import { ActivityTab } from '@/components/wallet/activity/activity-tab'
import { PeopleTab } from '@/components/wallet/people/people-tab'
import { AiTab } from '@/components/wallet/assistant/ai-tab'
import { TxDetail } from '@/components/wallet/transactions/tx-detail'
import { SendFlow } from '@/components/wallet/send/send-flow'

export function WalletApp({ onSignOut, onFlowChange, online = true }) {
  const [user] = useState(APP_USERS[0])
  const [tab, setTab] = useState('home')
  const [detail, setDetail] = useState(null)
  const [sendContact, setSendContact] = useState(null)
  const [sendOpen, setSendOpen] = useState(false)
  const [sendMode, setSendMode] = useState('send')

  const isInSend = sendOpen || tab === 'send'
  const flow = isInSend
    ? sendMode === 'request' ? 'request' : 'send'
    : detail
      ? 'transaction'
      : tab

  useEffect(() => {
    onFlowChange?.(flow)
  }, [flow, onFlowChange])

  function openSend(mode, contact = null) {
    setSendMode(mode)
    setSendContact(contact)
    setSendOpen(true)
  }

  function closeSend() {
    setSendOpen(false)
    setSendContact(null)
    setSendMode('send')
    setTab('home')
  }

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-background">
      {!isInSend && (
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
                  onSend={() => openSend('send')}
                  onRequest={() => openSend('request')}
                />
              )}
              {tab === 'activity' && <ActivityTab onDetail={setDetail} />}
              {tab === 'people' && <PeopleTab onSendTo={(c) => openSend('send', c)} />}
            </div>
          )}

          <BottomNav tab={tab} setTab={setTab} />
        </>
      )}

      {isInSend && (
        <SendFlow
          initialContact={sendContact || undefined}
          initialMode={sendMode}
          online={online}
          onClose={closeSend}
        />
      )}
      {detail && <TxDetail tx={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}
