'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sheet } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import ConditionedCard, { type Condition } from './ConditionedCard'
import HoloMark, { rarityLabel } from './HoloMark'
import { SET_NAMES } from './ShowcaseRoom'
import { num, fmt, money } from './tokens'
import type { CollectionCard, UnopenedPack, OwnedBox } from './CollectionPanel'

/* ───────────── types (as the v100 functions return them) ───────────── */

export type TradeItem =
  | { kind: 'card'; id: number; card_id: number; name: string; set_code: string; number: string; rarity: string; image_url: string; grade: number | null; condition: Condition }
  | { kind: 'pack'; id: number; name: string; set_name: string; image_url: string | null }
  | { kind: 'box'; id: number; name: string; set_code: string; image_url: string | null; packs: number }

export interface BinderSummary {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  note: string | null
  items: number
  images: string[] | null
}

export interface Binder {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  note: string | null
  items: TradeItem[]
}

export interface TradeOffer {
  id: number
  /** Made to you (true) or by you. */
  incoming: boolean
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'countered' | 'failed'
  reason: string | null
  note: string | null
  /** Tokens the proposer pays, and the tokens they ask for. */
  tokens_from: number
  tokens_to: number
  counter_of: number | null
  created_at: string
  resolved_at: string | null
  unseen: boolean
  other: { id: string; username: string; display_name: string | null; avatar_url: string | null }
  /** What the proposer gives, and what they asked for. */
  give: TradeItem[]
  get: TradeItem[]
}

type Member = { id?: string; user_id?: string; username: string; display_name: string | null; avatar_url: string | null }

const MAX_SIDE = 25
const MAX_TOKENS = 1000

const keyOf = (i: { kind: string; id: number }) => `${i.kind}:${i.id}`
const nameOf = (m: Member) => m.display_name || `@${m.username}`

/** The ids an offer sends, split by kind, from a list of items. */
function idsOf(items: TradeItem[]) {
  return {
    cards: items.filter((i) => i.kind === 'card').map((i) => i.id),
    packs: items.filter((i) => i.kind === 'pack').map((i) => i.id),
    boxes: items.filter((i) => i.kind === 'box').map((i) => i.id),
  }
}

function itemLabel(i: TradeItem) {
  if (i.kind === 'card') return i.name + (i.grade != null ? ` · ${i.grade}` : '')
  if (i.kind === 'pack') return `${i.set_name} pack`
  return `${i.name} (sealed)`
}

/** Your collection as trade items: cards free to trade (not at the graders or cleaners), unopened packs and boxes. */
function collectionItems(collection: CollectionCard[], packs: UnopenedPack[], boxes: OwnedBox[]): TradeItem[] {
  const out: TradeItem[] = []
  for (const b of boxes) out.push({ kind: 'box', id: b.id, name: b.name, set_code: b.set_code, image_url: b.image_url, packs: b.packs })
  for (const card of collection) {
    for (const c of card.copies) {
      if (c.grading_started_at && !c.graded_at) continue
      if (c.cleaning_started_at) continue
      out.push({
        kind: 'card', id: c.id, card_id: card.card_id, name: card.name, set_code: card.set_code, number: card.number,
        rarity: card.rarity, image_url: card.image_url, grade: c.graded_at ? c.grade : null, condition: c,
      })
    }
  }
  for (const p of packs) out.push({ kind: 'pack', id: p.id, name: p.pack_name, set_name: p.set_name, image_url: p.image_url })
  return out
}

function ago(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 60) return `${Math.max(1, m)}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)

/* ───────────── small pieces ───────────── */

function Avatar({ m, size = 32 }: { m: Member; size?: number }) {
  return m.avatar_url
    ? <img src={m.avatar_url} alt="" width={size} height={size} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
    : (
      <span className="rounded-full bg-ink text-white font-display font-semibold inline-flex items-center justify-center shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.42 }}>
        {(m.display_name || m.username || '?').slice(0, 1).toUpperCase()}
      </span>
    )
}

/** One card, pack or box, the way the Market's picker shows them. */
function ItemTile({ item, on, onClick, small = false }: { item: TradeItem; on?: boolean; onClick?: () => void; small?: boolean }) {
  const body = item.kind === 'card' ? (
    <>
      <ConditionedCard src={item.image_url} alt={item.name} condition={item.condition} rarity={item.rarity} className="w-full aspect-[245/342] rounded" />
      {!small && <HoloMark rarity={item.rarity} setCode={item.image_url} />}
      {item.grade != null && (
        <span className="absolute -top-1 -right-1 rounded-full bg-amber-400 text-ink text-[10px] font-bold px-1 shadow">{item.grade}</span>
      )}
    </>
  ) : (
    <>
      <div className="w-full aspect-[245/342] rounded bg-paper flex items-center justify-center overflow-hidden">
        {item.image_url && <img src={item.image_url} alt="" className="w-full object-contain" />}
      </div>
      <span className="absolute inset-x-0 bottom-0 bg-ink/80 text-white text-[10px] font-mono text-center py-0.5 rounded-b">
        {item.kind === 'box' ? 'sealed box' : 'sealed'}
      </span>
    </>
  )
  const label = item.kind === 'card'
    ? item.name + rarityLabel(item.rarity, item.image_url) + (item.grade != null ? `, graded ${item.grade}` : '')
    : item.kind === 'box' ? `sealed ${item.name}, ${item.packs} packs` : `sealed ${item.set_name} pack`
  if (!onClick) return <div className="relative" title={label}>{body}</div>
  return (
    <button
      type="button" onClick={onClick} aria-pressed={on} aria-label={`${on ? 'Remove' : 'Add'} ${label}`}
      className={`relative block w-full rounded transition-all ${on ? 'ring-2 ring-white scale-95 shadow-[0_0_0_4px_rgba(15,23,42,0.45)]' : ''}`}
    >
      {body}
    </button>
  )
}

/** A grid of items with tabs per set (and Sealed), each tappable to pick. */
function PickGrid({ items, picked, onToggle, empty }: { items: TradeItem[]; picked: Set<string>; onToggle: (i: TradeItem) => void; empty: string }) {
  const [filter, setFilter] = useState<string | null>(null)
  const tabs = useMemo(() => {
    const counts = new Map<string, number>()
    let sealed = 0
    for (const i of items) {
      if (i.kind === 'card') counts.set(i.set_code, (counts.get(i.set_code) ?? 0) + 1)
      else sealed++
    }
    const sets = [...counts.entries()].map(([code, n]) => ({ code, label: SET_NAMES[code] ?? code, n })).sort((a, b) => a.code.localeCompare(b.code))
    return sealed > 0 ? [{ code: 'sealed', label: 'Sealed', n: sealed }, ...sets] : sets
  }, [items])
  const shown = useMemo(() => (filter === null ? items
    : filter === 'sealed' ? items.filter((i) => i.kind !== 'card')
    : items.filter((i) => i.kind === 'card' && i.set_code === filter)), [items, filter])
  if (items.length === 0) return <p className="text-sm text-muted">{empty}</p>
  const chip = (on: boolean) => `shrink-0 text-xs font-medium rounded-lg px-2.5 py-1.5 transition-colors ${on ? 'bg-ink text-white' : 'border border-card-border text-muted hover:text-ink'}`
  return (
    <div className="space-y-2">
      {tabs.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          <button type="button" onClick={() => setFilter(null)} className={chip(filter === null)} aria-pressed={filter === null}>
            All <span className={filter === null ? 'text-white/60' : ''}>{items.length}</span>
          </button>
          {tabs.map((t) => (
            <button key={t.code} type="button" onClick={() => setFilter(t.code)} className={chip(filter === t.code)} aria-pressed={filter === t.code}>
              {t.label} <span className={filter === t.code ? 'text-white/60' : ''}>{t.n}</span>
            </button>
          ))}
        </div>
      )}
      <ul className="grid grid-cols-4 gap-2">
        {shown.map((i) => (
          <li key={keyOf(i)}><ItemTile item={i} on={picked.has(keyOf(i))} onClick={() => onToggle(i)} /></li>
        ))}
      </ul>
    </div>
  )
}

/** A row of small thumbnails and a tokens chip: one side of an offer. */
function SideRow({ label, items, tokens }: { label: string; items: TradeItem[]; tokens: number }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-muted">{label}</p>
      {items.length === 0 && tokens <= 0 ? <p className="text-xs text-muted">Nothing</p> : (
        <div className="flex flex-wrap items-end gap-1.5">
          {items.map((i) => (
            <div key={keyOf(i)} className="w-12"><ItemTile item={i} small /></div>
          ))}
          {tokens > 0 && (
            <span className="rounded-lg bg-amber-100 text-amber-900 dark:bg-amber-400/20 dark:text-amber-200 text-xs font-mono font-semibold px-2 py-1">
              {fmt(tokens)} tk
            </span>
          )}
        </div>
      )}
      {items.length > 0 && <p className="text-[11px] text-muted leading-snug">{items.map(itemLabel).join(', ')}</p>}
    </div>
  )
}

/* ───────────── the panel ───────────── */

export default function TradesPanel({
  binders, myBinder, offers, collection, packs, boxes, balance, userId, initialBinder = null,
}: {
  binders: BinderSummary[]
  myBinder: Binder | null
  offers: TradeOffer[]
  collection: CollectionCard[]
  packs: UnopenedPack[]
  boxes: OwnedBox[]
  balance: number
  userId: string
  /** A member's binder to open on arrival (/trades?u=…). */
  initialBinder?: Binder | null
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const toast = useToast()
  const refresh = () => startTransition(() => router.refresh())

  const unseen = offers.filter((o) => o.unseen).length
  const waiting = offers.filter((o) => o.incoming && o.status === 'pending').length
  const [tab, setTab] = useState<'browse' | 'mine' | 'offers'>(initialBinder ? 'browse' : waiting > 0 ? 'offers' : 'browse')
  const [viewing, setViewing] = useState<Binder | null>(initialBinder && initialBinder.user_id !== userId ? initialBinder : null)
  const [compose, setCompose] = useState<{ to: Member & { id: string }; want: TradeItem[]; offerable: TradeItem[]; give?: TradeItem[]; tokensGive?: number; tokensGet?: number; counterOf?: number } | null>(null)
  const [loading, setLoading] = useState<string | null>(null)

  const mine = useMemo(() => collectionItems(collection, packs, boxes), [collection, packs, boxes])
  const others = binders.filter((b) => b.user_id !== userId)

  // Opening Offers clears its badge (the new ones are still marked until you leave).
  useEffect(() => {
    if (tab !== 'offers' || unseen === 0) return
    createClient().rpc('trade_mark_seen').then(() => refresh())
  }, [tab])

  async function openBinder(id: string) {
    setLoading(id)
    const { data, error } = await createClient().rpc('trade_binder', { p_user: id })
    setLoading(null)
    const b = one(data as Binder | Binder[] | null)
    if (error || !b) { toast.error('Could not open that binder.'); return }
    setViewing(b)
  }

  async function respond(o: TradeOffer, accept: boolean) {
    const { data, error } = await createClient().rpc('trade_respond', { p_offer: o.id, p_accept: accept })
    const row = one(data as { ok: boolean; reason: string } | null)
    if (error || !row?.ok) {
      toast.error(
        row?.reason === 'unavailable' ? 'Something in that trade is no longer available, so it fell through.'
        : row?.reason === 'insufficient_tokens' ? 'One of you no longer has the tokens for it, so it fell through.'
        : row?.reason === 'not_pending' ? 'That offer has already been answered.'
        : 'Could not answer that offer.')
    } else toast.ok(accept ? 'Trade done! Check your collection.' : 'Offer declined.')
    refresh()
  }

  async function withdraw(o: TradeOffer) {
    const { data } = await createClient().rpc('trade_cancel', { p_offer: o.id })
    if (data) toast.ok('Offer withdrawn.'); else toast.error('That offer has already been answered.')
    refresh()
  }

  /** Counter: swap sides, starting from what they offered and asked for; their binder is there to add to. */
  async function counter(o: TradeOffer) {
    setLoading(`o${o.id}`)
    const { data } = await createClient().rpc('trade_binder', { p_user: o.other.id })
    setLoading(null)
    const theirs = one(data as Binder | Binder[] | null)?.items ?? []
    const offered = new Set(o.give.map(keyOf))
    setCompose({
      to: { ...o.other }, counterOf: o.id,
      want: o.give, offerable: [...o.give, ...theirs.filter((i) => !offered.has(keyOf(i)))],
      give: o.get, tokensGive: num(o.tokens_to), tokensGet: num(o.tokens_from),
    })
  }

  const tabBtn = (k: typeof tab, label: string, badge = 0) => (
    <button key={k} onClick={() => { setTab(k); if (k !== 'browse') setViewing(null) }} aria-pressed={tab === k}
      className={`text-xs font-medium rounded-lg px-3 py-1.5 transition-colors inline-flex items-center gap-1.5 ${tab === k ? 'bg-ink text-white' : 'border border-card-border text-muted hover:text-ink'}`}>
      {label}
      {badge > 0 && <span className="min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-signal text-white font-mono text-[10px] font-bold inline-flex items-center justify-center">{badge}</span>}
    </button>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display font-semibold text-base">Trades</h2>
        <span className="font-mono text-[10px] text-muted">{fmt(balance)} tokens</span>
      </div>
      <div className="flex gap-1.5">
        {tabBtn('browse', 'Binders')}
        {tabBtn('mine', 'My binder')}
        {tabBtn('offers', 'Offers', unseen)}
      </div>

      {tab === 'browse' && (viewing ? (
        <BinderView binder={viewing} onBack={() => setViewing(null)}
          onOffer={(want) => setCompose({ to: { ...viewing, id: viewing.user_id }, want, offerable: viewing.items })} />
      ) : (
        <section className="space-y-2">
          <p className="text-xs text-muted leading-snug">
            Members&apos; trade binders: open one, pick what you&apos;d like, and offer your own cards, sealed product or tokens for it.
          </p>
          {others.length === 0 ? <p className="text-sm text-muted">No one has put anything in a trade binder yet. Be the first: My binder.</p> : (
            <ul className="space-y-2">
              {others.map((b) => (
                <li key={b.user_id}>
                  <button type="button" onClick={() => openBinder(b.user_id)} disabled={loading === b.user_id}
                    className="w-full text-left bg-card border border-card-border rounded-xl px-3 py-2.5 flex items-center gap-3 hover:border-ink/30 transition-colors disabled:opacity-60">
                    <Avatar m={b} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium truncate">{nameOf(b)}</span>
                      <span className="block text-[11px] text-muted truncate">{b.note ? `Looking for: ${b.note}` : `${b.items} item${b.items === 1 ? '' : 's'} to trade`}</span>
                    </span>
                    <span className="flex -space-x-3 shrink-0">
                      {(b.images ?? []).slice(0, 3).map((src, i) => (
                        <img key={i} src={src} alt="" className="w-7 aspect-[245/342] object-cover rounded-sm border border-card shadow" />
                      ))}
                    </span>
                    <span className="font-mono text-[11px] text-muted shrink-0">{b.items}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {tab === 'mine' && <MyBinder binder={myBinder} mine={mine} onChanged={refresh} />}

      {tab === 'offers' && (
        <section className="space-y-2">
          {offers.length === 0 ? <p className="text-sm text-muted">No offers yet. Open someone&apos;s binder to make one.</p> : (
            <ul className="space-y-2">
              {offers.map((o) => <OfferCard key={o.id} o={o} busy={loading === `o${o.id}`}
                onAccept={() => respond(o, true)} onDecline={() => respond(o, false)} onCounter={() => counter(o)} onWithdraw={() => withdraw(o)} />)}
            </ul>
          )}
        </section>
      )}

      {compose && (
        <Propose
          to={compose.to} want={compose.want} offerable={compose.offerable} mine={mine} balance={balance}
          initialGive={compose.give} initialTokensGive={compose.tokensGive} initialTokensGet={compose.tokensGet} counterOf={compose.counterOf}
          onClose={() => setCompose(null)}
          onSent={() => { setCompose(null); setViewing(null); setTab('offers'); toast.ok('Offer sent.'); refresh() }}
          onError={(m) => toast.error(m)}
        />
      )}
    </div>
  )
}

/* ───────────── someone's binder ───────────── */

function BinderView({ binder, onBack, onOffer }: { binder: Binder; onBack: () => void; onOffer: (want: TradeItem[]) => void }) {
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const toggle = (i: TradeItem) => setPicked((s) => { const n = new Set(s); if (n.has(keyOf(i))) n.delete(keyOf(i)); else if (n.size < MAX_SIDE) n.add(keyOf(i)); return n })
  return (
    <section className="space-y-3">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 min-h-10 text-sm text-muted hover:text-ink transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        All binders
      </button>
      <div className="flex items-center gap-3">
        <Avatar m={binder} size={40} />
        <div className="min-w-0">
          <h3 className="font-display font-semibold text-base truncate">{nameOf(binder)}&apos;s binder</h3>
          {binder.note && <p className="text-xs text-muted leading-snug">Looking for: {binder.note}</p>}
        </div>
      </div>
      <p className="text-xs text-muted">{picked.size > 0 ? `${picked.size} picked` : 'Tap what you’d like, then make an offer.'}</p>
      <PickGrid items={binder.items} picked={picked} onToggle={toggle} empty="Nothing in this binder right now." />
      {picked.size > 0 && (
        <div className="sticky bottom-20 z-10">
          <button type="button" onClick={() => onOffer(binder.items.filter((i) => picked.has(keyOf(i))))}
            className="w-full min-h-11 rounded-xl bg-signal text-white text-sm font-semibold shadow-lg">
            Make an offer for {picked.size} item{picked.size === 1 ? '' : 's'}
          </button>
        </div>
      )}
    </section>
  )
}

/* ───────────── your binder ───────────── */

function MyBinder({ binder, mine, onChanged }: { binder: Binder | null; mine: TradeItem[]; onChanged: () => void }) {
  const toast = useToast()
  const items = binder?.items ?? []
  const inBinder = useMemo(() => new Set(items.map(keyOf)), [items])
  const [note, setNote] = useState(binder?.note ?? '')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const toggle = (i: TradeItem) => setPicked((s) => { const n = new Set(s); if (n.has(keyOf(i))) n.delete(keyOf(i)); else n.add(keyOf(i)); return n })

  async function set(chosen: TradeItem[], add: boolean) {
    setBusy(true)
    const ids = idsOf(chosen)
    const { error } = await createClient().rpc('trade_binder_set', { p_card_ids: ids.cards, p_pack_ids: ids.packs, p_box_ids: ids.boxes, p_add: add })
    setBusy(false)
    if (error) { toast.error('Could not update your binder.'); return false }
    onChanged(); return true
  }

  async function saveNote() {
    const { error } = await createClient().rpc('trade_binder_set_note', { p_note: note })
    if (error) toast.error('Could not save that.'); else { toast.ok('Saved.'); onChanged() }
  }

  return (
    <section className="space-y-3">
      <p className="text-xs text-muted leading-snug">
        What you&apos;re open to trading. Members can browse it and send you offers; nothing leaves your collection unless you accept one.
        Anything you list on the Market, send to the graders or cleaners, or open drops out of view while it&apos;s away.
      </p>
      <div className="flex gap-2">
        <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 200))} placeholder="Looking for… (e.g. Base Set holos, sealed Neo)"
          className="min-w-0 flex-1 rounded-xl border border-card-border bg-card px-3 py-2 text-sm" aria-label="What you're looking for" />
        <button type="button" onClick={saveNote} disabled={(binder?.note ?? '') === note.trim()}
          className="shrink-0 rounded-xl border border-card-border px-3 text-xs font-medium disabled:opacity-40">Save</button>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{items.length} item{items.length === 1 ? '' : 's'} in your binder</p>
        <div className="flex gap-1.5">
          {picked.size > 0 && (
            <button type="button" disabled={busy} onClick={async () => { if (await set(items.filter((i) => picked.has(keyOf(i))), false)) setPicked(new Set()) }}
              className="text-xs font-medium rounded-lg px-3 py-1.5 border border-card-border text-signal">Take out {picked.size}</button>
          )}
          <button type="button" onClick={() => setAdding(true)} className="text-xs font-medium rounded-lg px-3 py-1.5 bg-ink text-white">Add</button>
        </div>
      </div>
      <PickGrid items={items} picked={picked} onToggle={toggle} empty="Your binder is empty. Add cards, packs or boxes you'd trade." />
      {adding && (
        <AddSheet mine={mine.filter((i) => !inBinder.has(keyOf(i)))} busy={busy} onClose={() => setAdding(false)}
          onAdd={async (chosen) => { if (await set(chosen, true)) { setAdding(false); toast.ok(`Added ${chosen.length} to your binder.`) } }} />
      )}
    </section>
  )
}

function AddSheet({ mine, busy, onClose, onAdd }: { mine: TradeItem[]; busy: boolean; onClose: () => void; onAdd: (items: TradeItem[]) => void }) {
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const toggle = (i: TradeItem) => setPicked((s) => { const n = new Set(s); if (n.has(keyOf(i))) n.delete(keyOf(i)); else n.add(keyOf(i)); return n })
  return (
    <Sheet open onClose={onClose} wide title="Add to your binder" footer={(
      <button type="button" disabled={busy || picked.size === 0} onClick={() => onAdd(mine.filter((i) => picked.has(keyOf(i))))}
        className="w-full min-h-11 rounded-xl bg-ink text-white text-sm font-semibold disabled:opacity-40">
        {picked.size > 0 ? `Add ${picked.size}` : 'Pick what to add'}
      </button>
    )}>
      <PickGrid items={mine} picked={picked} onToggle={toggle} empty="Nothing left to add: everything you own is already in your binder (or away)." />
    </Sheet>
  )
}

/* ───────────── making an offer ───────────── */

function Propose({ to, want, offerable, mine, balance, initialGive, initialTokensGive = 0, initialTokensGet = 0, counterOf, onClose, onSent, onError }: {
  to: Member & { id: string }
  want: TradeItem[]
  /** Everything you can ask for: their binder (and, countering, what they offered). */
  offerable: TradeItem[]
  mine: TradeItem[]
  balance: number
  initialGive?: TradeItem[]
  initialTokensGive?: number
  initialTokensGet?: number
  counterOf?: number
  onClose: () => void
  onSent: () => void
  onError: (m: string) => void
}) {
  const [step, setStep] = useState<'give' | 'review'>(counterOf ? 'review' : 'give')
  const [get, setGet] = useState<Set<string>>(new Set(want.map(keyOf)))
  const [give, setGive] = useState<Set<string>>(new Set((initialGive ?? []).map(keyOf)))
  const [tokensGive, setTokensGive] = useState(initialTokensGive ? String(initialTokensGive) : '')
  const [tokensGet, setTokensGet] = useState(initialTokensGet ? String(initialTokensGet) : '')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<'give' | 'get' | null>(null)

  // Your side: your collection, plus whatever a counter-offer starts you with (their ask may include things you still own).
  const myItems = useMemo(() => {
    const seen = new Set(mine.map(keyOf))
    return [...mine, ...(initialGive ?? []).filter((i) => !seen.has(keyOf(i)))]
  }, [mine, initialGive])
  const giveItems = myItems.filter((i) => give.has(keyOf(i)))
  const getItems = offerable.filter((i) => get.has(keyOf(i)))
  const tg = money(Number(tokensGive) || 0), tw = money(Number(tokensGet) || 0)
  const toggle = (setter: typeof setGive) => (i: TradeItem) => setter((s) => { const n = new Set(s); if (n.has(keyOf(i))) n.delete(keyOf(i)); else if (n.size < MAX_SIDE) n.add(keyOf(i)); return n })

  const problem = (giveItems.length === 0 && tg <= 0) ? 'Offer something: a card, sealed product or tokens.'
    : (getItems.length === 0 && tw <= 0) ? 'Ask for something in return.'
    : tg > balance ? `You only have ${fmt(balance)} tokens.`
    : tg > MAX_TOKENS || tw > MAX_TOKENS ? `Up to ${MAX_TOKENS} tokens each way.`
    : null

  async function send() {
    setBusy(true)
    const g = idsOf(giveItems), w = idsOf(getItems)
    const { data, error } = await createClient().rpc('trade_propose', {
      p_to: to.id, p_give_cards: g.cards, p_give_packs: g.packs, p_give_boxes: g.boxes,
      p_get_cards: w.cards, p_get_packs: w.packs, p_get_boxes: w.boxes,
      p_tokens_give: tg, p_tokens_get: tw, p_note: note.trim() || null, p_counter_of: counterOf ?? null,
    })
    setBusy(false)
    const row = one(data as { ok: boolean; reason: string } | null)
    if (error || !row?.ok) {
      onError(
        row?.reason === 'bad_give' ? 'Something you offered is no longer free to trade.'
        : row?.reason === 'bad_get' ? 'Something you asked for has left their binder.'
        : row?.reason === 'insufficient_tokens' ? 'You don’t have that many tokens.'
        : row?.reason === 'too_many_offers' ? 'You have 20 offers waiting already. Withdraw one first.'
        : row?.reason === 'not_counterable' ? 'That offer has already been answered.'
        : row?.reason === 'one_sided' ? 'Both sides need something.'
        : 'Could not send that offer.')
      return
    }
    onSent()
  }

  const title = counterOf ? `Counter ${nameOf(to)}` : `Offer to ${nameOf(to)}`
  const tokenInput = (v: string, set: (s: string) => void, label: string) => (
    <label className="flex items-center gap-2 text-xs">
      <span className="text-muted shrink-0">{label}</span>
      <input inputMode="decimal" value={v} onChange={(e) => set(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0"
        className="w-24 rounded-lg border border-card-border bg-card px-2 py-1.5 font-mono text-sm" />
      <span className="text-muted">tokens</span>
    </label>
  )

  if (editing) {
    const isGive = editing === 'give'
    return (
      <Sheet open onClose={() => setEditing(null)} wide title={isGive ? 'What you give' : 'What you ask for'} footer={(
        <button type="button" onClick={() => setEditing(null)} className="w-full min-h-11 rounded-xl bg-ink text-white text-sm font-semibold">Done</button>
      )}>
        <PickGrid items={isGive ? myItems : offerable} picked={isGive ? give : get} onToggle={toggle(isGive ? setGive : setGet)}
          empty={isGive ? 'You have nothing free to trade.' : 'Nothing to ask for.'} />
      </Sheet>
    )
  }

  return (
    <Sheet open onClose={onClose} wide title={title} footer={step === 'give' ? (
      <button type="button" onClick={() => setStep('review')} className="w-full min-h-11 rounded-xl bg-ink text-white text-sm font-semibold">
        {give.size > 0 ? `Next: review (${give.size} picked)` : 'Next: review'}
      </button>
    ) : (
      <div className="space-y-1.5">
        {problem && <p className="text-xs text-signal">{problem}</p>}
        <button type="button" disabled={busy || !!problem} onClick={send} className="w-full min-h-11 rounded-xl bg-signal text-white text-sm font-semibold disabled:opacity-40">
          {busy ? 'Sending…' : counterOf ? 'Send counter-offer' : 'Send offer'}
        </button>
      </div>
    )}>
      {step === 'give' ? (
        <div className="space-y-3">
          <p className="text-xs text-muted leading-snug">
            You&apos;re asking for {getItems.length === 1 ? itemLabel(getItems[0]) : `${getItems.length} items`}. What will you offer? Pick cards or sealed product, and add tokens on the next step.
          </p>
          <PickGrid items={myItems} picked={give} onToggle={toggle(setGive)} empty="You have nothing free to trade, but you can offer tokens." />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2 rounded-xl border border-card-border p-3">
            <SideRow label="You give" items={giveItems} tokens={tg} />
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => setEditing('give')} className="text-xs font-medium underline">Change</button>
              {tokenInput(tokensGive, setTokensGive, 'plus')}
            </div>
          </div>
          <div className="space-y-2 rounded-xl border border-card-border p-3">
            <SideRow label={`You get from ${nameOf(to)}`} items={getItems} tokens={tw} />
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => setEditing('get')} className="text-xs font-medium underline">Change</button>
              {tokenInput(tokensGet, setTokensGet, 'plus')}
            </div>
          </div>
          <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 200))} rows={2} placeholder="A note (optional)"
            className="w-full rounded-xl border border-card-border bg-card px-3 py-2 text-sm" />
          <p className="text-[11px] text-muted leading-snug">
            Nothing is held while they decide. If they accept, everything is checked again and swaps at once; if something&apos;s gone by then, the offer falls through and nothing moves. No fee.
          </p>
        </div>
      )}
    </Sheet>
  )
}

/* ───────────── an offer ───────────── */

const STATUS: Record<TradeOffer['status'], string> = {
  pending: 'Waiting', accepted: 'Traded', declined: 'Declined', cancelled: 'Withdrawn', countered: 'Countered', failed: 'Fell through',
}

function OfferCard({ o, busy, onAccept, onDecline, onCounter, onWithdraw }: {
  o: TradeOffer; busy: boolean; onAccept: () => void; onDecline: () => void; onCounter: () => void; onWithdraw: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  // From your side: what you'd give and get.
  const youGive = o.incoming ? o.get : o.give, youGet = o.incoming ? o.give : o.get
  const tokGive = num(o.incoming ? o.tokens_to : o.tokens_from), tokGet = num(o.incoming ? o.tokens_from : o.tokens_to)
  const pending = o.status === 'pending'
  return (
    <li className={`bg-card border rounded-xl px-3 py-2.5 space-y-2.5 ${o.unseen ? 'border-signal/60' : 'border-card-border'}`}>
      <div className="flex items-center gap-2">
        <Avatar m={o.other} size={28} />
        <p className="min-w-0 flex-1 text-sm truncate">
          {o.incoming ? <><span className="font-medium">{nameOf(o.other)}</span> offered you</> : <>You offered <span className="font-medium">{nameOf(o.other)}</span></>}
          {o.counter_of && <span className="text-muted"> · counter</span>}
        </p>
        <span className={`text-[11px] font-medium shrink-0 ${o.status === 'accepted' ? 'text-emerald-600' : pending ? 'text-signal' : 'text-muted'}`}>{STATUS[o.status]}</span>
        <span className="font-mono text-[10px] text-muted shrink-0">{ago(o.resolved_at ?? o.created_at)}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SideRow label="You give" items={youGive} tokens={tokGive} />
        <SideRow label="You get" items={youGet} tokens={tokGet} />
      </div>
      {o.note && <p className="text-xs leading-snug bg-paper rounded-lg px-2.5 py-1.5">&ldquo;{o.note}&rdquo;</p>}
      {o.status === 'failed' && (
        <p className="text-[11px] text-muted">{o.reason === 'insufficient_tokens' ? 'Someone no longer had the tokens.' : 'Something in it was no longer available.'}</p>
      )}
      {pending && o.incoming && (
        confirming ? (
          <div className="flex gap-1.5">
            <button type="button" onClick={() => { setConfirming(false); onAccept() }} className="flex-1 min-h-10 rounded-lg bg-signal text-white text-xs font-semibold">Yes, trade</button>
            <button type="button" onClick={() => setConfirming(false)} className="min-h-10 px-3 rounded-lg border border-card-border text-xs">Not yet</button>
          </div>
        ) : (
          <div className="flex gap-1.5">
            <button type="button" onClick={() => setConfirming(true)} className="flex-1 min-h-10 rounded-lg bg-ink text-white text-xs font-semibold">Accept</button>
            <button type="button" onClick={onCounter} disabled={busy} className="flex-1 min-h-10 rounded-lg border border-card-border text-xs font-medium disabled:opacity-50">Counter</button>
            <button type="button" onClick={onDecline} className="min-h-10 px-3 rounded-lg border border-card-border text-xs text-muted">Decline</button>
          </div>
        )
      )}
      {pending && !o.incoming && (
        <button type="button" onClick={onWithdraw} className="text-xs text-muted underline">Withdraw offer</button>
      )}
    </li>
  )
}
