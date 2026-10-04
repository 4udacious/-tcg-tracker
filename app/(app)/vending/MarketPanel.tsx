'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ConditionedCard from './ConditionedCard'
import HoloMark, { rarityLabel } from './HoloMark'
import { SET_NAMES } from './ShowcaseRoom'
import { num, fmt, money, takeHome, CENT } from './tokens'
import type { CollectionCard, CardCopy, UnopenedPack } from './CollectionPanel'

export interface MarketListing {
  id: number
  seller_id: string
  seller_name: string
  seller_display: string | null
  kind: 'fixed' | 'auction'
  note: string | null
  price: number
  current_bid: number | null
  is_leading: boolean
  ends_at: string | null
  status: 'active' | 'sold' | 'cancelled' | 'expired'
  created_at: string
  item_count: number
  card_count: number
  pack_count: number
  preview_image: string | null
  preview_name: string | null
  preview_grade: number | null
  bid_count: number
}

const AUCTION_HOURS = [
  { h: 6, label: '6 hours' },
  { h: 12, label: '12 hours' },
  { h: 24, label: '1 day' },
  { h: 72, label: '3 days' },
  { h: 168, label: '7 days' },
]

/** "4d 2h", "3h 10m", "ended" - tight enough for a listing tile. */
function timeLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'ending'
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ${mins % 60}m`
  return `${Math.floor(hours / 24)}d ${hours % 24}h`
}

/** What a buyer actually pays for an auction: the next legal bid. */
function minBid(l: MarketListing): number {
  return l.current_bid == null ? num(l.price) : money(num(l.current_bid) + CENT)
}

export default function MarketPanel({
  listings, myListings, collection, packs, balance, feePercent, userId,
}: {
  listings: MarketListing[]
  myListings: MarketListing[]
  collection: CollectionCard[]
  packs: UnopenedPack[]
  balance: number
  feePercent: number
  userId: string
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [tab, setTab] = useState<'browse' | 'stand'>('browse')
  const [open, setOpen] = useState<MarketListing | null>(null)
  const [composing, setComposing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const board = useMemo(
    () => listings.filter((l) => l.status === 'active' && l.seller_id !== userId),
    [listings, userId]
  )

  function fail(msg: string) { setNote(msg); setTimeout(() => setNote(null), 4000) }

  async function buy(l: MarketListing) {
    setBusy(true)
    const supabase = createClient()
    const { data, error } = await supabase.rpc('market_buy', { p_listing: l.id })
    setBusy(false)
    const row = (Array.isArray(data) ? data[0] : data) as { ok: boolean; reason: string } | null
    if (error || !row?.ok) {
      fail(
        row?.reason === 'insufficient_tokens' ? 'Not enough tokens for that.'
        : row?.reason === 'not_active' ? 'Someone just bought that.'
        : 'Could not complete that purchase.'
      )
      return
    }
    setOpen(null)
    startTransition(() => router.refresh())
  }

  async function bid(l: MarketListing, amount: number) {
    setBusy(true)
    const supabase = createClient()
    const { data, error } = await supabase.rpc('market_place_bid', {
      p_listing: l.id, p_amount: amount,
    })
    setBusy(false)
    const row = (Array.isArray(data) ? data[0] : data) as { ok: boolean; reason: string } | null
    if (error || !row?.ok) {
      fail(
        row?.reason === 'too_low' ? 'Someone has already bid that much or more.'
        : row?.reason === 'insufficient_tokens' ? 'Not enough tokens to cover that bid.'
        : row?.reason === 'already_leading' ? 'You are already the top bid.'
        : row?.reason === 'ended' ? 'That auction has finished.'
        : 'Could not place that bid.'
      )
      return
    }
    setOpen(null)
    startTransition(() => router.refresh())
  }

  async function cancel(l: MarketListing) {
    setBusy(true)
    const supabase = createClient()
    const { data, error } = await supabase.rpc('market_cancel_listing', { p_listing: l.id })
    setBusy(false)
    const row = (Array.isArray(data) ? data[0] : data) as { ok: boolean; reason: string } | null
    if (error || !row?.ok) {
      fail(row?.reason === 'has_bids'
        ? 'That auction already has a bid, so it has to run its course.'
        : 'Could not cancel that listing.')
      return
    }
    setOpen(null)
    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display font-semibold text-base">Market</h2>
        <span className="font-mono text-[10px] text-muted">{fmt(balance)} tokens</span>
      </div>

      {note && (
        <p className="text-sm text-amber-600 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
          {note}
        </p>
      )}

      <div className="flex gap-1.5">
        {([['browse', 'Browse'], ['stand', 'My stand']] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`text-xs font-medium rounded-lg px-3 py-1.5 transition-colors ${
              tab === k ? 'bg-ink text-white' : 'border border-card-border text-muted hover:text-ink'
            }`}
            aria-pressed={tab === k}
          >
            {label}
            {k === 'stand' && myListings.some((l) => l.status === 'active') && (
              <span className={tab === k ? 'text-white/60' : 'text-muted'}>
                {' '}· {myListings.filter((l) => l.status === 'active').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'browse' ? (
        board.length === 0 ? (
          <p className="text-sm text-muted">
            Nothing for sale right now. Open a stand and be the first.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-2.5">
            {board.map((l) => (
              <li key={l.id}>
                <ListingTile listing={l} onOpen={() => setOpen(l)} />
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="space-y-3">
          <button
            onClick={() => setComposing(true)}
            className="w-full bg-signal text-white font-semibold rounded-xl py-2.5 text-sm hover:bg-signal/90 transition-colors"
          >
            List something for sale
          </button>
          <p className="text-xs text-muted leading-snug">
            The market keeps {feePercent}% of every sale. Listed items leave your
            collection until they sell or you pull them.
          </p>

          {myListings.length === 0 ? (
            <p className="text-sm text-muted">Your stand is empty.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-2.5">
              {myListings.map((l) => (
                <li key={l.id}>
                  <ListingTile listing={l} mine onOpen={() => setOpen(l)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {open && (
        <ListingDetail
          listing={open} mine={open.seller_id === userId} busy={busy} balance={balance}
          feePercent={feePercent}
          onClose={() => setOpen(null)}
          onBuy={() => buy(open)} onBid={(n) => bid(open, n)} onCancel={() => cancel(open)}
        />
      )}

      {composing && (
        <Compose
          collection={collection} packs={packs} feePercent={feePercent}
          onClose={() => setComposing(false)}
          onDone={() => { setComposing(false); startTransition(() => router.refresh()) }}
          onError={fail}
        />
      )}
    </div>
  )
}

function ListingTile({ listing: l, mine, onOpen }: {
  listing: MarketListing; mine?: boolean; onOpen: () => void
}) {
  const live = l.status === 'active'
  return (
    <button
      onClick={onOpen}
      className={`w-full text-left bg-card border border-card-border rounded-xl p-2 space-y-1.5 transition-transform hover:-translate-y-0.5 ${
        live ? '' : 'opacity-60'
      }`}
    >
      <div className="relative">
        {l.preview_image ? (
          <img src={l.preview_image} alt="" className="w-full aspect-[245/342] object-contain rounded bg-paper" loading="lazy" />
        ) : (
          <div className="w-full aspect-[245/342] rounded bg-paper" />
        )}
        {l.item_count > 1 && (
          <span className="absolute -top-1 -right-1 rounded-full bg-ink text-white text-[9px] font-bold px-1.5 py-0.5 shadow">
            {l.item_count} items
          </span>
        )}
        {l.preview_grade != null && (
          <span className="absolute -bottom-1 -right-1 rounded-full bg-amber-400 text-ink text-[9px] font-bold px-1.5 py-0.5 shadow">
            {l.preview_grade}
          </span>
        )}
      </div>

      <p className="text-xs font-semibold truncate">{l.preview_name ?? 'Bundle'}</p>

      <div className="flex items-baseline justify-between gap-1">
        <span className="font-display font-bold text-sm">
          {fmt(l.kind === 'auction' ? (l.current_bid ?? l.price) : l.price)}
          <span className="font-mono text-[9px] text-muted font-normal"> tokens</span>
        </span>
        {l.kind === 'auction' && live && l.ends_at && (
          <span className={`font-mono text-[9px] ${l.is_leading ? 'text-emerald-500' : 'text-muted'}`}>
            {timeLeft(l.ends_at)}
          </span>
        )}
      </div>

      <p className="font-mono text-[9px] text-muted truncate">
        {!live ? l.status
          : l.kind === 'auction'
            ? `${l.bid_count} bid${l.bid_count === 1 ? '' : 's'}${l.is_leading ? ' · yours' : ''}`
            : 'buy now'}
        {!mine && ` · ${l.seller_display ?? l.seller_name}`}
      </p>
    </button>
  )
}

function ListingDetail({
  listing: l, mine, busy, balance, feePercent, onClose, onBuy, onBid, onCancel,
}: {
  listing: MarketListing; mine: boolean; busy: boolean; balance: number; feePercent: number
  onClose: () => void; onBuy: () => void; onBid: (n: number) => void; onCancel: () => void
}) {
  const [amount, setAmount] = useState(fmt(minBid(l)))
  const live = l.status === 'active'
  const n = Number(amount)
  const keep = takeHome(num(l.current_bid ?? l.price), feePercent)

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center"
         onClick={onClose} role="dialog" aria-modal="true" aria-label="Listing">
      <div className="bg-card w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-4 space-y-3 max-h-[85vh] overflow-y-auto"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-display font-semibold text-base truncate">
              {l.preview_name ?? 'Bundle'}
            </h3>
            <p className="font-mono text-[10px] text-muted">
              {l.card_count > 0 && `${l.card_count} card${l.card_count === 1 ? '' : 's'}`}
              {l.card_count > 0 && l.pack_count > 0 && ' · '}
              {l.pack_count > 0 && `${l.pack_count} pack${l.pack_count === 1 ? '' : 's'}`}
              {' · '}{l.seller_display ?? l.seller_name}
            </p>
          </div>
          <button onClick={onClose} className="text-xs text-muted hover:text-ink shrink-0">Close</button>
        </div>

        {l.preview_image && (
          <img src={l.preview_image} alt="" className="w-32 mx-auto aspect-[245/342] object-contain rounded bg-paper" />
        )}

        {l.note && <p className="text-sm text-muted leading-snug">{l.note}</p>}

        {!live ? (
          <p className="text-sm text-muted">This listing is {l.status}.</p>
        ) : mine ? (
          <div className="space-y-2">
            <p className="text-sm text-muted">
              {l.kind === 'auction'
                ? l.current_bid == null
                  ? `No bids yet. Opening at ${fmt(l.price)}.`
                  : `Leading bid ${fmt(l.current_bid)}. You would take home about ${fmt(keep)}.`
                : `Listed at ${fmt(l.price)}. You would take home ${fmt(keep)} after the ${feePercent}% fee.`}
            </p>
            {/* An auction with a live bid cannot be pulled, so the button
                says so rather than failing when tapped. Without a bid it is
                exactly as cancellable as a fixed-price listing. */}
            {(() => {
              const locked = l.kind === 'auction' && l.current_bid != null
              return (
                <>
                  <button
                    onClick={onCancel} disabled={busy || locked}
                    className="w-full rounded-xl border border-red-500/30 text-red-500 text-sm font-medium py-2.5 hover:bg-red-500/10 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    {busy ? 'Pulling…'
                      : locked ? 'Cannot pull - it has a bid'
                      : l.kind === 'auction' ? 'Pull this auction' : 'Pull this listing'}
                  </button>
                  <p className="text-[11px] text-muted">
                    {locked
                      ? 'Once an auction has a bid it has to run its course.'
                      : l.kind === 'auction'
                        ? 'No bids yet, so you can still take it down. Your items come straight back.'
                        : 'Your items come straight back.'}
                  </p>
                </>
              )
            })()}
          </div>
        ) : l.kind === 'fixed' ? (
          <button
            onClick={onBuy} disabled={busy || num(balance) < num(l.price)}
            className="w-full rounded-xl bg-signal text-white text-sm font-semibold py-2.5 hover:bg-signal/90 transition-colors disabled:opacity-40"
          >
            {busy ? 'Buying…'
              : num(balance) < num(l.price) ? `Need ${fmt(money(num(l.price) - num(balance)))} more tokens`
              : `Buy for ${fmt(l.price)}`}
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted">
              {l.current_bid == null ? `Opening bid ${l.price}.` : `Leading bid ${fmt(l.current_bid)}.`}
              {l.ends_at && ` Ends in ${timeLeft(l.ends_at)}.`}
            </p>
            {l.is_leading ? (
              <p className="text-sm text-emerald-600 font-medium">You are the top bid.</p>
            ) : (
              <>
                <input
                  type="number" min={minBid(l)} step="0.01" value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-paper border border-card-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-signal"
                />
                <button
                  onClick={() => onBid(n)}
                  disabled={busy || !(n >= minBid(l)) || n > num(balance)}
                  className="w-full rounded-xl bg-signal text-white text-sm font-semibold py-2.5 hover:bg-signal/90 transition-colors disabled:opacity-40"
                >
                  {busy ? 'Bidding…' : `Bid ${Number.isFinite(n) ? fmt(n) : ''}`}
                </button>
                <p className="text-[11px] text-muted leading-snug">
                  Your bid is held until someone outbids you or the auction ends.
                  Minimum {fmt(minBid(l))}.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** Building a listing: pick the goods, then say how it sells. */
function Compose({ collection, packs, feePercent, onClose, onDone, onError }: {
  collection: CollectionCard[]
  packs: UnopenedPack[]
  feePercent: number
  onClose: () => void
  onDone: () => void
  onError: (m: string) => void
}) {
  const [cards, setCards] = useState<Set<number>>(new Set())
  const [chosenPacks, setChosenPacks] = useState<Set<number>>(new Set())
  const [kind, setKind] = useState<'fixed' | 'auction'>('fixed')
  const [price, setPrice] = useState('10')
  // null = everything. 'sealed' = unopened packs. Otherwise a set code.
  const [filter, setFilter] = useState<string | null>(null)
  // One price for the lot, or a price each.
  const [split, setSplit] = useState(false)
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [hours, setHours] = useState(24)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  // Choosing the goods and choosing how they sell are two jobs; a
  // collection runs to hundreds of cards, so doing both on one sheet
  // buries the price controls under the grid.
  const [step, setStep] = useState<'pick' | 'price'>('pick')

  const copies = useMemo(() => {
    const out: { card: CollectionCard; copy: CardCopy }[] = []
    for (const card of collection) {
      for (const copy of card.copies) {
        // A card away at the graders cannot be sold out from under the grade.
        if (copy.grading_started_at && !copy.graded_at) continue
        out.push({ card, copy })
      }
    }
    return out.sort((a, b) => (b.copy.grade ?? -1) - (a.copy.grade ?? -1)
      || a.card.name.localeCompare(b.card.name))
  }, [collection])

  /** Tabs over what the seller actually owns, sealed packs included. */
  const tabs = useMemo(() => {
    const counts = new Map<string, number>()
    for (const { card } of copies) counts.set(card.set_code, (counts.get(card.set_code) ?? 0) + 1)
    const sets = [...counts.entries()]
      .map(([code, n]) => ({ code, label: SET_NAMES[code] ?? code, n }))
      .sort((a, b) => a.code.localeCompare(b.code))
    return packs.length > 0
      ? [{ code: 'sealed', label: 'Sealed', n: packs.length }, ...sets]
      : sets
  }, [copies, packs])

  const shownCopies = useMemo(
    () => (filter === null ? copies
      : filter === 'sealed' ? []
      : copies.filter((c) => c.card.set_code === filter)),
    [copies, filter]
  )
  const shownPacks = useMemo(
    () => (filter === null || filter === 'sealed' ? packs : []),
    [packs, filter]
  )

  const total = cards.size + chosenPacks.size
  const n = Number(price)
  const keep = takeHome(n, feePercent)

  /** Everything picked, in the order it will be listed. */
  const picked = useMemo(() => {
    const out: { key: string; label: string; cardId?: number; packId?: number }[] = []
    for (const { card, copy } of copies) {
      if (cards.has(copy.id)) {
        out.push({
          key: `c${copy.id}`,
          label: card.name + (copy.graded_at && copy.grade != null ? ` · ${copy.grade}` : ''),
          cardId: copy.id,
        })
      }
    }
    for (const p of packs) {
      if (chosenPacks.has(p.id)) {
        out.push({ key: `p${p.id}`, label: `${p.set_name} pack`, packId: p.id })
      }
    }
    return out
  }, [copies, packs, cards, chosenPacks])

  const priceFor = (key: string) => prices[key] ?? price

  function toggle<T>(set: Set<T>, v: T, apply: (s: Set<T>) => void) {
    const next = new Set(set)
    if (next.has(v)) next.delete(v); else next.add(v)
    apply(next)
  }

  const reasonText = (reason?: string) =>
    reason === 'bad_cards' ? 'One of those cards is no longer available.'
    : reason === 'bad_packs' ? 'One of those packs is no longer available.'
    : reason === 'empty_listing' ? 'Pick at least one thing to sell.'
    : reason === 'bad_price' ? 'Every price has to be at least 1 token.'
    : 'Could not create that listing.'

  async function createOne(
    supabase: ReturnType<typeof createClient>,
    price: number, cardIds: number[], packIds: number[]
  ) {
    const { data, error } = await supabase.rpc('market_create_listing', {
      p_kind: kind,
      p_price: price,
      p_card_ids: cardIds,
      p_pack_ids: packIds,
      p_hours: kind === 'auction' ? hours : null,
      p_note: note.trim() || null,
    })
    const row = (Array.isArray(data) ? data[0] : data) as { ok: boolean; reason: string } | null
    return { ok: !error && !!row?.ok, reason: row?.reason }
  }

  async function submit() {
    setBusy(true)
    const supabase = createClient()

    if (!split) {
      const r = await createOne(supabase, n, [...cards], [...chosenPacks])
      setBusy(false)
      if (!r.ok) { onError(reasonText(r.reason)); return }
      onDone()
      return
    }

    // Separate listings go up one at a time. There is no bulk call, so a
    // failure part-way leaves the earlier ones standing rather than rolling
    // back - better to say how many went up than to pretend it was atomic.
    let made = 0
    let firstFailure: string | undefined
    for (const item of picked) {
      const each = money(Number(priceFor(item.key)))
      if (!(each >= CENT)) { firstFailure = 'bad_price'; break }
      const r = await createOne(
        supabase, each,
        item.cardId ? [item.cardId] : [],
        item.packId ? [item.packId] : []
      )
      if (!r.ok) { firstFailure = r.reason; break }
      made += 1
    }
    setBusy(false)

    if (firstFailure) {
      onError(made > 0
        ? `Listed ${made} of ${picked.length}. ${reasonText(firstFailure)}`
        : reasonText(firstFailure))
    }
    if (made > 0) onDone()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center"
         onClick={onClose} role="dialog" aria-modal="true" aria-label="New listing">
      <div className="bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-4 space-y-3 max-h-[88vh] flex flex-col"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {step === 'price' && (
              <button
                onClick={() => setStep('pick')}
                className="text-muted hover:text-ink transition-colors"
                aria-label="Back to choosing items"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h3 className="font-display font-semibold text-base truncate">
              {step === 'pick' ? 'What are you selling?' : 'How does it sell?'}
            </h3>
          </div>
          <button onClick={onClose} className="text-xs text-muted hover:text-ink shrink-0">Close</button>
        </div>

        <div className="overflow-y-auto space-y-3 min-h-0">
        {step === 'pick' ? (
          <>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-ink">
              {total > 0
                ? <span className="text-muted">{total} picked</span>
                : 'Pick the cards or packs you want to sell.'}
            </p>
            {copies.length === 0 && packs.length === 0 ? (
              <p className="text-sm text-muted">Nothing to sell yet.</p>
            ) : (
              <>
              {tabs.length > 1 && (
                <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                  <button
                    onClick={() => setFilter(null)}
                    className={`shrink-0 text-xs font-medium rounded-lg px-2.5 py-1.5 transition-colors ${
                      filter === null ? 'bg-ink text-white'
                        : 'border border-card-border text-muted hover:text-ink'
                    }`}
                    aria-pressed={filter === null}
                  >
                    All <span className={filter === null ? 'text-white/60' : ''}>
                      {copies.length + packs.length}
                    </span>
                  </button>
                  {tabs.map((t) => (
                    <button
                      key={t.code}
                      onClick={() => setFilter(t.code)}
                      className={`shrink-0 text-xs font-medium rounded-lg px-2.5 py-1.5 transition-colors ${
                        filter === t.code ? 'bg-ink text-white'
                          : 'border border-card-border text-muted hover:text-ink'
                      }`}
                      aria-pressed={filter === t.code}
                    >
                      {t.label} <span className={filter === t.code ? 'text-white/60' : ''}>{t.n}</span>
                    </button>
                  ))}
                </div>
              )}
              <ul className="grid grid-cols-4 gap-2">
                {/* Selected cards get a white ring with a dark halo: the
                    white reads against the card's yellow border, the halo
                    reads against the sheet behind it in either theme. */}
                {shownCopies.map(({ card, copy }) => {
                  const on = cards.has(copy.id)
                  return (
                    <li key={copy.id}>
                      <button
                        onClick={() => toggle(cards, copy.id, setCards)}
                        className={`relative block w-full rounded transition-all ${
                          on ? 'ring-2 ring-white scale-95 shadow-[0_0_0_4px_rgba(15,23,42,0.45)]' : ''
                        }`}
                        aria-pressed={on}
                        aria-label={`${on ? 'Remove' : 'Add'} ${card.name}` + rarityLabel(card.rarity)
                          + (copy.graded_at && copy.grade != null ? `, graded ${copy.grade}` : '')}
                      >
                        <ConditionedCard
                          src={card.image_url} alt={card.name} condition={copy}
                          rarity={card.rarity}
                          className="w-full aspect-[245/342] rounded"
                        />
                        <HoloMark rarity={card.rarity} />
                        {copy.grade != null && copy.graded_at && (
                          <span className="absolute -top-1 -right-1 rounded-full bg-amber-400 text-ink text-[9px] font-bold px-1 shadow">
                            {copy.grade}
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
                {shownPacks.map((p) => {
                  const on = chosenPacks.has(p.id)
                  return (
                    <li key={`p${p.id}`}>
                      <button
                        onClick={() => toggle(chosenPacks, p.id, setChosenPacks)}
                        className={`relative block w-full rounded transition-all ${
                          on ? 'ring-2 ring-white scale-95 shadow-[0_0_0_4px_rgba(15,23,42,0.45)]' : ''
                        }`}
                        aria-pressed={on}
                        aria-label={`${on ? 'Remove' : 'Add'} sealed ${p.set_name} pack`}
                      >
                        <img src={p.image_url} alt="" className="w-full aspect-[245/342] object-contain rounded bg-paper" />
                        <span className="absolute inset-x-0 bottom-0 bg-ink/80 text-white text-[8px] font-mono text-center py-0.5 rounded-b">
                          sealed
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              </>
            )}
          </div>
          </>
        ) : (
          <>

          {/* What you are selling, so step two is not a decision made blind. */}
          <p className="text-xs text-muted leading-snug">
            Selling{' '}
            <span className="text-ink font-medium">
              {picked.length === 1 ? picked[0].label : `${picked.length} items`}
            </span>
            {picked.length > 1 && <span> — {picked.map((i) => i.label).join(', ')}</span>}
          </p>

          <div className="flex gap-1.5">
            {([['fixed', 'Buy now'], ['auction', 'Auction']] as const).map(([k, label]) => (
              <button
                key={k} onClick={() => setKind(k)}
                className={`flex-1 text-xs font-medium rounded-lg px-3 py-2 transition-colors ${
                  kind === k ? 'bg-ink text-white' : 'border border-card-border text-muted hover:text-ink'
                }`}
                aria-pressed={kind === k}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Only a choice once there is more than one thing in the basket. */}
          {total > 1 && (
            <div className="flex gap-1.5">
              {([[false, 'One bundle'], [true, 'Price each']] as const).map(([v, label]) => (
                <button
                  key={label} onClick={() => setSplit(v)}
                  className={`flex-1 text-xs font-medium rounded-lg px-2 py-2 transition-colors ${
                    split === v ? 'bg-ink text-white'
                      : 'border border-card-border text-muted hover:text-ink'
                  }`}
                  aria-pressed={split === v}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {split && total > 1 ? (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-ink">
                {kind === 'auction' ? 'Opening bid each' : 'Price each'}
              </label>
              <ul className="space-y-1.5">
                {picked.map((item) => {
                  const each = money(Number(priceFor(item.key)))
                  return (
                    <li key={item.key} className="flex items-center gap-2">
                      <span className="flex-1 text-sm truncate">{item.label}</span>
                      <input
                        type="number" min={CENT} step="0.01" value={priceFor(item.key)}
                        onChange={(e) => setPrices((p) => ({ ...p, [item.key]: e.target.value }))}
                        aria-label={`Price for ${item.label}`}
                        className="w-20 bg-paper border border-card-border rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:border-signal"
                      />
                      <span className="w-16 text-right font-mono text-[10px] text-muted">
                        {each >= CENT ? `keep ${fmt(takeHome(each, feePercent))}` : '—'}
                      </span>
                    </li>
                  )
                })}
              </ul>
              <p className="text-[11px] text-muted">
                {picked.length} separate listings. Each sells on its own.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-xs font-medium text-ink">
                {kind === 'auction' ? 'Opening bid' : 'Price'}
                {total > 1 && <span className="text-muted"> for all {total}</span>}
              </label>
              <input
                type="number" min={CENT} step="0.01" value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-paper border border-card-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-signal"
              />
              {n > 0 && (
                <p className="text-[11px] text-muted">
                  You keep {fmt(keep)} after the {feePercent}% market fee.
                </p>
              )}
            </div>
          )}

          {kind === 'auction' && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-ink">Runs for</p>
              <div className="flex flex-wrap gap-1.5">
                {AUCTION_HOURS.map((o) => (
                  <button
                    key={o.h} onClick={() => setHours(o.h)}
                    className={`text-xs font-medium rounded-lg px-2.5 py-1.5 transition-colors ${
                      hours === o.h ? 'bg-ink text-white' : 'border border-card-border text-muted hover:text-ink'
                    }`}
                    aria-pressed={hours === o.h}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-ink">Note <span className="text-muted">(optional)</span></label>
            <input
              value={note} onChange={(e) => setNote(e.target.value)} maxLength={200}
              placeholder="Anything a buyer should know"
              className="w-full bg-paper border border-card-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-signal placeholder:text-muted"
            />
          </div>
          </>
        )}
        </div>

        <button
          onClick={step === 'pick' ? () => setStep('price') : submit}
          disabled={
            busy || total === 0 ||
            (step === 'price' && !split && !(n >= CENT))
          }
          className="shrink-0 w-full rounded-xl bg-signal text-white text-sm font-semibold py-2.5 hover:bg-signal/90 transition-colors disabled:opacity-40"
        >
          {busy ? 'Listing…'
            : total === 0 ? 'Pick something to sell'
            : step === 'pick' ? `Continue with ${total} item${total === 1 ? '' : 's'}`
            : split && total > 1 ? `Put up ${picked.length} listings`
            : kind === 'auction' ? `Start the auction at ${fmt(n)}` : `List for ${fmt(n)}`}
        </button>
        <p className="shrink-0 text-[11px] text-muted leading-snug">
          Listed items leave your collection straight away and come back if the
          listing is pulled or ends without a sale.
        </p>
      </div>
    </div>
  )
}
