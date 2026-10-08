'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmt, money, num } from './tokens'

interface Notice {
  id: number
  listing_id: number | null
  kind: 'sold' | 'bought' | 'outbid' | 'expired'
  amount: number | null
  fee: number | null
  other_name: string | null
  item_name: string | null
  preview_image: string | null
  created_at: string
  unread: boolean
}

interface Activity {
  at: string
  kind: 'listed' | 'bid' | 'sold'
  listing_id: number
  actor: string
  amount: number | null
  item_name: string | null
  preview_image: string | null
  item_count: number
}

/** "now", "6m", "3h", "2d" - the feed never needs a date. */
function ago(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function label(n: Notice): string {
  const what = n.item_name ?? 'your listing'
  const who = n.other_name ?? 'someone'
  switch (n.kind) {
    case 'sold':
      return `${what} sold to ${who} for ${fmt(n.amount ?? 0)}.`
    case 'bought':
      return `You bought ${what} from ${who} for ${fmt(n.amount ?? 0)}.`
    case 'outbid':
      return `${who} outbid you on ${what} at ${fmt(n.amount ?? 0)}. Your tokens are back.`
    case 'expired':
      return `${what} ended without a sale and is back in your collection.`
  }
}

/**
 * Your own market mail: sales, purchases, refunded bids.
 *
 * Marked read on sight, which is what clears the badge on the Market tab.
 * Read notices stay listed for a while rather than vanishing, so a sale you
 * glanced at on the way past is still there when you come back for the
 * numbers.
 */
export function MarketNotices({ onRead }: { onRead?: () => void }) {
  const [notices, setNotices] = useState<Notice[] | null>(null)
  const marked = useRef(false)
  // Held in a ref so an inline callback from the parent does not re-run the
  // fetch on every render of the panel above.
  const cb = useRef(onRead)
  cb.current = onRead

  useEffect(() => {
    let alive = true
    const supabase = createClient()
    supabase.rpc('get_market_notices', { p_limit: 12 }).then(({ data }) => {
      if (!alive) return
      const rows = (data as Notice[] | null) ?? []
      setNotices(rows)
      if (rows.some((n) => n.unread) && !marked.current) {
        marked.current = true
        supabase.rpc('mark_market_notices_read').then(() => cb.current?.())
      }
    })
    return () => { alive = false }
  }, [])

  if (notices === null || notices.length === 0) return null

  return (
    <ul className="space-y-1.5">
      {notices.map((n) => (
        <li
          key={n.id}
          className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 ${
            n.unread
              ? 'border-signal/40 bg-signal/5'
              : 'border-card-border bg-card'
          }`}
        >
          {n.preview_image ? (
            <img src={n.preview_image} alt="" loading="lazy"
                 className="w-7 shrink-0 aspect-[245/342] object-contain rounded bg-paper" />
          ) : (
            <div className="w-7 shrink-0 aspect-[245/342] rounded bg-paper" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs leading-snug">{label(n)}</p>
            {/* Sellers get the arithmetic, because the fee is the part that
                is easy to feel cheated by. */}
            {n.kind === 'sold' && n.amount != null && n.fee != null && (
              <p className="font-mono text-[10px] text-muted">
                {fmt(n.amount)} − {fmt(n.fee)} fee = {fmt(money(num(n.amount) - num(n.fee)))} kept
              </p>
            )}
          </div>
          <span className="font-mono text-[9px] text-muted shrink-0">{ago(n.created_at)}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * What the market has been up to lately: listings going up, bids landing,
 * sales closing. One shared stream, so a board with four listings on it still
 * looks like somewhere things happen.
 *
 * This is the one place bidders are named. market_bids is still private at
 * the table level, but a feed that showed sales and not bids would read as a
 * dead market, which was the point of adding it.
 */
export function MarketFeed() {
  const [rows, setRows] = useState<Activity[] | null>(null)

  useEffect(() => {
    let alive = true
    createClient().rpc('get_market_activity', { p_limit: 20 }).then(({ data }) => {
      if (alive) setRows((data as Activity[] | null) ?? [])
    })
    return () => { alive = false }
  }, [])

  return (
    <section className="space-y-2 pt-2 border-t border-card-border">
      <h3 className="font-display font-semibold text-sm">Recent activity</h3>

      {rows === null ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted">Nothing has happened in the market yet.</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((a, i) => (
            <li key={`${a.kind}-${a.listing_id}-${a.at}-${i}`} className="flex items-center gap-2">
              {a.preview_image ? (
                <img src={a.preview_image} alt="" loading="lazy"
                     className="w-5 shrink-0 aspect-[245/342] object-contain rounded bg-paper" />
              ) : (
                <div className="w-5 shrink-0 aspect-[245/342] rounded bg-paper" />
              )}
              <p className="min-w-0 flex-1 text-xs truncate">
                <span className="font-medium">{a.actor}</span>
                <span className="text-muted">
                  {a.kind === 'listed' ? ' listed ' : a.kind === 'bid' ? ' bid on ' : ' bought '}
                </span>
                {a.item_name ?? 'a bundle'}
                {a.item_count > 1 && (
                  <span className="text-muted"> +{a.item_count - 1}</span>
                )}
              </p>
              {a.amount != null && (
                <span className={`font-mono text-[10px] shrink-0 ${
                  a.kind === 'sold' ? 'text-emerald-500' : 'text-muted'
                }`}>
                  {fmt(a.amount)}
                </span>
              )}
              <span className="font-mono text-[9px] text-muted shrink-0 w-7 text-right">
                {ago(a.at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
