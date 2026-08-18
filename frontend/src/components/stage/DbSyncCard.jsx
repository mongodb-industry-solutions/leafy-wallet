'use client'

import { useCallback, useEffect, useState } from 'react'
import Icon from '@leafygreen-ui/icon'
import { Smartphone } from 'lucide-react'
import { getDbSyncSnapshot } from '@/lib/wallet/actions'

const POLL_MS = 3000

// Matches QUEUE_COLLECTION in lib/wallet/actions: the device-only box Sync never carries up.
const QUEUE_COLLECTION = 'pendingSends'

const STATUS_TONE = {
  settled: 'bg-secondary/15 text-secondary',
  pending: 'bg-amber-500/15 text-amber-600',
  queued: 'bg-amber-500/15 text-amber-600',
  failed: 'bg-red-500/15 text-red-600',
  exception: 'bg-red-500/15 text-red-600',
}

/** True if `next` would be a step backwards in time relative to `prev` (see refresh() below). */
function isOlder(next, prev) {
  if (!next) return Boolean(prev)
  if (!prev) return false
  return new Date(next.createdAt ?? 0) < new Date(prev.createdAt ?? 0)
}

/** One `key: value` line of the document preview, monospaced so both panels line up. */
function Field({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3 font-mono text-xs">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="truncate font-semibold text-foreground">{value}</span>
    </div>
  )
}

/**
 * One store's newest transaction document, reduced to the fields that matter for the sync story. A
 * null `doc` renders the "nothing here yet" state Atlas shows while the newest send is still queued.
 * The document names its own collection, since on the device it can come from the offline queue.
 */
function DocPanel({ title, subtitle, icon, doc, accent, emptyLabel = 'no document yet' }) {
  const status = doc?.status ?? 'pending'
  return (
    <div className="rounded-2xl border border-border bg-foreground/[0.02] p-4">
      <div className="flex items-center gap-2">
        <span className={`grid size-6 place-items-center rounded-md ${accent}`}>{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold leading-tight text-foreground">{title}</p>
          <p className="truncate font-mono text-[10px] text-muted-foreground">{doc?.collection ?? subtitle}</p>
        </div>
        {doc && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_TONE[status] ?? STATUS_TONE.pending}`}>
            {status}
          </span>
        )}
      </div>

      {doc ? (
        <div className="mt-3 space-y-1.5">
          <Field label="_id" value={doc.id.slice(-12)} />
          <Field label="amount" value={`${doc.amount.toFixed(2)} ${doc.currency}`} />
          <Field label="note" value={doc.note ?? 'null'} />
          <Field label="noteEmbedding" value={doc.embeddingDims ? `${doc.embeddingDims} dims` : 'none'} />
          <Field label="localSyncStatus" value={doc.syncStatus} />
        </div>
      ) : (
        <p className="mt-3 font-mono text-xs text-muted-foreground">{emptyLabel}</p>
      )}
    </div>
  )
}

/**
 * Back face of the info card: the newest document in Atlas and on the device, polled so the divergence
 * shows live. Offline the device row appears first; Atlas catches up once the send is replayed.
 */
export function DbSyncCard() {
  const [snapshot, setSnapshot] = useState({ atlas: null, local: null })

  const refresh = useCallback(() => {
    getDbSyncSnapshot()
      .then((next) => {
        // ObjectBox Sync reconciles a locally-created object's ID against the server on reconnect
        // by deleting the old id and re-inserting under a new one; the two aren't atomic from a
        // reader's perspective, so a poll landing in that gap sees the object gone and "newest"
        // falls back to the previous (already-settled) transaction. Never step backwards in time.
        setSnapshot((prev) => ({
          atlas: isOlder(next.atlas, prev.atlas) ? prev.atlas : next.atlas,
          local: isOlder(next.local, prev.local) ? prev.local : next.local,
        }))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, POLL_MS)
    return () => clearInterval(id)
  }, [refresh])

  const isQueued = snapshot.local?.collection === QUEUE_COLLECTION

  return (
    <div className="space-y-3">
      <p className="text-[13px] leading-relaxed text-muted-foreground pb-1">
        Newest transaction document in each store.
      </p>
      <DocPanel
        title="Atlas"
        subtitle="walletTransactions"
        accent="bg-secondary/15 text-secondary"
        icon={<Icon glyph="Cloud" size={14} />}
        doc={snapshot.atlas}
        emptyLabel="waiting for a settled transfer"
      />
      <div
        className={`flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide ${
          isQueued ? 'text-muted-foreground/40' : 'text-muted-foreground'
        }`}
      >
        <Icon glyph="ArrowUp" size={12} />
        {isQueued ? 'ObjectBox Sync paused' : 'ObjectBox Sync'}
        <Icon glyph="ArrowDown" size={12} />
      </div>
      <DocPanel
        title="ObjectBox"
        subtitle="on-device store"
        accent="bg-foreground/10 text-foreground"
        icon={<Smartphone className="size-3.5" />}
        doc={snapshot.local}
      />
    </div>
  )
}
