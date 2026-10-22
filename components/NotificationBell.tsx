'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Menu, MenuLink, MenuDivider } from '@/components/ui/Menu'
import { NOTICES_READ_EVENT } from '@/lib/events'

/**
 * Everything waiting on you, in one place: grades back from WAPC, cards back
 * from the cleaners, market activity, the latest market announcement, and
 * token bonuses from the admins.
 * Replaces the count on the VVM tab and the announcement banner.
 */
export type MemberNotice = { id: number; kind: string; amount: number | null; message: string | null; created_at: string }

export default function NotificationBell({ grades, cleans, marketUnread, announcement, notices }: {
  grades: number
  cleans: number
  marketUnread: number
  announcement: { id: number; message: string } | null
  notices: MemberNotice[]
}) {
  const router = useRouter()
  const [news, setNews] = useState(announcement)
  const [unread, setUnread] = useState(marketUnread)
  useEffect(() => { setNews(announcement) }, [announcement])
  useEffect(() => { setUnread(marketUnread) }, [marketUnread])
  // Bonuses are marked read as soon as the bell opens, but stay on screen
  // until it closes; the refresh then drops them.
  const marked = useRef(false)
  function onOpenChange(open: boolean) {
    if (open && notices.length && !marked.current) {
      marked.current = true
      createClient().from('member_notices').update({ read_at: new Date().toISOString() })
        .in('id', notices.map((n) => n.id))
        .then(() => {})
    } else if (!open && marked.current) {
      marked.current = false
      router.refresh()
    }
  }
  // The market panel marks notices read when it's opened.
  useEffect(() => {
    const read = () => { setUnread(0); setNews(null) }
    window.addEventListener(NOTICES_READ_EVENT, read)
    return () => window.removeEventListener(NOTICES_READ_EVENT, read)
  }, [])

  const total = grades + cleans + unread + (news ? 1 : 0) + notices.length

  function markNewsRead() {
    if (!news) return
    const id = news.id
    setNews(null)
    createClient().from('market_notices').update({ read_at: new Date().toISOString() }).eq('id', id)
      .then(() => router.refresh())
  }

  return (
    <Menu label={total ? `Notifications, ${total} new` : 'Notifications'} onOpenChange={onOpenChange}
      trigger={() => (
        <>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
          {total > 0 && (
            <span className="absolute top-1 right-1 min-w-[1.05rem] h-[1.05rem] px-1 rounded-full bg-signal text-white font-mono text-[10px] font-bold leading-[1.05rem] text-center ring-2 ring-[var(--surface-strong)]">
              {total > 9 ? '9+' : total}
            </span>
          )}
        </>
      )}>
      {(close) => (
        <>
          <p className="px-3 pt-2 pb-1 font-display font-semibold text-sm">Notifications</p>
          {total === 0 && <p className="px-3 pb-3 pt-1 text-sm text-muted">You&apos;re all caught up.</p>}
          {news && (
            <div className="mx-1.5 my-1 rounded-xl border border-signal/40 bg-signal/10 p-3 text-sm">
              <p className="text-[10px] font-bold tracking-wide text-signal">MARKET NEWS</p>
              <p className="mt-1 leading-snug">{news.message}</p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => { markNewsRead(); close(); router.push('/market') }}
                  className="min-h-9 px-3 rounded-lg bg-signal text-white text-xs font-semibold">Open the market</button>
                <button type="button" onClick={markNewsRead} className="min-h-9 px-3 rounded-lg text-xs font-medium text-muted hover:text-ink">Dismiss</button>
              </div>
            </div>
          )}
          {notices.map((n) => {
            const amt = n.amount ?? 0
            const shown = Number.isInteger(amt) ? amt : amt.toFixed(2)
            return (
              <MenuLink key={n.id} href="/vending" onSelect={close} icon={<span className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-200 to-amber-500 ring-1 ring-amber-600/50" />}>
                {`You got ${shown} bonus token${amt === 1 ? '' : 's'}`}
                <span className="block text-xs text-muted">{n.message ?? 'From the admins'}</span>
              </MenuLink>
            )
          })}
          {grades > 0 && (
            <MenuLink href="/collection#graders" onSelect={close} icon={<span className="w-5 h-5 rounded-full bg-amber-400 text-[#0E1726] text-[11px] font-black flex items-center justify-center">?</span>}>
              {grades === 1 ? 'A grade is back from WAPC' : `${grades} grades are back from WAPC`}
              <span className="block text-xs text-muted">Sealed and waiting to be ripped open</span>
            </MenuLink>
          )}
          {cleans > 0 && (
            <MenuLink href="/collection#cleaners" onSelect={close} icon={<span className="w-5 h-5 rounded-full bg-sky-400 text-[#0E1726] text-[11px] font-bold flex items-center justify-center">✦</span>}>
              {cleans === 1 ? 'A card is back from the cleaners' : `${cleans} cards are back from the cleaners`}
              <span className="block text-xs text-muted">See how they came out</span>
            </MenuLink>
          )}
          {unread > 0 && (
            <MenuLink href="/market" onSelect={close} icon={<span className="w-5 h-5 rounded-full bg-signal text-white text-[10px] font-bold flex items-center justify-center">{unread > 9 ? '9+' : unread}</span>}>
              {unread === 1 ? 'A market update' : `${unread} market updates`}
              <span className="block text-xs text-muted">Sales, bids and outbids</span>
            </MenuLink>
          )}
          {total > 0 && <MenuDivider />}
          <p className="px-3 pb-2 pt-1 text-[11px] text-muted">Grades, cleaning, the market and bonuses post here as they happen.</p>
        </>
      )}
    </Menu>
  )
}
