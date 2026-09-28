'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import CollectionPanel, { type UnopenedPack, type CollectionCard, type SetTotal, type OwnedTicket } from './CollectionPanel'

/**
 * Colours inside the machine screen are deliberately fixed rather than theme
 * tokens. The screen emulates a physical LCD, so it stays light in dark mode;
 * using `text-ink` here made controls invisible against the permanently-light
 * tiles once the theme flipped.
 */
const SCREEN_INK = '#0E1726'

interface MachineState {
  status: string
  cycle_no: number
  ends_at: string
  seconds_left: number
  frozen: boolean
  holder_id: string | null
  holder_name: string | null
  holder_expires: string | null
}

/**
 * Stock is offered by set, not by pack art. `display_image_url` is one
 * representative wrapper chosen for this cycle; the wrapper a buyer actually
 * receives is rolled per pack at checkout.
 */
interface StockRow {
  set_code: string
  set_name: string
  display_image_url: string
  quantity: number
  description: string | null
}

/** What the detail popup shows, for either kind of shelf item. */
type ItemDetail = {
  title: string
  subtitle: string
  description: string | null
  image: string | null
  accent: string
  fit: 'contain' | 'cover'
}

/**
 * Raffle tickets share the machine with packs but are priced individually and
 * are rolled into a cycle by rarity rather than by set.
 */
export interface TicketStockRow {
  ticket_id: number
  name: string
  description: string | null
  rarity: string
  image_url: string | null
  token_price: number
  quantity: number
  remaining: number
  /** null = no cap on how many one member may hold. */
  per_user_limit: number | null
  /** How many the signed-in member already holds. */
  owned: number
}

/**
 * Most a member may add right now: limited by what is in the machine, what the
 * raffle has left, and their remaining personal allowance.
 */
function ticketCeiling(t: TicketStockRow): number {
  const personal = t.per_user_limit === null
    ? Number.POSITIVE_INFINITY
    : Math.max(0, t.per_user_limit - t.owned)
  return Math.max(0, Math.min(t.quantity, t.remaining, personal))
}

const TICKET_RARITY_COLOR: Record<string, string> = {
  common: '#6B7280',
  uncommon: '#16A34A',
  rare: '#0EA5E9',
  ultra: '#A855F7',
  legendary: '#F6A609',
}

interface Watcher {
  watcher_id: string
  name: string
  is_holder: boolean
}

export interface RecentBuy {
  buyer: string
  icon_file: string | null
  packs: number
  sets: string
  bought_at: string
}

function agoLabel(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const h = Math.floor(mins / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

interface Props {
  initialState: MachineState | null
  initialStock: StockRow[]
  initialTickets: TicketStockRow[]
  balance: number
  userId: string
  cooldownUntil: string | null
  packs: UnopenedPack[]
  collection: CollectionCard[]
  setTotals: SetTotal[]
  ownedTickets: OwnedTicket[]
  recentBuys: RecentBuy[]
}

function mmss(total: number): string {
  const m = Math.floor(total / 60)
  const s = Math.max(0, total % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function untilLabel(iso: string): string {
  const mins = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60000))
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export default function VendingClient({
  initialState, initialStock, initialTickets, balance, userId, cooldownUntil, packs, collection, setTotals, ownedTickets, recentBuys,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [view, setView] = useState<'machine' | 'collection'>('machine')
  const [buys, setBuys] = useState<RecentBuy[]>(recentBuys)
  const [state, setState] = useState<MachineState | null>(initialState)
  const [stock, setStock] = useState<StockRow[]>(initialStock)
  const [tickets, setTickets] = useState<TicketStockRow[]>(initialTickets)
  const [tokens, setTokens] = useState(balance)
  const [cooldown, setCooldown] = useState<string | null>(cooldownUntil)
  const [secondsLeft, setSecondsLeft] = useState(initialState?.seconds_left ?? 0)
  // Keyed by set_code: you buy "a Base Set pack", not a specific wrapper.
  const [cart, setCart] = useState<Record<string, number>>({})
  // Tickets are priced per item, so they are carted separately from packs.
  const [ticketCart, setTicketCart] = useState<Record<number, number>>({})
  const [holdLeft, setHoldLeft] = useState(0)
  // Tapping an item on the shelf opens this; browsing is allowed even when
  // you are not the one holding the machine.
  const [detail, setDetail] = useState<ItemDetail | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<{ packs: number; tickets: number; restocked: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [watchers, setWatchers] = useState<Watcher[]>([])
  const [notices, setNotices] = useState<{ id: number; text: string }[]>([])
  const fetching = useRef(false)
  const knownWatchers = useRef<Set<string>>(new Set())
  const noticeId = useRef(0)
  const holderRef = useRef(false)

  const iAmHolder = !!state?.holder_id && state.holder_id === userId
  holderRef.current = iAmHolder
  const status = state?.status ?? 'maintenance'
  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0)
  const ticketCount = Object.values(ticketCart).reduce((a, b) => a + b, 0)
  // Packs are always one token; tickets carry their own price.
  const ticketCost = Object.entries(ticketCart).reduce((sum, [id, qty]) => {
    const t = tickets.find((x) => x.ticket_id === Number(id))
    return sum + (t ? t.token_price * qty : 0)
  }, 0)
  const totalCost = cartCount + ticketCost
  const totalItems = cartCount + ticketCount
  const others = watchers.filter((w) => w.watcher_id !== userId)
  const lurkers = others.filter((w) => !w.is_holder)

  function pushNotice(text: string) {
    const id = ++noticeId.current
    setNotices((n) => [...n, { id, text }])
    setTimeout(() => setNotices((n) => n.filter((x) => x.id !== id)), 6000)
  }

  const refresh = useCallback(async () => {
    if (fetching.current) return
    fetching.current = true
    const supabase = createClient()
    const { data } = await supabase.rpc('get_vending_state')
    const next = (Array.isArray(data) ? data[0] : data) as MachineState | null
    if (next) {
      setState(next)
      setSecondsLeft(next.seconds_left)
      if (next.status === 'in_stock' || next.status === 'out_of_stock') {
        const [{ data: s }, { data: t }] = await Promise.all([
          supabase.rpc('get_vending_stock', { p_cycle: next.cycle_no }),
          supabase.rpc('get_vending_ticket_stock', { p_cycle: next.cycle_no }),
        ])
        setStock((s as StockRow[]) ?? [])
        setTickets((t as TicketStockRow[]) ?? [])
      } else {
        setStock([])
        setTickets([])
      }
      if (next.holder_id !== userId) { setCart({}); setTicketCart({}) }
    }
    const { data: b } = await supabase.rpc('vending_recent_buys', { p_limit: 6 })
    if (b) setBuys(b as RecentBuy[])
    fetching.current = false
  }, [userId])

  // Presence. Rides on a plain poll rather than realtime: a stale watcher
  // just ages out, with no connection lifecycle to manage.
  const ping = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.rpc('vending_ping')
    const list = (data as Watcher[]) ?? []
    setWatchers(list)

    // Announce arrivals to whoever is holding the machine - this is the
    // pressure that makes "leave some behind" an actual decision.
    const seen = knownWatchers.current
    for (const w of list) {
      if (w.watcher_id !== userId && !seen.has(w.watcher_id)) {
        if (holderRef.current) pushNotice(`${w.name} is lurking behind you`)
      }
    }
    knownWatchers.current = new Set(list.map((w) => w.watcher_id))
  }, [userId])

  useEffect(() => {
    ping()
    const t = setInterval(ping, 5000)
    return () => clearInterval(t)
  }, [ping])

  useEffect(() => {
    function leave() {
      const supabase = createClient()
      supabase.rpc('vending_unwatch')
      if (holderRef.current) supabase.rpc('vending_release')
    }
    window.addEventListener('pagehide', leave)
    return () => {
      window.removeEventListener('pagehide', leave)
      leave()
    }
  }, [])

  // Cycle clock. Frozen while the machine is held, so it simply stops.
  useEffect(() => {
    if (state?.frozen) return
    if (secondsLeft <= 0) { refresh(); return }
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [secondsLeft, state?.frozen, refresh])

  // Poll harder while someone else holds it, so waiters see it free up.
  useEffect(() => {
    if (!state?.holder_id || iAmHolder) return
    const t = setInterval(refresh, 4000)
    return () => clearInterval(t)
  }, [state?.holder_id, iAmHolder, refresh])

  useEffect(() => {
    if (!iAmHolder || !state?.holder_expires) return
    const tick = setInterval(() => {
      const left = Math.round((new Date(state.holder_expires!).getTime() - Date.now()) / 1000)
      setHoldLeft(Math.max(0, left))
      if (left <= 0) { setCart({}); refresh() }
    }, 500)
    return () => clearInterval(tick)
  }, [iAmHolder, state?.holder_expires, refresh])

  const beat = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.rpc('vending_heartbeat')
    if (data) setState((s) => (s ? { ...s, holder_expires: data as string } : s))
  }, [])

  useEffect(() => {
    function onVisible() { if (document.visibilityState === 'visible') { refresh(); ping() } }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh, ping])

  async function claim() {
    setBusy(true); setMessage(null); setReceipt(null)
    const supabase = createClient()
    const { data } = await supabase.rpc('vending_claim')
    const r = (Array.isArray(data) ? data[0] : data) as
      | { ok: boolean; reason: string; holder_name: string | null; expires_at: string | null }
      | null
    if (r?.ok) {
      await refresh()
      if (lurkers.length > 0) {
        pushNotice(`${lurkers.length} ${lurkers.length === 1 ? 'trainer is' : 'trainers are'} watching you`)
      }
    } else {
      switch (r?.reason) {
        case 'busy': setMessage(`${r.holder_name} beat you to the machine.`); break
        case 'cooldown': setMessage(`You just bought. Back in ${r.expires_at ? untilLabel(r.expires_at) : 'a while'}.`); break
        case 'not_stocked': setMessage('Nothing to buy right now.'); break
        case 'no_tokens': setMessage('You have no tokens left this month.'); break
        case 'empty': setMessage('The machine is cleared out.'); break
        default: setMessage('Could not start a session.')
      }
      await refresh()
    }
    setBusy(false)
  }

  function addToCart(s: StockRow, delta: number) {
    setCart((c) => {
      const cur = c[s.set_code] ?? 0
      const next = Math.min(s.quantity, Math.max(0, cur + delta))
      const copy = { ...c }
      if (next === 0) delete copy[s.set_code]
      else copy[s.set_code] = next
      return copy
    })
    beat()
  }

  function showPackDetail(s: StockRow) {
    setDetail({
      title: s.set_name,
      subtitle: `${s.quantity} in the machine · 1 token each · wrapper varies`,
      description: s.description,
      image: s.display_image_url,
      accent: '#c82030',
      fit: 'contain',
    })
  }

  function showTicketDetail(t: TicketStockRow) {
    const limitNote = t.per_user_limit === null
      ? ''
      : ` · max ${t.per_user_limit} each (you hold ${t.owned})`
    setDetail({
      title: t.name,
      subtitle: `${t.rarity} · ${t.token_price} token${t.token_price === 1 ? '' : 's'} · ${t.remaining} left${limitNote}`,
      description: t.description,
      image: t.image_url,
      accent: TICKET_RARITY_COLOR[t.rarity] ?? TICKET_RARITY_COLOR.common,
      fit: 'cover',
    })
  }

  function addTicketToCart(t: TicketStockRow, delta: number) {
    setTicketCart((c) => {
      const cur = c[t.ticket_id] ?? 0
      const next = Math.min(ticketCeiling(t), Math.max(0, cur + delta))
      const copy = { ...c }
      if (next === 0) delete copy[t.ticket_id]
      else copy[t.ticket_id] = next
      return copy
    })
    beat()
  }

  async function checkout() {
    if (totalItems === 0) return
    setBusy(true); setMessage(null)
    const supabase = createClient()
    const items = Object.entries(cart).map(([set_code, qty]) => ({ set_code, qty }))
    const ticketItems = Object.entries(ticketCart).map(([id, qty]) => ({ ticket_id: Number(id), qty }))
    const { data } = await supabase.rpc('vending_checkout', { p_items: items, p_tickets: ticketItems })
    const r = (Array.isArray(data) ? data[0] : data) as
      | { ok: boolean; reason: string; packs_bought: number; tickets_bought: number; balance: number; restocked: boolean }
      | null
    if (r?.ok) {
      setTokens(r.balance)
      setCart({})
      setTicketCart({})
      setReceipt({ packs: r.packs_bought, tickets: r.tickets_bought ?? 0, restocked: r.restocked })
      // Read the real cooldown back rather than assuming a duration - it is
      // an admin setting and can be anything.
      const { data: me } = await supabase
        .from('profiles').select('vending_cooldown_until').eq('id', userId).single()
      setCooldown(me?.vending_cooldown_until ?? null)
      // The unopened-packs list is a server prop, so without this the packs
      // just bought do not show up in the collection until something else
      // forces a reload.
      startTransition(() => router.refresh())
    } else {
      switch (r?.reason) {
        case 'not_holder': setMessage('Your session timed out.'); break
        case 'insufficient_stock': setMessage('Someone got there first — stock changed.'); break
        case 'insufficient_tokens': setMessage('Not enough tokens.'); break
        case 'ticket_sold_out': setMessage('That raffle ticket just ran out.'); break
        case 'ticket_limit_reached': setMessage('You already hold the maximum of that ticket.'); break
        case 'ticket_unavailable': setMessage('That raffle ticket is no longer available.'); break
        default: setMessage('Checkout failed.')
      }
    }
    await refresh()
    setBusy(false)
  }

  const onCooldown = !!cooldown && new Date(cooldown).getTime() > Date.now()
  const someoneElse = !!state?.holder_id && !iAmHolder

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display font-semibold text-base">Virtual Vending Machine</h1>
        <div className="flex items-center gap-1.5 bg-card border border-card-border rounded-full px-3 py-1">
          <span className="font-mono text-sm font-semibold text-signal">{tokens}</span>
          <span className="text-xs text-muted">{tokens === 1 ? 'token' : 'tokens'}</span>
        </div>
      </div>

      <div className="flex gap-1">
        {(['machine', 'collection'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              view === v ? 'bg-ink text-white' : 'bg-card border border-card-border text-ink hover:border-ink/20'
            }`}
          >
            {v}
            {v === 'collection' && packs.length > 0 && (
              <span className="ml-1.5 font-mono text-[10px] rounded-full bg-signal text-white px-1.5 py-0.5">
                {packs.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {view === 'collection' ? (
        <CollectionPanel packs={packs} collection={collection} setTotals={setTotals} tickets={ownedTickets} />
      ) : (
      <>

      {/* pt-10 leaves room for the crown, which overhangs the cabinet. */}
      <div className="mx-auto w-full max-w-sm pt-10">
        <div className="relative rounded-[2rem] bg-[#f2f2f0] px-3 pb-3 pt-0 shadow-[0_0_0_3px_#ff3b53,0_0_28px_rgba(255,59,83,0.45)]">
          {/* Crown, overhanging the cabinet without being clipped by it. */}
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-10">
            <div className="relative w-20 h-20 rounded-full overflow-hidden border-[3px] border-[#ff3b53] shadow-[0_0_18px_rgba(255,59,83,0.55)] bg-[#f7f7f5]">
              <div className="absolute inset-x-0 top-0 h-1/2 bg-[#e03040]" />
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[3px] bg-black" />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white border-[3px] border-black" />
            </div>
          </div>

          {/* Spacer for the overhanging crown */}
          <div className="h-12" />

          <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-black border-2 border-black">
            {receipt ? (
              <DispensingScreen packs={receipt.packs} restocked={receipt.restocked} />
            ) : status === 'out_of_stock' ? (
              <StockScreen stock={stock} tickets={tickets} soldOut cart={{}} ticketCart={{}} onAdd={() => {}} onAddTicket={() => {}} onInspect={showPackDetail} onInspectTicket={showTicketDetail} interactive={false} />
            ) : status === 'in_stock' ? (
              iAmHolder ? (
                <StockScreen stock={stock} tickets={tickets} soldOut={false} cart={cart} ticketCart={ticketCart} onAdd={addToCart} onAddTicket={addTicketToCart} onInspect={showPackDetail} onInspectTicket={showTicketDetail} interactive />
              ) : (
                <AttractScreen onStart={claim} busy={busy} lockedBy={someoneElse ? state!.holder_name : null} />
              )
            ) : (
              // Everything non-buyable shows maintenance. This also catches a
              // machine still parked on the retired blackout status.
              <MaintenanceScreen />
            )}

            {/* On-screen arrival messages. Sits above the call-to-action so it
                never covers TOUCH TO START. */}
            {notices.length > 0 && (
              <div className="absolute inset-x-0 bottom-14 z-20 px-1.5 space-y-1 pointer-events-none">
                {notices.map((n) => (
                  <div
                    key={n.id}
                    className="rounded bg-black/80 text-white text-[8px] font-semibold tracking-wide px-2 py-1 shadow"
                  >
                    {n.text}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3 h-10 rounded-xl bg-[#111] border-[3px] border-[#ff3b53] shadow-[inset_0_4px_14px_rgba(0,0,0,0.8)]" />
        </div>
      </div>

      {detail && <ItemDetailDialog detail={detail} onClose={() => setDetail(null)} />}

      {message && (
        <p className="mx-auto w-full max-w-sm text-center text-sm font-medium text-signal bg-signal/10 border border-signal/30 rounded-xl px-3 py-2">
          {message}
        </p>
      )}

      {/* Who else is here */}
      {others.length > 0 && (
        <div className="mx-auto w-full max-w-sm flex items-center gap-2 flex-wrap justify-center">
          {others.map((w) => (
            <span
              key={w.watcher_id}
              className={`text-[10px] font-medium rounded-full px-2 py-0.5 border ${
                w.is_holder
                  ? 'border-signal/40 bg-signal/10 text-signal'
                  : 'border-card-border text-muted'
              }`}
            >
              {w.name}{w.is_holder ? ' · at the machine' : ''}
            </span>
          ))}
        </div>
      )}

      {iAmHolder && !receipt && (
        <div className="mx-auto w-full max-w-sm bg-card border border-card-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">
              {totalItems === 0
                ? 'Pick your packs'
                : [
                    cartCount > 0 ? `${cartCount} pack${cartCount === 1 ? '' : 's'}` : null,
                    ticketCount > 0 ? `${ticketCount} ticket${ticketCount === 1 ? '' : 's'}` : null,
                  ].filter(Boolean).join(' + ') + ` · ${totalCost} token${totalCost === 1 ? '' : 's'}`}
            </p>
            <span className={`font-mono text-xs ${holdLeft <= 15 ? 'text-red-500' : 'text-muted'}`}>
              {mmss(holdLeft)} left
            </span>
          </div>

          {lurkers.length > 0 && (
            <p className="text-xs text-signal font-medium">
              {lurkers.length === 1
                ? `${lurkers[0].name} is waiting behind you.`
                : `${lurkers.length} trainers are waiting behind you.`}
            </p>
          )}

          {totalCost > tokens && <p className="text-xs text-red-500">That is more than you can afford.</p>}

          <div className="flex gap-2">
            <button
              onClick={checkout}
              disabled={busy || totalItems === 0 || totalCost > tokens}
              className="flex-1 bg-signal hover:bg-signal/90 disabled:opacity-50 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors"
            >
              Check out
            </button>
            <button
              onClick={async () => { const s = createClient(); await s.rpc('vending_release'); setCart({}); setTicketCart({}); refresh() }}
              className="px-4 border border-card-border rounded-xl text-sm font-medium text-muted hover:text-ink transition-colors"
            >
              Leave
            </button>
          </div>
          <p className="text-[10px] text-muted">
            The machine is yours while you are active. The status clock is paused, so nothing changes under you.
          </p>
        </div>
      )}

      {receipt && (
        <div className="mx-auto w-full max-w-sm bg-card border border-card-border rounded-2xl p-4 space-y-2 text-center">
          <p className="text-sm font-medium">
            Collected{' '}
            {[
              receipt.packs > 0 ? `${receipt.packs} pack${receipt.packs === 1 ? '' : 's'}` : null,
              receipt.tickets > 0 ? `${receipt.tickets} raffle ticket${receipt.tickets === 1 ? '' : 's'}` : null,
            ].filter(Boolean).join(' and ')}.
          </p>
          {receipt.restocked && <p className="text-xs text-signal font-medium">The machine restocked behind you.</p>}
          <p className="text-xs text-muted">
            {cooldown && new Date(cooldown).getTime() > Date.now()
              ? `Back in ${untilLabel(cooldown)}.`
              : 'You can use the machine again now.'}
          </p>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => { setReceipt(null); setView('collection') }}
              className="flex-1 bg-signal hover:bg-signal/90 text-white font-semibold rounded-xl py-2 text-sm transition-colors"
            >
              Open them
            </button>
            <button
              onClick={() => setReceipt(null)}
              className="px-4 border border-card-border rounded-xl text-sm font-medium text-muted hover:text-ink transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {!iAmHolder && !receipt && (
        <div className="mx-auto w-full max-w-sm bg-card border border-card-border rounded-2xl px-4 py-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {someoneElse
                ? `${state!.holder_name} is at the machine`
                : status === 'in_stock' ? `Stocked — ${stock.reduce((n, s) => n + s.quantity, 0)} packs`
                : status === 'out_of_stock' ? 'Sold out'
                : 'Under maintenance'}
            </p>
            <p className="font-mono text-[10px] text-muted">
              {state?.frozen ? 'clock paused' : `changes in ${mmss(secondsLeft)}`} · cycle #{state?.cycle_no ?? '—'}
              {onCooldown && ` · your cooldown ${untilLabel(cooldown!)}`}
            </p>
          </div>
          <button onClick={refresh} className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg border border-card-border hover:border-ink/30 transition-colors">
            Refresh
          </button>
        </div>
      )}

      {/* ── Recent buys ── */}
      <section className="mx-auto w-full max-w-sm space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display font-semibold text-sm">Recent buys</h2>
          <span className="font-mono text-[10px] text-muted">1 token = 1 pack</span>
        </div>
        {buys.length === 0 ? (
          <p className="text-xs text-muted">Nothing bought yet. Be the first.</p>
        ) : (
          <ul className="space-y-1.5">
            {buys.map((b, i) => (
              <li
                key={`${b.bought_at}-${b.buyer}-${i}`}
                className="bg-card border border-card-border rounded-xl px-3 py-2 flex items-center gap-2.5"
              >
                {b.icon_file ? (
                  <img src={`/Trainers/${b.icon_file}`} alt="" className="w-6 h-6 rounded-full object-contain bg-paper shrink-0" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-ink/10 flex items-center justify-center text-[10px] font-bold text-muted shrink-0">
                    {b.buyer.charAt(0).toUpperCase()}
                  </div>
                )}
                <p className="text-xs min-w-0 flex-1 truncate">
                  <span className="font-medium">{b.buyer}</span>
                  <span className="text-muted"> took </span>
                  <span className="font-mono font-semibold text-signal">{b.packs}</span>
                  <span className="text-muted"> from {b.sets}</span>
                </p>
                <span className="font-mono text-[10px] text-muted shrink-0">{agoLabel(b.bought_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      </>
      )}
    </div>
  )
}

/* ────────────────────────────── screens ────────────────────────────── */

const ATTRACT_PACKS = [
  'base-set-charizard', 'jungle-scyther', 'fossil-lapras', 'team-rocket-giovanni',
  'base-set-venusaur', 'fossil-zapdos', 'jungle-flareon', 'team-rocket-dark-gyarados',
  'base-set-blastoise', 'jungle-wigglytuff', 'fossil-aerodactyl', 'team-rocket-jessie-james',
]

function AttractScreen({ onStart, busy, lockedBy }: { onStart: () => void; busy: boolean; lockedBy: string | null }) {
  // Two rows drifting opposite ways, so the tall screen reads as full of
  // product rather than mostly empty sky.
  const rowA = ATTRACT_PACKS.slice(0, 6)
  const rowB = ATTRACT_PACKS.slice(6)
  return (
    <button
      onClick={onStart}
      disabled={busy || !!lockedBy}
      className="absolute inset-0 w-full h-full flex flex-col bg-gradient-to-b from-[#dff1fb] to-[#bfe4f7] focus:outline-none disabled:cursor-not-allowed"
    >
      <div className="px-3 pt-3 shrink-0">
        <div className="rounded bg-[#c82030] text-white text-[9px] font-bold tracking-wide py-0.5">NOTICE</div>
        <p className="mt-1 text-[8px] leading-snug" style={{ color: `${SCREEN_INK}b3` }}>
          One trainer at a time. Collect your packs from the tray before the next person steps up.
        </p>
      </div>

      <div className="relative flex-1 overflow-hidden flex flex-col justify-center gap-2 py-2">
        <DriftRow files={rowA} seconds={22} />
        <DriftRow files={rowB} seconds={28} reverse />
      </div>

      <div className={`m-2 rounded py-2.5 text-center font-extrabold text-sm tracking-wide shadow shrink-0 ${
        lockedBy ? 'bg-black/75 text-white' : 'bg-[#f5c518] animate-pulse'
      }`} style={lockedBy ? undefined : { color: SCREEN_INK }}>
        {lockedBy ? `${lockedBy.toUpperCase()} IS USING IT` : busy ? 'STARTING…' : 'TOUCH TO START'}
      </div>

      <style>{`
        @keyframes driftL { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes driftR { from { transform: translateX(-50%) } to { transform: translateX(0) } }
        @media (prefers-reduced-motion: reduce) {
          .vm-drift { animation: none !important }
        }
      `}</style>
    </button>
  )
}

function DriftRow({ files, seconds, reverse }: { files: string[]; seconds: number; reverse?: boolean }) {
  const doubled = [...files, ...files]
  return (
    <div className="relative overflow-hidden">
      <div
        className="vm-drift flex items-center gap-2 w-max will-change-transform"
        style={{ animation: `${reverse ? 'driftR' : 'driftL'} ${seconds}s linear infinite` }}
      >
        {doubled.map((f, i) => (
          <img key={i} src={`/packs/${f}.webp`} alt="" className="h-28 w-auto shrink-0 drop-shadow-md" />
        ))}
      </div>
    </div>
  )
}

/** Detail popup for a shelf item. Escape and backdrop both dismiss it. */
function ItemDetailDialog({ detail, onClose }: { detail: ItemDetail; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={detail.title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xs bg-card border border-card-border rounded-2xl overflow-hidden shadow-2xl"
        style={{ borderTop: `4px solid ${detail.accent}` }}
      >
        <div className="p-4 space-y-3">
          <div className="flex gap-3">
            {detail.image ? (
              <img
                src={detail.image}
                alt=""
                className={`w-20 h-28 rounded-lg bg-paper shrink-0 ${detail.fit === 'cover' ? 'object-cover' : 'object-contain'}`}
              />
            ) : (
              <div
                className="w-20 h-28 rounded-lg flex items-center justify-center text-3xl shrink-0"
                style={{ backgroundColor: `${detail.accent}22` }}
              >
                🎟️
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="font-display font-bold text-base leading-tight">{detail.title}</h3>
              <p className="font-mono text-[10px] uppercase tracking-wide mt-1" style={{ color: detail.accent }}>
                {detail.subtitle}
              </p>
            </div>
          </div>

          {detail.description ? (
            <p className="text-sm text-ink/80 leading-relaxed whitespace-pre-line">{detail.description}</p>
          ) : (
            <p className="text-sm text-muted italic">No description yet.</p>
          )}

          <button
            onClick={onClose}
            className="w-full bg-ink text-white font-semibold rounded-xl py-2.5 text-sm hover:opacity-90 transition-opacity"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function StockScreen({
  stock, tickets, soldOut, cart, ticketCart, onAdd, onAddTicket, onInspect, onInspectTicket, interactive,
}: {
  stock: StockRow[]
  tickets: TicketStockRow[]
  soldOut: boolean
  cart: Record<string, number>
  ticketCart: Record<number, number>
  onAdd: (s: StockRow, delta: number) => void
  onAddTicket: (t: TicketStockRow, delta: number) => void
  onInspect: (s: StockRow) => void
  onInspectTicket: (t: TicketStockRow) => void
  interactive: boolean
}) {
  if (stock.length === 0 && tickets.length === 0) {
    return (
      <div className="absolute inset-0 bg-[#eaf4fb] flex items-center justify-center p-4">
        <p className="text-xs text-center" style={{ color: `${SCREEN_INK}99` }}>Cleared out.</p>
      </div>
    )
  }
  return (
    <div className="absolute inset-0 bg-[#eaf4fb] overflow-y-auto p-2">
      <div className="grid grid-cols-2 gap-2">
        {stock.map((s) => {
          const taken = cart[s.set_code] ?? 0
          const gone = s.quantity === 0
          return (
            <div key={s.set_code} className="relative rounded bg-white border border-black/10 p-1">
              <button
                type="button"
                onClick={() => onInspect(s)}
                className="block w-full cursor-pointer"
                aria-label={`About ${s.set_name}`}
              >
                <img
                  src={s.display_image_url}
                  alt={s.set_name}
                  className={`w-full aspect-[2/3] object-contain ${soldOut || gone ? 'opacity-60 grayscale-[35%]' : ''}`}
                  loading="lazy"
                />
              </button>
              <p className="mt-0.5 text-[9px] font-semibold leading-tight text-center truncate" style={{ color: SCREEN_INK }}>
                {s.set_name}
              </p>
              <p className="text-[6px] leading-tight text-center" style={{ color: `${SCREEN_INK}99` }}>
                wrapper varies
              </p>

              {soldOut || gone ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="rotate-[-8deg] bg-black/80 text-white text-[7px] font-extrabold tracking-wider px-2 py-0.5 shadow">
                    SOLD OUT
                  </span>
                </div>
              ) : (
                <span className="absolute top-0.5 right-0.5 rounded-full bg-[#c82030] text-white text-[7px] font-bold px-1">
                  {s.quantity}
                </span>
              )}

              {interactive && !gone && (
                <div className="mt-0.5 flex items-center justify-center gap-1">
                  {/* Fixed colours: this tile is always light, even in dark
                      mode. Icons rather than glyphs, so nothing depends on
                      font coverage or text encoding. */}
                  <button
                    onClick={() => onAdd(s, -1)}
                    disabled={taken === 0}
                    className="w-5 h-5 rounded bg-black/75 text-white flex items-center justify-center disabled:opacity-25"
                    aria-label={`Remove one ${s.set_name} pack`}
                  >
                    <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" aria-hidden>
                      <path d="M2 5h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                  <span className="font-mono text-[9px] w-3 text-center font-bold" style={{ color: SCREEN_INK }}>
                    {taken}
                  </span>
                  <button
                    onClick={() => onAdd(s, 1)}
                    disabled={taken >= s.quantity}
                    className="w-5 h-5 rounded bg-[#c82030] text-white flex items-center justify-center disabled:opacity-25"
                    aria-label={`Add one ${s.set_name} pack`}
                  >
                    <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" aria-hidden>
                      <path d="M5 2v6M2 5h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {/* Raffle tickets share the shelf with packs, flagged by rarity colour. */}
        {tickets.map((t) => {
          const taken = ticketCart[t.ticket_id] ?? 0
          const ceiling = ticketCeiling(t)
          const gone = ceiling === 0
          // Distinguish "you've hit your personal cap" from "the machine is out".
          const maxedOut = ceiling === 0 && t.quantity > 0 && t.remaining > 0
          const colour = TICKET_RARITY_COLOR[t.rarity] ?? TICKET_RARITY_COLOR.common
          return (
            <div
              key={`ticket-${t.ticket_id}`}
              className="relative rounded bg-white p-1"
              style={{ border: `2px solid ${colour}` }}
            >
              <span
                className="absolute top-0.5 left-0.5 z-10 rounded-full text-white text-[6px] font-bold px-1 uppercase tracking-wide"
                style={{ backgroundColor: colour }}
              >
                {t.rarity}
              </span>

              <button
                type="button"
                onClick={() => onInspectTicket(t)}
                className="block w-full cursor-pointer"
                aria-label={`About ${t.name}`}
              >
                {t.image_url ? (
                  <img
                    src={t.image_url}
                    alt={t.name}
                    className={`w-full aspect-[2/3] object-cover rounded-sm ${soldOut || gone ? 'opacity-60 grayscale-[35%]' : ''}`}
                    loading="lazy"
                  />
                ) : (
                  <div
                    className={`w-full aspect-[2/3] rounded-sm flex items-center justify-center text-2xl ${soldOut || gone ? 'opacity-60 grayscale-[35%]' : ''}`}
                    style={{ backgroundColor: `${colour}22` }}
                  >
                    🎟️
                  </div>
                )}
              </button>

              <p className="mt-0.5 text-[9px] font-semibold leading-tight text-center truncate" style={{ color: SCREEN_INK }}>
                {t.name}
              </p>
              <p className="text-[6px] leading-tight text-center" style={{ color: `${SCREEN_INK}99` }}>
                {t.token_price} token{t.token_price === 1 ? '' : 's'} · {t.remaining} left
              </p>

              {soldOut || gone ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="rotate-[-8deg] bg-black/80 text-white text-[7px] font-extrabold tracking-wider px-2 py-0.5 shadow">
                    {maxedOut ? 'LIMIT REACHED' : 'SOLD OUT'}
                  </span>
                </div>
              ) : (
                <span className="absolute top-0.5 right-0.5 rounded-full bg-[#c82030] text-white text-[7px] font-bold px-1">
                  {t.quantity}
                </span>
              )}

              {interactive && !gone && (
                <div className="mt-0.5 flex items-center justify-center gap-1">
                  <button
                    onClick={() => onAddTicket(t, -1)}
                    disabled={taken === 0}
                    className="w-5 h-5 rounded bg-black/75 text-white flex items-center justify-center disabled:opacity-25"
                    aria-label={`Remove one ${t.name}`}
                  >
                    <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" aria-hidden>
                      <path d="M2 5h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                  <span className="font-mono text-[9px] w-3 text-center font-bold" style={{ color: SCREEN_INK }}>
                    {taken}
                  </span>
                  <button
                    onClick={() => onAddTicket(t, 1)}
                    disabled={taken >= ceiling}
                    className="w-5 h-5 rounded text-white flex items-center justify-center disabled:opacity-25"
                    style={{ backgroundColor: colour }}
                    aria-label={`Add one ${t.name}`}
                  >
                    <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" aria-hidden>
                      <path d="M5 2v6M2 5h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DispensingScreen({ packs, restocked }: { packs: number; restocked: boolean }) {
  return (
    <div className="absolute inset-0 bg-white flex flex-col items-center justify-center gap-2 p-4 text-center">
      <p className="text-[10px] font-semibold tracking-wide" style={{ color: `${SCREEN_INK}b3` }}>COLLECTING</p>
      <p className="text-sm font-bold" style={{ color: SCREEN_INK }}>{packs} OF {packs} TOTAL ITEMS</p>
      <div className="my-2 h-px w-3/4 bg-black/20" />
      <p className="text-[10px]" style={{ color: `${SCREEN_INK}80` }}>PLEASE WAIT</p>
      {restocked && <p className="mt-2 text-[9px] font-semibold text-[#c82030]">RESTOCKING…</p>}
    </div>
  )
}

function MaintenanceScreen() {
  return (
    <div className="absolute inset-0 bg-[#0d2b45] flex flex-col items-center justify-center gap-3 p-4 text-center">
      <svg className="w-10 h-10 text-[#f5c518]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
      </svg>
      <p className="text-white font-semibold text-sm">Under maintenance</p>
      <p className="text-white/50 text-[10px] leading-relaxed">
        This machine is being serviced. Please check back shortly.
      </p>
    </div>
  )
}
