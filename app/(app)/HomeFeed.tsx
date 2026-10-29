'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'

/** One row of v74's home_feed. */
export type FeedItem = {
  ref: string
  kind: string
  at: string
  actor_id: string | null
  actor_name: string | null
  actor_icon: string | null
  actor_color: string | null
  title: string
  detail: string | null
  image_url: string | null
  href: string
  big: boolean
  fav: boolean
  fire: number
  thumbs: number
  my_fire: boolean
  my_thumbs: boolean
}

/** One row of v74's home_highlights. `at` is when an auction ends, otherwise when it happened. */
export type Highlight = {
  kind: 'ending' | 'hit' | 'pull'
  ref: string
  at: string
  title: string
  detail: string | null
  image_url: string | null
  href: string
  fav: boolean
}

type Filter = 'all' | 'timers' | 'pulls' | 'market' | 'community' | 'mine'

const FILTERS: { id: Filter; label: string; kinds?: string[] }[] = [
  { id: 'all', label: 'All' },
  { id: 'timers', label: 'Timers', kinds: ['timer', 'comment'] },
  { id: 'pulls', label: 'Pulls', kinds: ['pull', 'grade', 'showcase'] },
  { id: 'market', label: 'Market', kinds: ['listing', 'sale'] },
  { id: 'community', label: 'Community', kinds: ['badge', 'member', 'interest'] },
  { id: 'mine', label: '★ My machines' },
]

const PAGE = 40
const REFRESH_MS = 60_000

// Cards from the VVM are portrait; everything else is a square product shot.
const PORTRAIT = new Set(['pull', 'grade', 'showcase'])

const KIND_ICON: Record<string, string> = {
  timer: '✅', pull: '✨', grade: '🏅', listing: '🏷️', sale: '💰', badge: '🎖️',
  interest: '📋', member: '👋', comment: '💬', showcase: '🖼️',
}

function ago(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d === 1 ? 'yesterday' : `${d}d ago`
}

function endsIn(iso: string, now: number): string {
  const m = Math.max(0, Math.round((new Date(iso).getTime() - now) / 60000))
  if (m < 1) return 'ending now'
  if (m < 60) return `ends in ${m}m`
  return `ends in ${Math.floor(m / 60)}h ${m % 60}m`
}

export default function HomeFeed({ initialItems, initialHighlights }: { initialItems: FeedItem[]; initialHighlights: Highlight[] }) {
  const [items, setItems] = useState(initialItems)
  const [highlights, setHighlights] = useState(initialHighlights)
  const [filter, setFilter] = useState<Filter>('all')
  const [loadingMore, setLoadingMore] = useState(false)
  const [done, setDone] = useState(initialItems.length < PAGE)
  const [now, setNow] = useState(() => Date.now())
  const toast = useToast()
  const pending = useRef(new Set<string>())

  // Refresh the newest page and the strip every minute while the tab is
  // visible, and straight away when it comes back into view. Older pages the
  // member has scrolled to are kept.
  const refresh = useCallback(async () => {
    const supabase = createClient()
    const [{ data: fresh }, { data: hl }] = await Promise.all([
      supabase.rpc('home_feed', { p_before: null, p_limit: PAGE }),
      supabase.rpc('home_highlights'),
    ])
    setNow(Date.now())
    if (hl) setHighlights(hl as Highlight[])
    if (!fresh) return
    setItems((prev) => {
      const head = fresh as FeedItem[]
      const oldest = head.length ? head[head.length - 1].at : null
      const seen = new Set(head.map((i) => i.ref))
      const tail = oldest ? prev.filter((i) => i.at < oldest && !seen.has(i.ref)) : prev
      return [...head, ...tail]
    })
  }, [])

  useEffect(() => {
    const tick = setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, REFRESH_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(tick)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  async function loadMore() {
    const last = items[items.length - 1]
    if (!last || loadingMore) return
    setLoadingMore(true)
    const { data } = await createClient().rpc('home_feed', { p_before: last.at, p_limit: PAGE })
    const more = (data as FeedItem[] | null) ?? []
    setItems((prev) => {
      const seen = new Set(prev.map((i) => i.ref))
      return [...prev, ...more.filter((i) => !seen.has(i.ref))]
    })
    if (more.length < PAGE) setDone(true)
    setLoadingMore(false)
  }

  async function react(item: FeedItem, emoji: 'fire' | 'thumbs') {
    const key = `${item.ref}|${emoji}`
    if (pending.current.has(key)) return
    pending.current.add(key)
    const mineKey = emoji === 'fire' ? 'my_fire' : 'my_thumbs'
    const on = !item[mineKey]
    const flip = (i: FeedItem): FeedItem =>
      i.ref !== item.ref ? i : { ...i, [mineKey]: on, [emoji]: Math.max(0, i[emoji] + (on ? 1 : -1)) }
    setItems((prev) => prev.map(flip))

    const supabase = createClient()
    const { error } = on
      ? await supabase.from('feed_reactions').insert({ ref: item.ref, emoji })
      : await supabase.from('feed_reactions').delete().match({ ref: item.ref, emoji })
    if (error) {
      // Put it back the way it was.
      setItems((prev) => prev.map((i) => (i.ref !== item.ref ? i : { ...i, [mineKey]: !on, [emoji]: Math.max(0, i[emoji] + (on ? -1 : 1)) })))
      toast.error('Could not save that reaction.')
    }
    pending.current.delete(key)
  }

  const shown = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter)!
    if (filter === 'mine') return items.filter((i) => i.fav)
    return f.kinds ? items.filter((i) => f.kinds!.includes(i.kind)) : items
  }, [items, filter])

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="font-display font-bold text-lg">Home</h1>
        <span className="font-mono text-[10px] text-muted">updates every minute</span>
      </div>

      {highlights.length > 0 && (
        <section aria-label="Happening now" className="space-y-2">
          <h2 className="px-1 text-[11px] font-bold tracking-wide text-muted uppercase">Happening now</h2>
          <div className="-mx-4 px-4 flex gap-3 overflow-x-auto snap-x pb-1">
            {highlights.map((h) => (
              <Link key={h.ref} href={h.href}
                className="snap-start shrink-0 w-56 bg-card border border-card-border rounded-2xl p-3 flex gap-3 items-center hover:border-signal/40 transition-colors">
                {h.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={h.image_url} alt="" className="w-11 h-14 object-contain shrink-0" />
                ) : (
                  <span className="w-11 h-14 shrink-0 flex items-center justify-center text-2xl" aria-hidden>
                    {h.kind === 'hit' ? '✅' : h.kind === 'ending' ? '⏳' : '✨'}
                  </span>
                )}
                <div className="min-w-0 space-y-0.5">
                  <p className="font-mono text-[10px] uppercase tracking-wide text-signal">
                    {h.kind === 'ending' ? endsIn(h.at, now) : h.kind === 'hit' ? (h.fav ? '★ Your machine' : 'Machine hit') : 'Big pull'}
                  </p>
                  <p className="text-sm font-semibold leading-snug line-clamp-2">{h.title}</p>
                  {h.detail && <p className="text-xs text-muted truncate">{h.detail}</p>}
                  {h.kind !== 'ending' && <p className="font-mono text-[10px] text-muted">{ago(h.at, now)}</p>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1" role="tablist" aria-label="Show">
        {FILTERS.map((f) => (
          <button key={f.id} role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filter === f.id ? 'bg-ink text-white' : 'bg-card border border-card-border text-muted hover:text-ink'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-muted px-1">
          {filter === 'mine'
            ? 'Nothing on your favourite machines yet. Star machines on the Timers page to see them here.'
            : 'Nothing here yet.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {shown.map((item) => (
            <FeedRow key={item.ref} item={item} now={now} onReact={react} />
          ))}
        </ul>
      )}

      {!done && filter === 'all' && (
        <button onClick={loadMore} disabled={loadingMore}
          className="w-full text-sm font-medium text-muted border border-card-border rounded-xl py-2.5 hover:text-ink hover:border-ink/20 transition-colors disabled:opacity-50">
          {loadingMore ? 'Loading…' : 'Show older'}
        </button>
      )}
      {!done && filter !== 'all' && (
        <button onClick={loadMore} disabled={loadingMore}
          className="w-full text-xs text-muted py-2 hover:text-ink transition-colors disabled:opacity-50">
          {loadingMore ? 'Loading…' : 'Look further back'}
        </button>
      )}
    </div>
  )
}

function FeedRow({ item, now, onReact }: { item: FeedItem; now: number; onReact: (i: FeedItem, e: 'fire' | 'thumbs') => void }) {
  const portrait = PORTRAIT.has(item.kind)
  return (
    <li className={`rounded-xl border px-3 py-3 ${
      item.big
        ? 'bg-gradient-to-br from-signal/10 via-card to-card border-signal/40'
        : item.fav ? 'bg-card border-signal/30' : 'bg-card border-card-border'
    }`}>
      <div className="flex items-start gap-3">
        <Link href={item.actor_id ? `/members/${item.actor_id}` : item.href} className="shrink-0" aria-hidden tabIndex={-1}>
          {item.actor_icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/Trainers/${item.actor_icon}`} alt="" className="w-9 h-9 rounded-full object-contain bg-paper" />
          ) : item.actor_name ? (
            <span className="w-9 h-9 rounded-full bg-paper border border-card-border flex items-center justify-center text-sm font-semibold text-muted">
              {item.actor_name.slice(0, 1).toUpperCase()}
            </span>
          ) : (
            <span className="w-9 h-9 rounded-full bg-paper border border-card-border flex items-center justify-center text-base">
              {KIND_ICON[item.kind] ?? '•'}
            </span>
          )}
        </Link>

        <Link href={item.href} className="min-w-0 flex-1 space-y-0.5">
          <p className="text-sm leading-snug">
            {item.actor_name && (
              <span className="font-semibold" style={item.actor_color ? { color: item.actor_color } : undefined}>
                {item.actor_name}{' '}
              </span>
            )}
            <span className={item.actor_name ? '' : 'font-semibold'}>{item.title}</span>
          </p>
          {item.detail && <p className="text-xs text-muted line-clamp-2">{item.detail}</p>}
          <p className="font-mono text-[10px] text-muted">
            {KIND_ICON[item.kind] && item.actor_name ? `${KIND_ICON[item.kind]} ` : ''}
            {ago(item.at, now)}
            {item.fav && <span className="text-signal"> · ★ your machine</span>}
          </p>
        </Link>

        {item.image_url && (
          <Link href={item.href} className="shrink-0" tabIndex={-1} aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.image_url} alt="" loading="lazy"
              className={`${portrait ? (item.big ? 'w-16 h-[5.5rem]' : 'w-11 h-[3.9rem]') : 'w-12 h-12'} object-contain rounded-md ${portrait ? '' : 'bg-white border border-card-border'}`} />
          </Link>
        )}
      </div>

      <div className="flex gap-1.5 mt-2 pl-12">
        <ReactButton on={item.my_fire} count={item.fire} label="🔥" name="Fire" onClick={() => onReact(item, 'fire')} />
        <ReactButton on={item.my_thumbs} count={item.thumbs} label="👍" name="Thumbs up" onClick={() => onReact(item, 'thumbs')} />
      </div>
    </li>
  )
}

function ReactButton({ on, count, label, name, onClick }: { on: boolean; count: number; label: string; name: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} aria-label={`${name}${count ? `, ${count}` : ''}`}
      className={`min-h-7 px-2 rounded-full border text-xs flex items-center gap-1 transition-colors ${
        on ? 'border-signal/50 bg-signal/10 text-ink' : 'border-card-border text-muted hover:text-ink hover:border-ink/20'
      }`}>
      <span aria-hidden>{label}</span>
      {count > 0 && <span className="font-mono text-[10px]">{count}</span>}
    </button>
  )
}
