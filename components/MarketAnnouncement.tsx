'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

/** Fired by the market's notice list once it has marked everything read. */
export const NOTICES_READ_EVENT = 'market-notices-read'

/**
 * News about the market, shown across the app until it is seen.
 *
 * It is an ordinary market notice underneath, so opening the Market (which
 * marks notices read) is what retires it. The cross only marks this one
 * notice read, leaving any unread sales or outbids alone.
 */
export default function MarketAnnouncement({ id, message }: { id: number; message: string }) {
  const [gone, setGone] = useState(false)

  useEffect(() => {
    const hide = () => setGone(true)
    window.addEventListener(NOTICES_READ_EVENT, hide)
    return () => window.removeEventListener(NOTICES_READ_EVENT, hide)
  }, [])

  if (gone) return null

  function dismiss() {
    setGone(true)
    createClient()
      .from('market_notices')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .then(() => {})
  }

  return (
    <div className="max-w-lg mx-auto w-full px-4 pt-3">
      <div className="flex items-stretch rounded-xl border border-signal/40 bg-signal/10 overflow-hidden">
        <Link
          href="/vending?view=market"
          onClick={() => setGone(true)}
          className="flex-1 min-w-0 flex items-center gap-2.5 px-3 py-2 hover:bg-signal/10 transition-colors"
        >
          <span className="shrink-0 rounded-md bg-signal text-white text-[9px] font-bold tracking-wide px-1.5 py-0.5">
            NEW
          </span>
          <span className="min-w-0 flex-1 text-xs leading-snug text-ink">{message}</span>
          <span className="shrink-0 text-xs font-semibold text-signal">Market →</span>
        </Link>
        <button
          onClick={dismiss}
          className="shrink-0 px-2.5 text-muted hover:text-ink transition-colors"
          aria-label="Dismiss"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  )
}
