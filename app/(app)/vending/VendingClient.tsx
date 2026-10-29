'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import LobbyChat from './LobbyChat'
import SupplyIcon from '@/components/SupplyIcon'
import { fmt, money, num } from './tokens'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { haptic } from '@/lib/settings'

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
  /** Drawn art, for things without an uploaded image (battle supplies). */
  icon?: React.ReactNode
  accent: string
  fit: 'contain' | 'cover'
  /** While you hold the machine: put one in the cart. */
  onAdd?: () => void
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

/**
 * Booster boxes: a whole box of one set's packs at once, from their own
 * limited stock (not the set's single packs). Rolled onto the shelf now and
 * then, one at a time, with a per-member cap.
 */
export interface BoxStockRow {
  box_id: number
  set_code: string
  set_name: string | null
  name: string
  description: string | null
  packs: number
  token_price: number
  quantity: number
  remaining: number
  /** null = no cap on how many one member may buy. */
  per_user_limit: number | null
  /** How many the signed-in member has already bought. */
  owned: number
  /** The set's pack wrappers, fanned out on the tile when there's no box image. */
  pack_images: string[] | null
  /** The box itself (v63; absent before). */
  image_url?: string | null
}

/** Most boxes a member may add right now: the shelf, what's left, and their own cap. */
function boxCeiling(b: BoxStockRow): number {
  const personal = b.per_user_limit === null ? Number.POSITIVE_INFINITY : Math.max(0, b.per_user_limit - b.owned)
  return Math.max(0, Math.min(b.quantity, b.remaining, personal))
}

const BOX_COLOUR = '#7c3aed'

const TICKET_RARITY_COLOR: Record<string, string> = {
  common: '#6B7280',
  uncommon: '#16A34A',
  rare: '#0EA5E9',
  ultra: '#A855F7',
  legendary: '#F6A609',
}

/**
 * Battle supplies share the shelf too: single items, and bundles of items
 * that land in the bag as the separate items. Rolled into a cycle by their
 * appearance rate. A supply on the shelf has no count, so the cart line is
 * capped instead, at the same limit checkout enforces.
 */
export interface SupplyStockRow {
  key: string
  kind: 'item' | 'bundle'
  name: string
  description: string | null
  /** Bundles only: what is inside, with each item's own price. */
  contents: { key: string; name: string; qty: number; token_price: number }[] | null
  token_price: number
}

const SUPPLY_LINE_MAX = 20

function bundleSize(s: SupplyStockRow): number {
  return (s.contents ?? []).reduce((n, c) => n + c.qty, 0)
}

/** What a bundle's contents would cost bought one by one. */
function bundleWorth(s: SupplyStockRow): number {
  return money((s.contents ?? []).reduce((sum, c) => sum + c.qty * num(c.token_price), 0))
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
  /** 'buy', or a stuck pack (v66): 'jammed' when one jams on them, 'freed' when one drops for them. Missing before v66. */
  kind?: 'buy' | 'jammed' | 'freed'
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
  initialSupplies: SupplyStockRow[]
  initialBoxes: BoxStockRow[]
  balance: number
  allowance: number
  earned: number
  userId: string
  cooldownUntil: string | null
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
  initialState, initialStock, initialTickets, initialSupplies, initialBoxes, balance, allowance, earned, userId, cooldownUntil,
  recentBuys,
}: Props) {
  const toast = useToast()
  const [split, setSplit] = useState({ allowance, earned })
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [buys, setBuys] = useState<RecentBuy[]>(recentBuys)
  const [state, setState] = useState<MachineState | null>(initialState)
  const [stock, setStock] = useState<StockRow[]>(initialStock)
  const [tickets, setTickets] = useState<TicketStockRow[]>(initialTickets)
  const [supplies, setSupplies] = useState<SupplyStockRow[]>(initialSupplies)
  const [boxes, setBoxes] = useState<BoxStockRow[]>(initialBoxes)
  const [tokens, setTokens] = useState(balance)
  const [cooldown, setCooldown] = useState<string | null>(cooldownUntil)
  const [secondsLeft, setSecondsLeft] = useState(initialState?.seconds_left ?? 0)
  // Keyed by set_code: you buy "a Base Set pack", not a specific wrapper.
  const [cart, setCart] = useState<Record<string, number>>({})
  // Tickets are priced per item, so they are carted separately from packs.
  const [ticketCart, setTicketCart] = useState<Record<number, number>>({})
  // Supplies likewise, keyed by supply key.
  const [supplyCart, setSupplyCart] = useState<Record<string, number>>({})
  // And boxes, keyed by box id.
  const [boxCart, setBoxCart] = useState<Record<number, number>>({})
  const [holdLeft, setHoldLeft] = useState(0)
  // Tapping an item on the shelf opens this; browsing is allowed even when
  // you are not the one holding the machine.
  const [detail, setDetail] = useState<ItemDetail | null>(null)
  // Checkout happens on the machine's screen: the order first, then PAY.
  const [reviewing, setReviewing] = useState(false)
  // packs: what dropped (paid for, less a jammed one, plus a stuck one that fell out for you).
  const [receipt, setReceipt] = useState<{ packs: number; tickets: number; supplies: number; boxes: number; restocked: boolean; stuck: number; freed: number } | null>(null)
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
  const supplyCount = Object.values(supplyCart).reduce((a, b) => a + b, 0)
  const boxCount = Object.values(boxCart).reduce((a, b) => a + b, 0)
  // Packs are always one token; tickets and supplies carry their own price.
  const ticketCost = Object.entries(ticketCart).reduce((sum, [id, qty]) => {
    const t = tickets.find((x) => x.ticket_id === Number(id))
    return sum + (t ? t.token_price * qty : 0)
  }, 0)
  const supplyCost = Object.entries(supplyCart).reduce((sum, [key, qty]) => {
    const s = supplies.find((x) => x.key === key)
    return sum + (s ? num(s.token_price) * qty : 0)
  }, 0)
  const boxCost = Object.entries(boxCart).reduce((sum, [id, qty]) => {
    const b = boxes.find((x) => x.box_id === Number(id))
    return sum + (b ? num(b.token_price) * qty : 0)
  }, 0)
  // Supplies are priced in cents, so round away the float drift.
  const totalCost = money(cartCount + ticketCost + supplyCost + boxCost)
  const totalItems = cartCount + ticketCount + supplyCount + boxCount
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
        const [{ data: s }, { data: t }, { data: sup }, { data: bx }] = await Promise.all([
          supabase.rpc('get_vending_stock', { p_cycle: next.cycle_no }),
          supabase.rpc('get_vending_ticket_stock', { p_cycle: next.cycle_no }),
          supabase.rpc('get_vending_supply_stock', { p_cycle: next.cycle_no }),
          supabase.rpc('get_vending_box_stock', { p_cycle: next.cycle_no }),
        ])
        setStock((s as StockRow[]) ?? [])
        setTickets((t as TicketStockRow[]) ?? [])
        setSupplies((sup as SupplyStockRow[]) ?? [])
        setBoxes((bx as BoxStockRow[]) ?? [])
      } else {
        setStock([])
        setTickets([])
        setSupplies([])
        setBoxes([])
      }
      if (next.holder_id !== userId) { setCart({}); setTicketCart({}); setSupplyCart({}); setBoxCart({}) }
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
    setBusy(true); setReceipt(null)
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
        case 'busy': toast.error(`${r.holder_name} beat you to the machine.`); break
        case 'cooldown': toast.error(`You just bought. Back in ${r.expires_at ? untilLabel(r.expires_at) : 'a while'}.`); break
        case 'not_stocked': toast.error('Nothing to buy right now.'); break
        case 'no_tokens': toast.error('You have no tokens left this month.'); break
        case 'empty': toast.error('The machine is cleared out.'); break
        default: toast.error('Could not start a session.')
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
      onAdd: iAmHolder && s.quantity > (cart[s.set_code] ?? 0) ? () => addToCart(s, 1) : undefined,
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
      onAdd: iAmHolder && ticketCeiling(t) > (ticketCart[t.ticket_id] ?? 0) ? () => addTicketToCart(t, 1) : undefined,
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

  function showBoxDetail(b: BoxStockRow) {
    const price = num(b.token_price)
    const limitNote = b.per_user_limit === null ? '' : ` · max ${b.per_user_limit} each (you've bought ${b.owned})`
    setDetail({
      title: b.name,
      subtitle: `${b.packs} packs · ${fmt(price)} token${price === 1 ? '' : 's'} · ${b.remaining} left${limitNote}`,
      description: b.description,
      image: b.image_url ?? b.pack_images?.[0] ?? null,
      accent: BOX_COLOUR,
      fit: 'contain',
      onAdd: iAmHolder && boxCeiling(b) > (boxCart[b.box_id] ?? 0) ? () => addBoxToCart(b, 1) : undefined,
    })
  }

  function addBoxToCart(b: BoxStockRow, delta: number) {
    setBoxCart((c) => {
      const cur = c[b.box_id] ?? 0
      const next = Math.min(boxCeiling(b), Math.max(0, cur + delta))
      const copy = { ...c }
      if (next === 0) delete copy[b.box_id]
      else copy[b.box_id] = next
      return copy
    })
    beat()
  }

  function addSupplyToCart(s: SupplyStockRow, delta: number) {
    setSupplyCart((c) => {
      const cur = c[s.key] ?? 0
      const next = Math.min(SUPPLY_LINE_MAX, Math.max(0, cur + delta))
      const copy = { ...c }
      if (next === 0) delete copy[s.key]
      else copy[s.key] = next
      return copy
    })
    beat()
  }

  function showSupplyDetail(s: SupplyStockRow) {
    const price = num(s.token_price)
    const priceLabel = `${fmt(price)} token${price === 1 ? '' : 's'}`
    let description = s.description
    if (s.kind === 'bundle') {
      const lines = (s.contents ?? []).map((c) => `${c.qty} × ${c.name}`)
      const worth = bundleWorth(s)
      if (worth > price) lines.push('', `${fmt(worth)} tokens bought separately.`)
      lines.push('', 'The items go into your bag separately.')
      description = lines.join('\n')
    }
    setDetail({
      title: s.name,
      subtitle: `${s.kind === 'bundle' ? `bundle · ${bundleSize(s)} items` : 'battle item'} · ${priceLabel}`,
      description,
      image: null,
      icon: <SupplyIcon supplyKey={s.kind === 'bundle' ? 'bundle' : s.key} className="w-12 h-12" />,
      accent: s.kind === 'bundle' ? '#F59E0B' : '#0E1726',
      fit: 'contain',
      onAdd: iAmHolder && (supplyCart[s.key] ?? 0) < SUPPLY_LINE_MAX ? () => addSupplyToCart(s, 1) : undefined,
    })
  }

  async function checkout() {
    if (totalItems === 0) return
    setBusy(true)
    const supabase = createClient()
    const items = Object.entries(cart).map(([set_code, qty]) => ({ set_code, qty }))
    const ticketItems = Object.entries(ticketCart).map(([id, qty]) => ({ ticket_id: Number(id), qty }))
    const supplyItems = Object.entries(supplyCart).map(([key, qty]) => ({ key, qty }))
    const boxItems = Object.entries(boxCart).map(([id, qty]) => ({ box_id: Number(id), qty }))
    // p_supplies and p_boxes only when there are some, so pack and ticket
    // checkouts keep working against a database that predates v56 or v62.
    const { data } = await supabase.rpc('vending_checkout', {
      p_items: items, p_tickets: ticketItems,
      ...(supplyItems.length > 0 ? { p_supplies: supplyItems } : {}),
      ...(boxItems.length > 0 ? { p_boxes: boxItems } : {}),
    })
    const r = (Array.isArray(data) ? data[0] : data) as
      | { ok: boolean; reason: string; packs_bought: number; tickets_bought: number; supplies_bought: number; boxes_bought?: number; balance: number; restocked: boolean; packs_stuck?: number; packs_freed?: number }
      | null
    if (r?.ok) {
      setTokens(num(r.balance))
      setCart({})
      setTicketCart({})
      setSupplyCart({})
      setBoxCart({})
      haptic([20, 40, 20])
      const stuck = r.packs_stuck ?? 0, freed = r.packs_freed ?? 0
      setReceipt({
        packs: r.packs_bought - stuck + freed, tickets: r.tickets_bought ?? 0, boxes: r.boxes_bought ?? 0,
        supplies: r.supplies_bought ?? 0, restocked: r.restocked, stuck, freed,
      })
      if (stuck > 0) haptic([60, 30, 60])
      // Read the real cooldown back rather than assuming a duration - it is
      // an admin setting and can be anything.
      const { data: me } = await supabase
        .from('profiles').select('vending_cooldown_until').eq('id', userId).single()
      setCooldown(me?.vending_cooldown_until ?? null)
      // Spending draws allowance first, so the split shifts on every buy.
      const { data: bd } = await supabase.rpc('token_breakdown')
      const b = (Array.isArray(bd) ? bd[0] : bd) as { allowance: number; earned: number } | null
      if (b) setSplit({ allowance: b.allowance, earned: b.earned })
      // The unopened-packs list is a server prop, so without this the packs
      // just bought do not show up in the collection until something else
      // forces a reload.
      startTransition(() => router.refresh())
    } else {
      switch (r?.reason) {
        case 'not_holder': toast.error('Your session timed out.'); break
        case 'insufficient_stock': toast.error('Someone got there first — stock changed.'); break
        case 'set_sold_out': toast.error('That set has sold out for good.'); break
        case 'insufficient_tokens': toast.error('Not enough tokens.'); break
        case 'ticket_sold_out': toast.error('That raffle ticket just ran out.'); break
        case 'ticket_limit_reached': toast.error('You already hold the maximum of that ticket.'); break
        case 'ticket_unavailable': toast.error('That raffle ticket is no longer available.'); break
        case 'supply_not_stocked': toast.error('That supply is no longer on the shelf.'); break
        case 'supply_unavailable': toast.error('That supply is no longer sold.'); break
        case 'box_sold_out': toast.error('That booster box just sold out.'); break
        case 'box_limit_reached': toast.error("You've already bought your box of that set."); break
        case 'box_unavailable': toast.error('That booster box is no longer sold.'); break
        default: toast.error('Checkout failed.')
      }
    }
    await refresh()
    setBusy(false)
  }

  const onCooldown = !!cooldown && new Date(cooldown).getTime() > Date.now()
  const someoneElse = !!state?.holder_id && !iAmHolder

  async function leave() {
    setReviewing(false)
    const s = createClient(); await s.rpc('vending_release')
    setCart({}); setTicketCart({}); setSupplyCart({}); setBoxCart({}); refresh()
  }

  // The order on the checkout screen, one line per thing bought.
  const orderLines = [
    ...Object.entries(boxCart).map(([id, qty]) => {
      const b = boxes.find((x) => x.box_id === Number(id))
      return { key: `b-${id}`, name: `${b?.name ?? 'Booster box'} (${b?.packs ?? 0} packs)`, qty, cost: money(num(b?.token_price ?? 0) * qty), image: b?.image_url ?? b?.pack_images?.[0] ?? null, icon: null }
    }),
    ...Object.entries(cart).map(([code, qty]) => {
      const s = stock.find((x) => x.set_code === code)
      return { key: `p-${code}`, name: `${s?.set_name ?? code} pack`, qty, cost: qty, image: s?.display_image_url ?? null, icon: null }
    }),
    ...Object.entries(ticketCart).map(([id, qty]) => {
      const t = tickets.find((x) => x.ticket_id === Number(id))
      return { key: `t-${id}`, name: t?.name ?? 'Raffle ticket', qty, cost: money((t?.token_price ?? 0) * qty), image: t?.image_url ?? null, icon: null }
    }),
    ...Object.entries(supplyCart).map(([key, qty]) => {
      const s = supplies.find((x) => x.key === key)
      return { key: `s-${key}`, name: s?.name ?? key, qty, cost: money(num(s?.token_price ?? 0) * qty), image: null,
        icon: <SupplyIcon supplyKey={s?.kind === 'bundle' ? 'bundle' : key} className="w-7 h-7" /> }
    }),
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="font-display font-semibold text-base">Virtual Vending Machine</h1>
          <p className="font-mono text-[11px] text-muted">
            {state?.frozen ? 'clock paused' : `changes in ${mmss(secondsLeft)}`} · cycle #{state?.cycle_no ?? '—'}
            {onCooldown && ` · your cooldown ${untilLabel(cooldown!)}`}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="flex items-center gap-1.5 bg-card border border-card-border rounded-full px-3 py-1">
            <span className="font-mono text-sm font-semibold text-signal">{fmt(tokens)}</span>
            <span className="text-xs text-muted">{tokens === 1 ? 'token' : 'tokens'}</span>
          </div>
          {/* Which part is perishable matters now that spending takes the
              allowance first and earned tokens carry over. */}
          {tokens > 0 && (
            <p className="font-mono text-[11px] text-muted mt-0.5">
              {split.allowance > 0 && `${split.allowance} expire`}
              {split.allowance > 0 && split.earned > 0 && ' · '}
              {split.earned > 0 && `${split.earned} kept`}
            </p>
          )}
        </div>
      </div>

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
              <DispensingScreen items={receipt.packs + receipt.tickets + receipt.supplies + receipt.boxes} restocked={receipt.restocked} jammed={receipt.stuck > 0} />
            ) : status === 'out_of_stock' ? (
              <StockScreen stock={stock} tickets={tickets} supplies={supplies} boxes={boxes} soldOut cart={{}} ticketCart={{}} supplyCart={{}} boxCart={{}} onAdd={() => {}} onAddTicket={() => {}} onAddSupply={() => {}} onAddBox={() => {}} onInspect={showPackDetail} onInspectTicket={showTicketDetail} onInspectSupply={showSupplyDetail} onInspectBox={showBoxDetail} interactive={false} />
            ) : status === 'in_stock' ? (
              iAmHolder ? (
                reviewing ? (
                  <CheckoutScreen lines={orderLines} total={totalCost} tokens={tokens} busy={busy}
                    suppliesOnly={supplyCount > 0 && cartCount + ticketCount === 0}
                    onBack={() => { setReviewing(false); beat() }}
                    onPay={async () => { await checkout(); setReviewing(false) }} />
                ) : (
                  <StockScreen stock={stock} tickets={tickets} supplies={supplies} boxes={boxes} soldOut={false} cart={cart} ticketCart={ticketCart} supplyCart={supplyCart} boxCart={boxCart} onAdd={addToCart} onAddTicket={addTicketToCart} onAddSupply={addSupplyToCart} onAddBox={addBoxToCart} onInspect={showPackDetail} onInspectTicket={showTicketDetail} onInspectSupply={showSupplyDetail} onInspectBox={showBoxDetail} interactive
                    bar={{ tokens, holdLeft, waiting: lurkers.length, count: totalItems, total: totalCost, onLeave: leave, onCheckout: () => { setReviewing(true); beat() } }} />
                )
              ) : (
                <AttractScreen onStart={claim} busy={busy} lockedBy={someoneElse ? state!.holder_name : null} tokens={tokens} />
              )
            ) : (
              // Everything non-buyable shows maintenance. This also catches a
              // machine still parked on the retired blackout status.
              <MaintenanceScreen />
            )}

            {/* On-screen arrival messages, above the cart bar. */}
            {notices.length > 0 && (
              <div className="absolute inset-x-0 bottom-16 z-20 px-2 space-y-1 pointer-events-none">
                {notices.map((n) => (
                  <div key={n.id} className="rounded bg-black/80 text-white text-[11px] font-semibold tracking-wide px-2 py-1 shadow">
                    {n.text}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3 h-10 rounded-xl bg-[#111] border-[3px] border-[#ff3b53] shadow-[inset_0_4px_14px_rgba(0,0,0,0.8)]" />
        </div>
      </div>

      <ItemDetailSheet detail={detail} onClose={() => setDetail(null)} />

      {/* Who else is here */}
      {others.length > 0 && (
        <div className="mx-auto w-full max-w-sm flex items-center gap-2 flex-wrap justify-center">
          {others.map((w) => (
            <span
              key={w.watcher_id}
              className={`text-[11px] font-medium rounded-full px-2 py-0.5 border ${
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

      {receipt && (
        <Card className="mx-auto w-full max-w-sm space-y-2 text-center">
          {receipt.stuck > 0 && (
            <p className="text-xs font-medium text-red-500">
              Clunk. One of your packs jammed and didn&apos;t drop. Sorry, no refunds. It&apos;s still stuck in there...
            </p>
          )}
          {receipt.freed > 0 && (
            <p className="text-xs font-medium text-signal">
              Something else fell out with yours: a pack someone left stuck in the machine. It&apos;s yours, free.
            </p>
          )}
          <p className="text-sm font-medium">
            Collected{' '}
            {[
              receipt.packs > 0 ? `${receipt.packs} pack${receipt.packs === 1 ? '' : 's'}` : null,
              receipt.tickets > 0 ? `${receipt.tickets} raffle ticket${receipt.tickets === 1 ? '' : 's'}` : null,
              receipt.supplies > 0 ? `${receipt.supplies} battle suppl${receipt.supplies === 1 ? 'y' : 'ies'}` : null,
              receipt.boxes > 0 ? `${receipt.boxes} sealed booster box${receipt.boxes === 1 ? '' : 'es'}` : null,
            ].filter(Boolean).join(' and ') || 'nothing'}.
          </p>
          {receipt.restocked && <p className="text-xs text-signal font-medium">The machine restocked behind you.</p>}
          <p className="text-xs text-muted">
            {cooldown && new Date(cooldown).getTime() > Date.now()
              ? `Back in ${untilLabel(cooldown)}.`
              : 'You can use the machine again now.'}
          </p>
          <div className="flex gap-2 pt-1">
            <Button full onClick={() => { setReceipt(null); router.push('/collection') }}>
              {receipt.packs > 0 || receipt.boxes > 0 ? 'Open them' : 'See them'}
            </Button>
            <Button variant="outline" onClick={() => setReceipt(null)}>Done</Button>
          </div>
        </Card>
      )}

      {!iAmHolder && !receipt && (
        <Card className="mx-auto w-full max-w-sm !py-3 flex items-center justify-between gap-2">
          <p className="text-sm font-medium truncate min-w-0">
            {someoneElse
              ? `${state!.holder_name} is at the machine`
              : status === 'in_stock' ? `Stocked — ${stock.reduce((n, s) => n + s.quantity, 0)} packs` +
                  (supplies.length > 0 ? ` · ${supplies.length} suppl${supplies.length === 1 ? 'y' : 'ies'}` : '')
              : status === 'out_of_stock' ? 'Sold out'
              : 'Under maintenance'}
          </p>
          <Button variant="outline" size="sm" onClick={refresh}>Refresh</Button>
        </Card>
      )}

      {/* ── Lobby chat ── */}
      <div className="mx-auto w-full max-w-sm">
        <LobbyChat watching={others.length} />
      </div>

      {/* ── Recent buys ── */}
      <section className="mx-auto w-full max-w-sm space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display font-semibold text-sm">Recent buys</h2>
          <span className="font-mono text-[11px] text-muted">1 token = 1 pack</span>
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
                  <div className="w-6 h-6 rounded-full bg-ink/10 flex items-center justify-center text-[11px] font-bold text-muted shrink-0">
                    {b.buyer.charAt(0).toUpperCase()}
                  </div>
                )}
                <p className="text-xs min-w-0 flex-1 truncate">
                  {b.kind === 'jammed' ? (
                    <>
                      <span className="text-muted">A {b.sets} pack jammed on </span>
                      <span className="font-medium">{b.buyer}</span>
                      <span className="text-muted">. It&apos;s still in there.</span>
                    </>
                  ) : b.kind === 'freed' ? (
                    <>
                      <span className="text-muted">A stuck {b.sets} pack dropped for </span>
                      <span className="font-medium">{b.buyer}</span>
                      <span className="font-semibold text-signal">. Free!</span>
                    </>
                  ) : (
                    <>
                      <span className="font-medium">{b.buyer}</span>
                      <span className="text-muted"> took </span>
                      <span className="font-mono font-semibold text-signal">{b.packs}</span>
                      <span className="text-muted"> from {b.sets}</span>
                    </>
                  )}
                </p>
                <span className="font-mono text-[11px] text-muted shrink-0">{agoLabel(b.bought_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

/* ────────────────────────────── screens ────────────────────────────── */

const ATTRACT_ROWS = 4

// The wrappers on the idle screen: Gym Heroes, Gym Challenge, Neo Genesis,
// Base Set 2, Neo Discovery and Neo Revelation, four each. Dealt round-robin
// across the rows below, so entry 4k + r is row r's k-th wrapper. Row r's k-th
// wrapper is set (r + k) mod 6, and that set's r-th wrapper: every row shows
// each set once, so no set ever sits twice side by side, round the loop
// included, and every wrapper is on screen somewhere.
const ATTRACT_PACKS = [
  'gym-heroes-brock', 'gym-challenge-blaine', 'neo-genesis-meganium', 'base-set-2-pidgeot',
  'gym-challenge-koga', 'neo-genesis-typhlosion', 'base-set-2-mewtwo', 'neo-discovery-umbreon',
  'neo-genesis-lugia', 'base-set-2-gyarados', 'neo-discovery-xatu', 'neo-revelation-misdreavus',
  'base-set-2-raichu', 'neo-discovery-smeargle', 'neo-revelation-raikou', 'gym-heroes-erika',
  'neo-discovery-scizor', 'neo-revelation-suicune', 'gym-heroes-lt-surge', 'gym-challenge-giovanni',
  'neo-revelation-entei', 'gym-heroes-misty', 'gym-challenge-sabrina', 'neo-genesis-feraligatr',
]

function AttractScreen({ onStart, busy, lockedBy, tokens }: { onStart: () => void; busy: boolean; lockedBy: string | null; tokens: number }) {
  // Rows drifting alternate ways, so the tall screen reads as full of product
  // rather than mostly empty sky. Dealt round-robin rather than sliced into
  // blocks: consecutive entries land in different rows, which is what keeps
  // each row mixed without hand-ordering four separate lists.
  const rows: string[][] = Array.from({ length: ATTRACT_ROWS }, () => [])
  ATTRACT_PACKS.forEach((f, i) => rows[i % ATTRACT_ROWS].push(f))
  return (
    <button
      onClick={onStart}
      disabled={busy || !!lockedBy}
      className="absolute inset-0 w-full h-full flex flex-col bg-gradient-to-b from-[#dff1fb] to-[#bfe4f7] focus:outline-none disabled:cursor-not-allowed"
    >
      <div className="px-3 pt-3 shrink-0">
        <div className="relative rounded bg-[#c82030] text-white text-[11px] font-bold tracking-wide py-0.5">
          NOTICE
          <span className="absolute right-0 -top-1 rounded-full bg-[#0E1726] text-[#fde68a] px-2 py-0.5 text-[11px] font-bold shadow">
            <span className="text-[10px] tracking-wider text-slate-400 mr-1">TOKENS</span>{fmt(tokens)}
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-snug" style={{ color: `${SCREEN_INK}b3` }}>
          One trainer at a time. Collect your packs from the tray before the next person steps up.
        </p>
      </div>

      {/* The rows split whatever height is left and the wrappers are sized to
          their row, so the screen fills exactly at any size. Fixing a pack
          height instead just let the flex children squash and crop the art. */}
      <div className="relative flex-1 min-h-0 overflow-hidden flex flex-col gap-1.5 py-2">
        {rows.map((files, i) => (
          // Speeds are deliberately uneven so the rows never line up into one
          // block sliding together.
          <DriftRow key={i} files={files} seconds={21 + i * 5} reverse={i % 2 === 1} />
        ))}
      </div>

      <div className={`m-2 rounded py-2.5 text-center font-extrabold text-sm tracking-wide shadow shrink-0 ${
        lockedBy ? 'bg-black/75 text-white' : 'bg-[#f5c518] animate-pulse'
      }`} style={lockedBy ? undefined : { color: SCREEN_INK }}>
        {lockedBy ? `${lockedBy.toUpperCase()} IS USING IT` : busy ? 'STARTING…' : 'TOUCH TO START'}
      </div>

      <style>{`
        @keyframes driftL { from { transform: translate3d(0, 0, 0) } to { transform: translate3d(-50%, 0, 0) } }
        @keyframes driftR { from { transform: translate3d(-50%, 0, 0) } to { transform: translate3d(0, 0, 0) } }
        @media (prefers-reduced-motion: reduce) {
          .vm-drift { animation: none !important }
        }
      `}</style>
    </button>
  )
}

function DriftRow({ files, seconds, reverse }: { files: string[]; seconds: number; reverse?: boolean }) {
  // The animation slides the strip by half its width and restarts, so one
  // half has to be wider than the screen or the wrap shows a bare patch.
  // Four rows means only four or five wrappers each, which is not wide
  // enough on its own, so the row repeats until it is and that gets doubled.
  const reps = Math.max(1, Math.ceil(10 / files.length))
  const base = Array.from({ length: reps }, () => files).flat()
  const doubled = [...base, ...base]
  return (
    <div className="relative flex-1 min-h-0 overflow-hidden">
      <div
        className="vm-drift flex items-center gap-1.5 w-max h-full"
        style={{ animation: `${reverse ? 'driftR' : 'driftL'} ${seconds}s linear infinite`, backfaceVisibility: 'hidden' }}
      >
        {/* A box shadow, not a drop-shadow filter: the wrappers are plain
            rectangles, so it looks the same, and Safari on iPhone gave up
            painting whole rows with a filter on each of the ~100 moving packs. */}
        {doubled.map((f, i) => (
          <img key={i} src={`/packs/${f}.webp`} alt="" decoding="async" draggable={false} className="h-full w-auto shrink-0 shadow-md" />
        ))}
      </div>
    </div>
  )
}

/**
 * What a shelf item is, in the app's standard sheet. While you hold the
 * machine it can put one straight in the cart.
 */
function ItemDetailSheet({ detail, onClose }: { detail: ItemDetail | null; onClose: () => void }) {
  return (
    <Sheet open={!!detail} onClose={onClose} title={detail?.title ?? ''} accent={detail?.accent}
      footer={detail && (
        <div className="flex gap-2">
          {detail.onAdd && (
            <Button full onClick={() => { detail.onAdd!(); onClose() }}>Add to cart</Button>
          )}
          <Button variant={detail.onAdd ? 'outline' : 'secondary'} full={!detail.onAdd} onClick={onClose}>Close</Button>
        </div>
      )}>
      {detail && (
        <div className="space-y-3">
          <div className="flex gap-3">
            {detail.image ? (
              <img src={detail.image} alt=""
                className={`w-24 h-32 rounded-lg bg-paper shrink-0 ${detail.fit === 'cover' ? 'object-cover' : 'object-contain'}`} />
            ) : (
              <div className="w-24 h-32 rounded-lg flex items-center justify-center text-3xl shrink-0" style={{ backgroundColor: `${detail.accent}22` }}>
                {detail.icon ?? '🎟️'}
              </div>
            )}
            <p className="font-mono text-[11px] uppercase tracking-wide leading-relaxed" style={{ color: detail.accent }}>{detail.subtitle}</p>
          </div>
          {detail.description ? (
            <p className="text-sm text-ink/80 leading-relaxed whitespace-pre-line">{detail.description}</p>
          ) : (
            <p className="text-sm text-muted italic">No description yet.</p>
          )}
        </div>
      )}
    </Sheet>
  )
}

/** The cart bar's numbers and actions, while you hold the machine. */
type CartBar = {
  tokens: number
  /** Seconds left on your hold of the machine. */
  holdLeft: number
  /** Trainers waiting behind you. */
  waiting: number
  count: number
  total: number
  onLeave: () => void
  onCheckout: () => void
}

/** − 2 + under a tile: 40px targets, light-on-dark so they read on the white tile. */
function Stepper({ name, taken, max, onAdd, colour = '#c82030' }: {
  name: string; taken: number; max: number; onAdd: (delta: number) => void; colour?: string
}) {
  return (
    <div className="mt-1 flex items-center justify-between gap-1">
      <button onClick={() => onAdd(-1)} disabled={taken === 0} aria-label={`Remove one ${name}`}
        className="w-10 h-10 rounded-lg bg-black/75 text-white flex items-center justify-center disabled:opacity-25 active:scale-95 transition-transform">
        <svg viewBox="0 0 10 10" className="w-3 h-3" aria-hidden><path d="M2 5h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      </button>
      <span className="font-mono text-sm font-bold min-w-[1.5rem] text-center" style={{ color: SCREEN_INK }} aria-live="polite">{taken}</span>
      <button onClick={() => onAdd(1)} disabled={taken >= max} aria-label={`Add one ${name}`}
        className="w-10 h-10 rounded-lg text-white flex items-center justify-center disabled:opacity-25 active:scale-95 transition-transform"
        style={{ backgroundColor: colour }}>
        <svg viewBox="0 0 10 10" className="w-3 h-3" aria-hidden><path d="M5 2v6M2 5h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      </button>
    </div>
  )
}

function StockScreen({
  stock, tickets, supplies, boxes, soldOut, cart, ticketCart, supplyCart, boxCart,
  onAdd, onAddTicket, onAddSupply, onAddBox, onInspect, onInspectTicket, onInspectSupply, onInspectBox, interactive, bar,
}: {
  stock: StockRow[]
  tickets: TicketStockRow[]
  supplies: SupplyStockRow[]
  boxes: BoxStockRow[]
  soldOut: boolean
  cart: Record<string, number>
  ticketCart: Record<number, number>
  supplyCart: Record<string, number>
  boxCart: Record<number, number>
  onAdd: (s: StockRow, delta: number) => void
  onAddTicket: (t: TicketStockRow, delta: number) => void
  onAddSupply: (s: SupplyStockRow, delta: number) => void
  onAddBox: (b: BoxStockRow, delta: number) => void
  onInspect: (s: StockRow) => void
  onInspectTicket: (t: TicketStockRow) => void
  onInspectSupply: (s: SupplyStockRow) => void
  onInspectBox: (b: BoxStockRow) => void
  interactive: boolean
  /** Shown while you hold the machine: your tokens, the cart, Back and Checkout. */
  bar?: CartBar
}) {
  if (stock.length === 0 && tickets.length === 0 && supplies.length === 0 && boxes.length === 0) {
    return (
      <div className="absolute inset-0 bg-[#eaf4fb] flex flex-col items-center justify-center gap-3 p-4">
        <p className="text-sm text-center" style={{ color: `${SCREEN_INK}99` }}>Cleared out.</p>
        {bar && <button onClick={bar.onLeave} className="min-h-10 px-4 rounded-lg bg-[#0E1726] text-white text-xs font-bold">◀ BACK</button>}
      </div>
    )
  }
  const SOLD = (label = 'SOLD OUT') => (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <span className="rotate-[-8deg] bg-black/80 text-white text-[11px] font-extrabold tracking-wider px-2 py-0.5 shadow">{label}</span>
    </div>
  )
  return (
    <div className="absolute inset-0 bg-[#eaf4fb] flex flex-col">
      {bar && (
        <div className="shrink-0 flex items-center gap-2 px-2 pt-2">
          <span className={`font-mono text-[11px] font-semibold ${bar.holdLeft <= 15 ? 'text-red-600' : ''}`} style={bar.holdLeft <= 15 ? undefined : { color: `${SCREEN_INK}b3` }}>
            {mmss(bar.holdLeft)} left{bar.waiting > 0 ? ` · ${bar.waiting} waiting` : ''}
          </span>
          <span className="ml-auto rounded-full bg-[#0E1726] text-[#fde68a] px-2.5 py-1 text-[11px] font-bold shadow">
            <span className="text-[10px] tracking-wider text-slate-400 mr-1">TOKENS</span>{fmt(bar.tokens)}
          </span>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto p-2">
        <div className="grid grid-cols-2 gap-2">
          {/* Booster boxes lead the shelf when one turns up: the box itself, or the set's wrappers fanned out. */}
          {boxes.map((b) => {
            const taken = boxCart[b.box_id] ?? 0
            const ceiling = boxCeiling(b)
            const gone = ceiling === 0
            // "You've bought yours" reads differently from "the machine is out".
            const maxedOut = gone && b.quantity > 0 && b.remaining > 0
            const price = num(b.token_price)
            const arts = (b.pack_images ?? []).slice(0, 3)
            return (
              <div key={`box-${b.box_id}`} className="relative rounded-lg bg-white p-1.5" style={{ border: `2px solid ${BOX_COLOUR}` }}>
                <span className="absolute top-1 left-1 z-10 rounded-sm text-white text-[10px] font-extrabold tracking-wider px-1" style={{ backgroundColor: BOX_COLOUR }}>BOX</span>
                <button type="button" onClick={() => onInspectBox(b)} className="block w-full cursor-pointer" aria-label={`About ${b.name}`}>
                  <div className={`relative w-full aspect-[2/3] rounded-sm overflow-hidden ${soldOut || gone ? 'opacity-60 grayscale-[35%]' : ''}`}
                    style={{ background: 'radial-gradient(circle at 50% 35%, #f5f3ff, #ddd6fe)' }}>
                    {b.image_url ? (
                      <div className="absolute inset-0 p-1 flex items-center justify-center">
                        <img src={b.image_url} alt="" loading="lazy" className="w-full object-contain" />
                      </div>
                    ) : arts.map((src, i) => (
                      <img key={src} src={src} alt="" loading="lazy"
                        className="absolute top-[12%] h-[76%] w-auto object-contain drop-shadow"
                        style={{ left: `${10 + i * 22}%`, transform: `rotate(${(i - 1) * 9}deg)`, zIndex: i === 1 ? 2 : 1 }} />
                    ))}
                    <span className="absolute bottom-1 inset-x-0 text-center text-[11px] font-extrabold" style={{ color: BOX_COLOUR }}>×{b.packs} PACKS</span>
                  </div>
                </button>
                <p className="mt-1 text-xs font-semibold leading-tight text-center truncate" style={{ color: SCREEN_INK }}>{b.name}</p>
                <p className="text-[10px] leading-tight text-center" style={{ color: `${SCREEN_INK}99` }}>
                  {fmt(price)} tokens · {b.remaining} left
                </p>
                {soldOut || gone ? SOLD(maxedOut ? 'LIMIT REACHED' : 'SOLD OUT') : (
                  <span className="absolute top-1 right-1 rounded-full bg-[#c82030] text-white text-[10px] font-bold px-1.5">{b.quantity}</span>
                )}
                {interactive && !gone && <Stepper name={b.name} taken={taken} max={ceiling} onAdd={(d) => onAddBox(b, d)} colour={BOX_COLOUR} />}
              </div>
            )
          })}

          {stock.map((s) => {
            const taken = cart[s.set_code] ?? 0
            const gone = s.quantity === 0
            return (
              <div key={s.set_code} className={`relative rounded-lg bg-white p-1.5 ${taken ? 'ring-2 ring-[#c82030]' : 'border border-black/10'}`}>
                <button type="button" onClick={() => onInspect(s)} className="block w-full cursor-pointer" aria-label={`About ${s.set_name}`}>
                  <img src={s.display_image_url} alt={s.set_name} loading="lazy"
                    className={`w-full aspect-[2/3] object-contain ${soldOut || gone ? 'opacity-60 grayscale-[35%]' : ''}`} />
                </button>
                <p className="mt-1 text-xs font-semibold leading-tight text-center truncate" style={{ color: SCREEN_INK }}>{s.set_name}</p>
                <p className="text-[10px] leading-tight text-center" style={{ color: `${SCREEN_INK}99` }}>1 token · wrapper varies</p>
                {soldOut || gone ? SOLD() : (
                  <span className="absolute top-1 right-1 rounded-full bg-[#c82030] text-white text-[10px] font-bold px-1.5">{s.quantity}</span>
                )}
                {interactive && !gone && <Stepper name={`${s.set_name} pack`} taken={taken} max={s.quantity} onAdd={(d) => onAdd(s, d)} />}
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
              <div key={`ticket-${t.ticket_id}`} className="relative rounded-lg bg-white p-1.5" style={{ border: `2px solid ${colour}` }}>
                <span className="absolute top-1 left-1 z-10 rounded-full text-white text-[10px] font-bold px-1.5 uppercase tracking-wide" style={{ backgroundColor: colour }}>
                  {t.rarity}
                </span>
                <button type="button" onClick={() => onInspectTicket(t)} className="block w-full cursor-pointer" aria-label={`About ${t.name}`}>
                  {t.image_url ? (
                    <img src={t.image_url} alt={t.name} loading="lazy"
                      className={`w-full aspect-[2/3] object-cover rounded-sm ${soldOut || gone ? 'opacity-60 grayscale-[35%]' : ''}`} />
                  ) : (
                    <div className={`w-full aspect-[2/3] rounded-sm flex items-center justify-center text-2xl ${soldOut || gone ? 'opacity-60 grayscale-[35%]' : ''}`}
                      style={{ backgroundColor: `${colour}22` }}>🎟️</div>
                  )}
                </button>
                <p className="mt-1 text-xs font-semibold leading-tight text-center truncate" style={{ color: SCREEN_INK }}>{t.name}</p>
                <p className="text-[10px] leading-tight text-center" style={{ color: `${SCREEN_INK}99` }}>
                  {t.token_price} token{t.token_price === 1 ? '' : 's'} · {t.remaining} left
                </p>
                {soldOut || gone ? SOLD(maxedOut ? 'LIMIT REACHED' : 'SOLD OUT') : (
                  <span className="absolute top-1 right-1 rounded-full bg-[#c82030] text-white text-[10px] font-bold px-1.5">{t.quantity}</span>
                )}
                {interactive && !gone && <Stepper name={t.name} taken={taken} max={ceiling} onAdd={(d) => onAddTicket(t, d)} colour={colour} />}
              </div>
            )
          })}

          {/* Battle supplies after the packs and tickets. No count badge: a
              supply on the shelf does not run out. */}
          {supplies.map((s) => {
            const taken = supplyCart[s.key] ?? 0
            const bundle = s.kind === 'bundle'
            const price = num(s.token_price)
            return (
              <div key={`supply-${s.key}`} className={`relative rounded-lg bg-white p-1.5 ${taken ? 'ring-2 ring-[#c82030]' : 'border border-black/10'}`}>
                <span className="absolute top-1 left-1 z-10 rounded-sm bg-[#0E1726] text-[#fde68a] text-[10px] font-extrabold tracking-wider px-1">
                  {bundle ? 'BUNDLE' : 'ITEM'}
                </span>
                <button type="button" onClick={() => onInspectSupply(s)} className="block w-full cursor-pointer" aria-label={`About ${s.name}`}>
                  <div className={`w-full aspect-[2/3] rounded-sm flex flex-col items-center justify-center gap-1.5 ${soldOut ? 'opacity-60 grayscale-[35%]' : ''}`}
                    style={{ background: bundle ? 'radial-gradient(circle at 50% 35%, #fff7d6, #fde68a)' : 'radial-gradient(circle at 50% 40%, #ffffff, #dbeafe)' }}>
                    {bundle ? (
                      (s.contents ?? []).map((c) => (
                        <span key={c.key} className="flex items-center gap-1 text-xs font-extrabold" style={{ color: SCREEN_INK }}>
                          <SupplyIcon supplyKey={c.key} className="w-7 h-7" />×{c.qty}
                        </span>
                      ))
                    ) : (
                      <SupplyIcon supplyKey={s.key} className="w-1/2 h-auto drop-shadow" />
                    )}
                  </div>
                </button>
                <p className="mt-1 text-xs font-semibold leading-tight text-center truncate uppercase" style={{ color: SCREEN_INK }}>{s.name}</p>
                <p className="text-[10px] leading-tight text-center truncate" style={{ color: `${SCREEN_INK}99` }}>
                  {fmt(price)} token{price === 1 ? '' : 's'} · {bundle ? `${bundleSize(s)} items` : s.description}
                </p>
                {soldOut && SOLD()}
                {interactive && !soldOut && <Stepper name={s.name} taken={taken} max={SUPPLY_LINE_MAX} onAdd={(d) => onAddSupply(s, d)} />}
              </div>
            )
          })}
        </div>
      </div>
      {bar && (
        // Like the real machine: the cart rides along the bottom of the screen.
        <div className="shrink-0 flex items-center gap-2 p-2 bg-white/80 border-t border-black/10">
          <button onClick={bar.onLeave} className="min-h-10 px-3 rounded-lg bg-[#0E1726] text-white text-xs font-bold">◀ BACK</button>
          <span className="flex-1 min-w-0 text-center text-xs font-semibold truncate" style={{ color: SCREEN_INK }}>
            {bar.count ? <><span className="text-[#c82030] font-extrabold">CART {bar.count}</span> · {fmt(bar.total)} tk</> : 'Cart empty'}
          </span>
          <button onClick={bar.onCheckout} disabled={!bar.count}
            className="min-h-10 px-3 rounded-lg bg-[#c82030] text-white text-xs font-bold disabled:opacity-35">CHECKOUT</button>
        </div>
      )}
    </div>
  )
}

/**
 * Checkout, on the machine's own screen: the order, the total, and your
 * tokens before and after. PAY hands over to the dispensing screen.
 */
function CheckoutScreen({ lines, total, tokens, busy, suppliesOnly, onBack, onPay }: {
  lines: { key: string; name: string; qty: number; cost: number; image: string | null; icon: React.ReactNode }[]
  total: number
  tokens: number
  busy: boolean
  suppliesOnly: boolean
  onBack: () => void
  onPay: () => void
}) {
  const short = total > tokens
  return (
    <div className="absolute inset-0 bg-white flex flex-col p-3" style={{ color: SCREEN_INK }}>
      <p className="text-center font-extrabold tracking-[.12em] text-sm pb-2 border-b border-black/15">CHECKOUT</p>
      <ul className="flex-1 min-h-0 overflow-y-auto py-1">
        {lines.map((l) => (
          <li key={l.key} className="flex items-center gap-2 py-1.5 border-b border-black/5 text-xs">
            <span className="w-7 h-9 shrink-0 flex items-center justify-center">
              {l.image ? <img src={l.image} alt="" className="max-w-full max-h-full object-contain" /> : l.icon ?? '🎟️'}
            </span>
            <span className="flex-1 min-w-0 font-semibold truncate">{l.name}</span>
            <span className="font-mono text-[11px] opacity-60">×{l.qty}</span>
            <span className="w-12 text-right font-mono font-semibold">{fmt(l.cost)}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between pt-2 border-t-2 border-[#0E1726] text-sm font-extrabold">
        <span>TOTAL</span><span>{fmt(total)} token{total === 1 ? '' : 's'}</span>
      </div>
      <p className="text-right text-[11px] opacity-70 pb-1">
        Your tokens: {fmt(tokens)} → <b className={short ? 'text-red-600' : ''}>{short ? 'not enough' : fmt(money(tokens - total))}</b>
      </p>
      {/* Only packs and tickets start the cooldown (v56): say so before they pay. */}
      <p className="text-[10px] opacity-60 pb-2">
        {suppliesOnly ? "Supplies on their own don't start your cooldown." : 'Packs and tickets start your cooldown.'}
      </p>
      <div className="flex gap-2">
        <button onClick={onBack} disabled={busy} className="flex-1 min-h-11 rounded-lg bg-[#0E1726] text-white text-xs font-bold">◀ KEEP SHOPPING</button>
        <button onClick={onPay} disabled={busy || short || lines.length === 0}
          className="flex-1 min-h-11 rounded-lg bg-[#c82030] text-white text-xs font-bold disabled:opacity-40">
          {busy ? 'PAYING…' : `PAY ${fmt(total)}`}
        </button>
      </div>
    </div>
  )
}

function DispensingScreen({ items, restocked, jammed }: { items: number; restocked: boolean; jammed: boolean }) {
  return (
    <div className="absolute inset-0 bg-white flex flex-col items-center justify-center gap-2 p-4 text-center">
      <p className="text-[10px] font-semibold tracking-wide" style={{ color: `${SCREEN_INK}b3` }}>COLLECTING</p>
      <p className="text-sm font-bold" style={{ color: SCREEN_INK }}>{items} OF {items} TOTAL ITEMS</p>
      <div className="my-2 h-px w-3/4 bg-black/20" />
      <p className="text-[10px]" style={{ color: `${SCREEN_INK}80` }}>PLEASE WAIT</p>
      {jammed && <p className="mt-2 text-[10px] font-semibold text-[#c82030]">VEND ERROR · 1 ITEM NOT DISPENSED</p>}
      {restocked && <p className="mt-2 text-[10px] font-semibold text-[#c82030]">RESTOCKING…</p>}
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
