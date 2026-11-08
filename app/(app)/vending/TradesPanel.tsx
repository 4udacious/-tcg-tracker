'use client'

import { useEffect, useMemo, useState, useTransition, type CSSProperties, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Sheet } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { compareCardNumbers, rarityName } from '@/lib/vending/games'
import ConditionedCard, { RIP_CORNERS, type Condition } from './ConditionedCard'
import HoloMark, { rarityLabel } from './HoloMark'
import Slab, { GRADE_LABEL } from './Slab'
import { SET_NAMES } from './ShowcaseRoom'
import { num, fmt, money } from './tokens'
import type { CollectionCard, UnopenedPack, OwnedBox } from './CollectionPanel'

/* ───────────── types (as the v100/v101 functions return them) ───────────── */

export type TradeItem =
  | { kind: 'card'; id: number; card_id: number; name: string; set_code: string; number: string; rarity: string; image_url: string; grade: number | null; condition: Condition }
  | { kind: 'pack'; id: number; name: string; set_name: string; image_url: string | null }
  | { kind: 'box'; id: number; name: string; set_code: string; image_url: string | null; packs: number }

export type Cover = 'red' | 'blue' | 'green' | 'purple' | 'black' | 'gold' | 'pink' | 'teal'
export type Pattern = 'plain' | 'dots' | 'stripes' | 'holo' | 'stars'
export type SortKey = 'set' | 'name' | 'rarity' | 'grade' | 'newest'
/** How a binder looks (v101): title, cover colour and pattern, page layout, and the order visitors see first. */
export interface BinderStyle { title: string | null; cover: Cover; pattern: Pattern; layout: 'pages' | 'grid'; sort: SortKey }
export const DEFAULT_STYLE: BinderStyle = { title: null, cover: 'red', pattern: 'plain', layout: 'pages', sort: 'set' }

export interface BinderSummary {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  note: string | null
  items: number
  images: string[] | null
  /** Absent before v101. */
  style?: BinderStyle | null
}

export interface Binder {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  note: string | null
  style?: BinderStyle | null
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
const styleOf = (s?: BinderStyle | null): BinderStyle => ({ ...DEFAULT_STYLE, ...(s ?? {}) })

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

/** Visible damage, in words (the numbers behind ordinary wear stay sealed until grading, as in the collection). */
function damageNotes(c: { crease?: number; holes?: number; rips?: number }): string[] {
  const out: string[] = []
  const holes = c.holes ?? 0
  if (holes > 0) out.push(holes === 1 ? 'Hole' : `${holes} holes`)
  const torn = RIP_CORNERS.filter((_, i) => ((c.rips ?? 0) & (1 << i)) !== 0)
  if (torn.length > 0) out.push(`Torn ${torn.join(', ')} corner${torn.length === 1 ? '' : 's'}`)
  const crease = c.crease ?? 0
  if (crease > 0) out.push(crease === 1 ? 'Light crease' : crease === 2 ? 'Crease' : 'Heavy crease')
  return out
}
const damageOf = (c: Condition) => (c.crease ?? 0) * 2 + (c.holes ?? 0) * 3 + (((c.rips ?? 0) & 15).toString(2).split('1').length - 1) * 3

/** Your collection as trade items, newest first: cards free to trade (not at the graders or cleaners), unopened packs and boxes. */
function collectionItems(collection: CollectionCard[], packs: UnopenedPack[], boxes: OwnedBox[]): TradeItem[] {
  const out: TradeItem[] = []
  for (const b of boxes) out.push({ kind: 'box', id: b.id, name: b.name, set_code: b.set_code, image_url: b.image_url, packs: b.packs })
  for (const p of packs) out.push({ kind: 'pack', id: p.id, name: p.pack_name, set_name: p.set_name, image_url: p.image_url })
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
  // Copy ids rise with acquisition, so the highest id is the newest.
  return out.sort((a, b) => b.id - a.id)
}

/* ───────────── sorting and quick picks ───────────── */

const RANK = 'CURLHPS'
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'set', label: 'Set & number' }, { key: 'name', label: 'Name' }, { key: 'rarity', label: 'Rarity' },
  { key: 'grade', label: 'Grade' }, { key: 'newest', label: 'Newest' },
]

/** Sealed product first, then cards in the chosen order. `items` come newest first. */
function sortItems(items: TradeItem[], key: SortKey): TradeItem[] {
  const order = new Map(items.map((i, n) => [keyOf(i), n]))
  const sealed = items.filter((i) => i.kind !== 'card')
  const cards = items.filter((i): i is Extract<TradeItem, { kind: 'card' }> => i.kind === 'card')
  const byNew = (a: TradeItem, b: TradeItem) => order.get(keyOf(a))! - order.get(keyOf(b))!
  const bySet = (a: Extract<TradeItem, { kind: 'card' }>, b: Extract<TradeItem, { kind: 'card' }>) =>
    a.set_code.localeCompare(b.set_code) || compareCardNumbers(a.number, b.number) || byNew(a, b)
  const sorted = [...cards].sort(
    key === 'name' ? (a, b) => a.name.localeCompare(b.name) || bySet(a, b)
    : key === 'rarity' ? (a, b) => RANK.indexOf(b.rarity) - RANK.indexOf(a.rarity) || bySet(a, b)
    : key === 'grade' ? (a, b) => (b.grade ?? -1) - (a.grade ?? -1) || damageOf(a.condition) - damageOf(b.condition) || bySet(a, b)
    : key === 'newest' ? byNew
    : bySet)
  return [...[...sealed].sort(byNew), ...sorted]
}

/** Every copy of a card past the best one (graded highest, else least damaged), for "add duplicates". */
function duplicates(items: TradeItem[]): TradeItem[] {
  const by = new Map<number, Extract<TradeItem, { kind: 'card' }>[]>()
  for (const i of items) if (i.kind === 'card') by.set(i.card_id, [...(by.get(i.card_id) ?? []), i])
  const out: TradeItem[] = []
  for (const copies of by.values()) {
    if (copies.length < 2) continue
    const best = [...copies].sort((a, b) => (b.grade ?? -1) - (a.grade ?? -1) || damageOf(a.condition) - damageOf(b.condition) || a.id - b.id)[0]
    out.push(...copies.filter((c) => c.id !== best.id))
  }
  return out
}

/* ───────────── binder covers ───────────── */

export const COVERS: Record<Cover, { label: string; bg: string; ink: string; page: string }> = {
  red: { label: 'Red', bg: '#B91C1C', ink: '#FFFFFF', page: 'rgba(185,28,28,0.10)' },
  blue: { label: 'Blue', bg: '#1D4ED8', ink: '#FFFFFF', page: 'rgba(29,78,216,0.10)' },
  green: { label: 'Green', bg: '#15803D', ink: '#FFFFFF', page: 'rgba(21,128,61,0.10)' },
  purple: { label: 'Purple', bg: '#7E22CE', ink: '#FFFFFF', page: 'rgba(126,34,206,0.10)' },
  black: { label: 'Black', bg: '#111827', ink: '#F9FAFB', page: 'rgba(17,24,39,0.12)' },
  gold: { label: 'Gold', bg: '#B45309', ink: '#FFFBEB', page: 'rgba(180,83,9,0.12)' },
  pink: { label: 'Pink', bg: '#DB2777', ink: '#FFFFFF', page: 'rgba(219,39,119,0.10)' },
  teal: { label: 'Teal', bg: '#0F766E', ink: '#FFFFFF', page: 'rgba(15,118,110,0.10)' },
}
const PATTERNS: { key: Pattern; label: string }[] = [
  { key: 'plain', label: 'Plain' }, { key: 'dots', label: 'Dots' }, { key: 'stripes', label: 'Stripes' },
  { key: 'holo', label: 'Holo' }, { key: 'stars', label: 'Stars' },
]
function coverStyle(s: BinderStyle): CSSProperties {
  const c = COVERS[s.cover]
  const layer =
    s.pattern === 'dots' ? 'radial-gradient(rgba(255,255,255,0.22) 1.5px, transparent 1.6px) 0 0 / 12px 12px'
    : s.pattern === 'stripes' ? 'repeating-linear-gradient(135deg, rgba(255,255,255,0.14) 0 8px, transparent 8px 18px)'
    : s.pattern === 'holo' ? 'linear-gradient(115deg, rgba(255,0,128,0.28), rgba(255,200,0,0.24), rgba(0,255,170,0.24), rgba(0,140,255,0.28), rgba(200,0,255,0.26))'
    : s.pattern === 'stars' ? 'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.5) 0 1.2px, transparent 1.4px) 0 0 / 22px 22px, radial-gradient(circle at 70% 70%, rgba(255,255,255,0.35) 0 1px, transparent 1.2px) 0 0 / 30px 30px'
    : null
  return { background: layer ? `${layer}, ${c.bg}` : c.bg, color: c.ink }
}

/** The binder's cover: its colour and pattern, title and owner. */
function BinderCover({ style, owner, count, small = false }: { style: BinderStyle; owner: Member; count?: number; small?: boolean }) {
  return (
    <div className={`relative rounded-xl overflow-hidden shadow-sm ${small ? 'px-3 py-2' : 'px-4 py-4'}`} style={coverStyle(style)}>
      {/* The spine: rings down the left, as on a real binder. */}
      <div className="absolute left-0 inset-y-0 w-3 bg-black/25" aria-hidden />
      <div className="relative pl-3 flex items-center gap-3">
        <Avatar m={owner} size={small ? 28 : 40} />
        <div className="min-w-0">
          <p className={`font-display font-semibold truncate ${small ? 'text-sm' : 'text-lg'}`}>{style.title || `${nameOf(owner)}'s binder`}</p>
          {(style.title || count != null) && (
            <p className="text-[11px] opacity-80 truncate">{style.title ? nameOf(owner) : ''}{style.title && count != null ? ' · ' : ''}{count != null ? `${count} item${count === 1 ? '' : 's'}` : ''}</p>
          )}
        </div>
      </div>
    </div>
  )
}

/* ───────────── small pieces ───────────── */

function ago(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 60) return `${Math.max(1, m)}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)

function Avatar({ m, size = 32 }: { m: Member; size?: number }) {
  return m.avatar_url
    ? <img src={m.avatar_url} alt="" width={size} height={size} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
    : (
      <span className="rounded-full bg-ink text-white font-display font-semibold inline-flex items-center justify-center shrink-0 ring-2 ring-white/30"
        style={{ width: size, height: size, fontSize: size * 0.42 }}>
        {(m.display_name || m.username || '?').slice(0, 1).toUpperCase()}
      </span>
    )
}

function describe(item: TradeItem) {
  return item.kind === 'card'
    ? item.name + rarityLabel(item.rarity, item.image_url) + (item.grade != null ? `, graded ${item.grade}` : '')
    : item.kind === 'box' ? `sealed ${item.name}, ${item.packs} packs` : `sealed ${item.set_name} pack`
}

/** One card, pack or box. Tapping it opens the full view; the corner check picks it without opening. */
function ItemTile({ item, on, onOpen, onCheck, small = false }: { item: TradeItem; on?: boolean; onOpen?: () => void; onCheck?: () => void; small?: boolean }) {
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
  if (!onOpen) return <div className="relative" title={describe(item)}>{body}</div>
  return (
    <div className={`relative rounded transition-all ${on ? 'ring-2 ring-white scale-95 shadow-[0_0_0_4px_rgba(15,23,42,0.45)]' : ''}`}>
      <button type="button" onClick={onOpen} className="relative block w-full" aria-label={`View ${describe(item)}`}>{body}</button>
      {onCheck && (
        <button type="button" onClick={onCheck} aria-pressed={on} aria-label={`${on ? 'Unpick' : 'Pick'} ${describe(item)}`}
          className={`absolute -top-1.5 -left-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center shadow ${on ? 'bg-signal border-white text-white' : 'bg-white/90 border-ink/30 text-transparent'}`}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        </button>
      )}
    </div>
  )
}

/**
 * The full view of one item: the card large (slabbed if graded) with its
 * condition in words, or the sealed product. Arrows step through the list it
 * was opened from; the action button picks it (or takes it out).
 */
function CardView({ items, index, onIndex, onClose, action }: {
  items: TradeItem[]; index: number; onIndex: (i: number) => void; onClose: () => void
  action?: { label: (i: TradeItem) => string; run: (i: TradeItem) => void; tone?: (i: TradeItem) => 'primary' | 'quiet' }
}) {
  const item = items[index]
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1)
      if (e.key === 'ArrowRight' && index < items.length - 1) onIndex(index + 1)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [index, items.length, onClose, onIndex])
  if (!item) return null
  const arrow = (dir: -1 | 1) => (
    <button type="button" onClick={() => onIndex(index + dir)} disabled={dir < 0 ? index === 0 : index === items.length - 1}
      className="w-10 h-10 shrink-0 rounded-full bg-white/10 text-white flex items-center justify-center disabled:opacity-20 hover:bg-white/20"
      aria-label={dir < 0 ? 'Previous' : 'Next'}>
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={dir < 0 ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} /></svg>
    </button>
  )
  const notes = item.kind === 'card' ? damageNotes(item.condition) : []
  const tone = action?.tone?.(item) ?? 'primary'
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center gap-4 p-4" role="dialog" aria-modal aria-label={itemLabel(item)} onClick={onClose}>
      <button type="button" onClick={onClose} className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center" aria-label="Close">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
      <div className="flex items-center gap-2 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        {arrow(-1)}
        <div className="flex-1 min-w-0 flex justify-center">
          {item.kind === 'card' ? (item.grade != null ? (
            <Slab condition={item.condition} grade={item.grade} src={item.image_url} alt={item.name} name={item.name} number={item.number}
              setName={SET_NAMES[item.set_code] ?? item.set_code} setCode={item.set_code} className="w-full max-w-[250px]" />
          ) : (
            <div className="relative w-full max-w-[260px]">
              <ConditionedCard src={item.image_url} alt={item.name} condition={item.condition} rarity={item.rarity} className="w-full aspect-[245/342] rounded-lg" />
              <HoloMark rarity={item.rarity} setCode={item.image_url} />
            </div>
          )) : (
            <div className="w-full max-w-[260px] aspect-[245/342] rounded-lg bg-white/5 flex items-center justify-center overflow-hidden">
              {item.image_url && <img src={item.image_url} alt="" className="w-full object-contain" />}
            </div>
          )}
        </div>
        {arrow(1)}
      </div>
      <div className="text-center space-y-1 max-w-sm" onClick={(e) => e.stopPropagation()}>
        {item.kind === 'card' ? (
          <>
            <p className="text-white font-semibold text-sm">{item.name}</p>
            <p className="text-xs text-white/60">{rarityName(item.rarity, item.set_code)} · #{item.number} · {SET_NAMES[item.set_code] ?? item.set_code}</p>
            {item.grade != null ? (
              <p className="text-xs text-amber-300 font-medium">Graded {item.grade} · {GRADE_LABEL[item.grade] ?? ''}</p>
            ) : (
              <p className={`font-mono text-[11px] ${notes.length ? 'text-red-300/90' : 'text-white/50'}`}>{notes.length ? notes.join(' · ') : 'Raw · no visible damage'}</p>
            )}
          </>
        ) : (
          <>
            <p className="text-white font-semibold text-sm">{item.kind === 'box' ? item.name : `${item.set_name} pack`}</p>
            <p className="text-xs text-white/60">{item.kind === 'box' ? `Sealed booster box · ${item.packs} packs` : 'Sealed booster pack'}</p>
          </>
        )}
        <p className="font-mono text-[10px] text-white/35">{index + 1} of {items.length}</p>
      </div>
      {action && (
        <button type="button" onClick={(e) => { e.stopPropagation(); action.run(item) }}
          className={`min-h-11 px-6 rounded-xl text-sm font-semibold ${tone === 'primary' ? 'bg-signal text-white' : 'bg-white/10 text-white border border-white/20'}`}>
          {action.label(item)}
        </button>
      )}
    </div>
  )
}

/**
 * A browsable, sortable set of items with tabs per set (and Sealed). Tapping
 * opens the full view; the corner check (and the view's button) picks.
 * `layout: 'pages'` lays it out as 9-pocket binder pages in the cover's tint.
 */
function PickGrid({ items, picked, onToggle, empty, initialSort = 'set', layout = 'grid', style, actionLabel, toolbar }: {
  items: TradeItem[]; picked: Set<string>; onToggle: (i: TradeItem) => void; empty: string
  initialSort?: SortKey; layout?: 'pages' | 'grid'; style?: BinderStyle
  /** What the full view's button says for an item, picked or not. */
  actionLabel?: (on: boolean) => string
  /** Extra controls under the tabs (quick picks), given the items in view. */
  toolbar?: (shown: TradeItem[], tab: string | null) => ReactNode
}) {
  const [filter, setFilter] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey>(initialSort)
  const [viewAt, setViewAt] = useState<number | null>(null)
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
  const shown = useMemo(() => sortItems(filter === null ? items
    : filter === 'sealed' ? items.filter((i) => i.kind !== 'card')
    : items.filter((i) => i.kind === 'card' && i.set_code === filter), sort), [items, filter, sort])
  if (items.length === 0) return <p className="text-sm text-muted">{empty}</p>
  const chip = (on: boolean) => `shrink-0 text-xs font-medium rounded-lg px-2.5 py-1.5 transition-colors ${on ? 'bg-ink text-white' : 'border border-card-border text-muted hover:text-ink'}`
  const tile = (i: TradeItem, n: number) => (
    <ItemTile item={i} on={picked.has(keyOf(i))} onOpen={() => setViewAt(n)} onCheck={() => onToggle(i)} />
  )
  const pages: TradeItem[][] = []
  for (let n = 0; n < shown.length; n += 9) pages.push(shown.slice(n, n + 9))
  const tint = style ? COVERS[style.cover].page : 'transparent'
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
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label className="inline-flex items-center gap-1.5 text-xs text-muted">
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="rounded-lg border border-card-border bg-card text-ink text-xs px-2 py-1">
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
        {toolbar?.(shown, filter)}
      </div>
      {layout === 'pages' ? (
        <div className="space-y-3">
          {pages.map((page, p) => (
            <div key={p} className="rounded-xl p-2.5 border border-card-border" style={{ background: tint }}>
              <ul className="grid grid-cols-3 gap-2.5">
                {Array.from({ length: 9 }, (_, s) => {
                  const i = page[s]
                  // An empty pocket, so a part-filled page still reads as a binder page.
                  return <li key={s} className="rounded-md bg-white/50 dark:bg-white/5 ring-1 ring-inset ring-black/10 dark:ring-white/10 p-1">
                    {i ? tile(i, p * 9 + s) : <div className="aspect-[245/342]" />}
                  </li>
                })}
              </ul>
              <p className="mt-1.5 text-center font-mono text-[10px] text-muted">Page {p + 1} of {pages.length}</p>
            </div>
          ))}
        </div>
      ) : (
        <ul className="grid grid-cols-4 gap-2">
          {shown.map((i, n) => <li key={keyOf(i)}>{tile(i, n)}</li>)}
        </ul>
      )}
      {viewAt != null && (
        <CardView items={shown} index={viewAt} onIndex={setViewAt} onClose={() => setViewAt(null)}
          action={actionLabel && {
            label: (i) => actionLabel(picked.has(keyOf(i))),
            tone: (i) => (picked.has(keyOf(i)) ? 'quiet' : 'primary'),
            run: (i) => onToggle(i),
          }} />
      )}
    </div>
  )
}

/** A row of small thumbnails and a tokens chip: one side of an offer. Tapping a thumbnail opens it. */
function SideRow({ label, items, tokens }: { label: string; items: TradeItem[]; tokens: number }) {
  const [viewAt, setViewAt] = useState<number | null>(null)
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-muted">{label}</p>
      {items.length === 0 && tokens <= 0 ? <p className="text-xs text-muted">Nothing</p> : (
        <div className="flex flex-wrap items-end gap-1.5">
          {items.map((i, n) => (
            <button key={keyOf(i)} type="button" onClick={() => setViewAt(n)} className="w-12" aria-label={`View ${describe(i)}`}><ItemTile item={i} small /></button>
          ))}
          {tokens > 0 && (
            <span className="rounded-lg bg-amber-100 text-amber-900 dark:bg-amber-400/20 dark:text-amber-200 text-xs font-mono font-semibold px-2 py-1">
              {fmt(tokens)} tk
            </span>
          )}
        </div>
      )}
      {items.length > 0 && <p className="text-[11px] text-muted leading-snug">{items.map(itemLabel).join(', ')}</p>}
      {viewAt != null && <CardView items={items} index={viewAt} onIndex={setViewAt} onClose={() => setViewAt(null)} />}
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
  }, [tab]) // eslint-disable-line

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
              {others.map((b) => {
                const st = styleOf(b.style)
                return (
                  <li key={b.user_id}>
                    <button type="button" onClick={() => openBinder(b.user_id)} disabled={loading === b.user_id}
                      className="w-full text-left rounded-xl overflow-hidden flex items-stretch bg-card border border-card-border hover:border-ink/30 transition-colors disabled:opacity-60">
                      <span className="w-20 shrink-0 relative flex items-center justify-center" style={coverStyle(st)}>
                        <span className="absolute left-0 inset-y-0 w-1.5 bg-black/25" aria-hidden />
                        <span className="flex -space-x-4">
                          {(b.images ?? []).slice(0, 2).map((src, i) => (
                            <img key={i} src={src} alt="" className="w-8 aspect-[245/342] object-cover rounded-sm shadow-md" style={{ transform: `rotate(${i ? 6 : -6}deg)` }} />
                          ))}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1 px-3 py-2.5">
                        <span className="block text-sm font-medium truncate">{st.title || `${nameOf(b)}'s binder`}</span>
                        <span className="block text-[11px] text-muted truncate">{st.title ? `${nameOf(b)} · ` : ''}{b.items} item{b.items === 1 ? '' : 's'}</span>
                        {b.note && <span className="block text-[11px] text-muted truncate">Looking for: {b.note}</span>}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      ))}

      {tab === 'mine' && <MyBinder binder={myBinder} mine={mine} me={{ user_id: userId, username: myBinder?.username ?? 'you', display_name: myBinder?.display_name ?? 'You', avatar_url: myBinder?.avatar_url ?? null }} onChanged={refresh} />}

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
  const st = styleOf(binder.style)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const toggle = (i: TradeItem) => setPicked((s) => { const n = new Set(s); if (n.has(keyOf(i))) n.delete(keyOf(i)); else if (n.size < MAX_SIDE) n.add(keyOf(i)); return n })
  return (
    <section className="space-y-3">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 min-h-10 text-sm text-muted hover:text-ink transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        All binders
      </button>
      <BinderCover style={st} owner={binder} count={binder.items.length} />
      {binder.note && <p className="text-xs text-muted leading-snug">Looking for: <span className="text-ink">{binder.note}</span></p>}
      <p className="text-xs text-muted">{picked.size > 0 ? `${picked.size} picked` : 'Tap a card to see it up close; tick the ones you’d like, then make an offer.'}</p>
      <PickGrid items={binder.items} picked={picked} onToggle={toggle} empty="Nothing in this binder right now."
        initialSort={st.sort} layout={st.layout} style={st} actionLabel={(on) => (on ? 'Don’t want this' : 'I’d like this')} />
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

function MyBinder({ binder, mine, me, onChanged }: { binder: Binder | null; mine: TradeItem[]; me: Member; onChanged: () => void }) {
  const toast = useToast()
  const items = useMemo(() => binder?.items ?? [], [binder])
  const inBinder = useMemo(() => new Set(items.map(keyOf)), [items])
  const [style, setStyle] = useState<BinderStyle>(styleOf(binder?.style))
  const [note, setNote] = useState(binder?.note ?? '')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const [styling, setStyling] = useState(false)
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
      <BinderCover style={style} owner={me} count={items.length} />
      <div className="flex gap-1.5">
        <button type="button" onClick={() => setStyling(true)} className="flex-1 min-h-10 rounded-xl border border-card-border text-xs font-medium">Customize look</button>
        <button type="button" onClick={() => setAdding(true)} className="flex-1 min-h-10 rounded-xl bg-ink text-white text-xs font-semibold">Add cards &amp; sealed</button>
      </div>
      <div className="flex gap-2">
        <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 200))} placeholder="Looking for… (e.g. Base Set holos, sealed Neo)"
          className="min-w-0 flex-1 rounded-xl border border-card-border bg-card px-3 py-2 text-sm" aria-label="What you're looking for" />
        <button type="button" onClick={saveNote} disabled={(binder?.note ?? '') === note.trim()}
          className="shrink-0 rounded-xl border border-card-border px-3 text-xs font-medium disabled:opacity-40">Save</button>
      </div>
      <p className="text-[11px] text-muted leading-snug">
        Members can browse your binder and send offers; nothing leaves your collection unless you accept one.
        Anything you list on the Market, send to the graders or cleaners, or open drops out of view while it&apos;s away.
      </p>
      {picked.size > 0 && (
        <button type="button" disabled={busy} onClick={async () => { if (await set(items.filter((i) => picked.has(keyOf(i))), false)) setPicked(new Set()) }}
          className="w-full min-h-10 rounded-xl border border-card-border text-signal text-xs font-semibold">Take {picked.size} out of your binder</button>
      )}
      <PickGrid items={items} picked={picked} onToggle={toggle} empty="Your binder is empty. Add cards, packs or boxes you'd trade."
        initialSort={style.sort} layout={style.layout} style={style} actionLabel={(on) => (on ? 'Keep in binder' : 'Take out of binder')} />
      {adding && (
        <AddSheet mine={mine.filter((i) => !inBinder.has(keyOf(i)))} busy={busy} onClose={() => setAdding(false)}
          onAdd={async (chosen) => { if (await set(chosen, true)) { setAdding(false); toast.ok(`Added ${chosen.length} to your binder.`) } }} />
      )}
      {styling && (
        <StyleSheet initial={style} owner={me} count={items.length} onClose={() => setStyling(false)}
          onSaved={(s) => { setStyle(s); setStyling(false); toast.ok('Binder updated.'); onChanged() }} onError={(m) => toast.error(m)} />
      )}
    </section>
  )
}

/** Pick what goes in: tap to see a card up close first, tick to pick, or fill with your duplicates or a whole set. */
function AddSheet({ mine, busy, onClose, onAdd }: { mine: TradeItem[]; busy: boolean; onClose: () => void; onAdd: (items: TradeItem[]) => void }) {
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const toggle = (i: TradeItem) => setPicked((s) => { const n = new Set(s); if (n.has(keyOf(i))) n.delete(keyOf(i)); else n.add(keyOf(i)); return n })
  const dupes = useMemo(() => duplicates(mine), [mine])
  const pickAll = (list: TradeItem[]) => setPicked((s) => { const n = new Set(s); for (const i of list) n.add(keyOf(i)); return n })
  const quick = 'text-[11px] font-medium rounded-lg px-2 py-1 border border-card-border text-ink hover:bg-paper disabled:opacity-40'
  return (
    <Sheet open onClose={onClose} wide title="Add to your binder" footer={(
      <button type="button" disabled={busy || picked.size === 0} onClick={() => onAdd(mine.filter((i) => picked.has(keyOf(i))))}
        className="w-full min-h-11 rounded-xl bg-ink text-white text-sm font-semibold disabled:opacity-40">
        {picked.size > 0 ? `Add ${picked.size} to binder` : 'Pick what to add'}
      </button>
    )}>
      <div className="space-y-2">
        <p className="text-xs text-muted leading-snug">Tap a card to check its condition before it goes in; tick to pick.</p>
        <PickGrid items={mine} picked={picked} onToggle={toggle} initialSort="set"
          empty="Nothing left to add: everything you own is already in your binder (or away)."
          actionLabel={(on) => (on ? 'Leave it out' : 'Add to binder')}
          toolbar={(shown, tab) => (
            <div className="flex gap-1.5 flex-wrap">
              <button type="button" className={quick} disabled={dupes.length === 0} onClick={() => pickAll(dupes)}
                title="Every copy past your best one of each card">Duplicates ({dupes.length})</button>
              {tab && tab !== 'sealed' && (
                <button type="button" className={quick} onClick={() => pickAll(shown)}>All in {SET_NAMES[tab] ?? tab} ({shown.length})</button>
              )}
              {tab === 'sealed' && <button type="button" className={quick} onClick={() => pickAll(shown)}>All sealed ({shown.length})</button>}
              {picked.size > 0 && <button type="button" className={quick} onClick={() => setPicked(new Set())}>Clear</button>}
            </div>
          )} />
      </div>
    </Sheet>
  )
}

/** Your binder's look: title, cover colour, pattern, page layout and the order visitors see first, with a live preview. */
function StyleSheet({ initial, owner, count, onClose, onSaved, onError }: {
  initial: BinderStyle; owner: Member; count: number; onClose: () => void; onSaved: (s: BinderStyle) => void; onError: (m: string) => void
}) {
  const [s, setS] = useState<BinderStyle>(initial)
  const [busy, setBusy] = useState(false)
  async function save() {
    setBusy(true)
    const { data, error } = await createClient().rpc('trade_binder_set_style', { p_title: s.title ?? '', p_cover: s.cover, p_pattern: s.pattern, p_layout: s.layout, p_sort: s.sort })
    setBusy(false)
    if (error) { onError('Could not save your binder’s look.'); return }
    onSaved(styleOf(data as BinderStyle | null) ?? s)
  }
  const chip = (on: boolean) => `text-xs font-medium rounded-lg px-2.5 py-1.5 transition-colors ${on ? 'bg-ink text-white' : 'border border-card-border text-muted hover:text-ink'}`
  return (
    <Sheet open onClose={onClose} title="Customize your binder" footer={(
      <button type="button" onClick={save} disabled={busy} className="w-full min-h-11 rounded-xl bg-ink text-white text-sm font-semibold disabled:opacity-40">{busy ? 'Saving…' : 'Save'}</button>
    )}>
      <div className="space-y-4">
        <BinderCover style={s} owner={owner} count={count} />
        <label className="block space-y-1">
          <span className="text-xs font-medium">Title</span>
          <input value={s.title ?? ''} onChange={(e) => setS({ ...s, title: e.target.value.slice(0, 40) })} placeholder={`${nameOf(owner)}'s binder`}
            className="w-full rounded-xl border border-card-border bg-card px-3 py-2 text-sm" />
        </label>
        <div className="space-y-1.5">
          <p className="text-xs font-medium">Cover</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(COVERS) as Cover[]).map((c) => (
              <button key={c} type="button" onClick={() => setS({ ...s, cover: c })} aria-pressed={s.cover === c} aria-label={COVERS[c].label}
                className={`w-9 h-9 rounded-full transition-transform ${s.cover === c ? 'ring-2 ring-offset-2 ring-ink scale-110' : ''}`} style={{ background: COVERS[c].bg }} />
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium">Pattern</p>
          <div className="flex flex-wrap gap-1.5">
            {PATTERNS.map((p) => <button key={p.key} type="button" onClick={() => setS({ ...s, pattern: p.key })} className={chip(s.pattern === p.key)} aria-pressed={s.pattern === p.key}>{p.label}</button>)}
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium">Pages</p>
          <div className="flex gap-1.5">
            {([['pages', '9-pocket pages'], ['grid', 'Grid']] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setS({ ...s, layout: k })} className={`flex-1 ${chip(s.layout === k)}`} aria-pressed={s.layout === k}>{l}</button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium">Visitors see it sorted by</p>
          <div className="flex flex-wrap gap-1.5">
            {SORTS.map((o) => <button key={o.key} type="button" onClick={() => setS({ ...s, sort: o.key })} className={chip(s.sort === o.key)} aria-pressed={s.sort === o.key}>{o.label}</button>)}
          </div>
        </div>
      </div>
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
          empty={isGive ? 'You have nothing free to trade.' : 'Nothing to ask for.'}
          actionLabel={(on) => (on ? 'Take it out' : isGive ? 'Offer this' : 'Ask for this')} />
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
            You&apos;re asking for {getItems.length === 1 ? itemLabel(getItems[0]) : `${getItems.length} items`}. What will you offer? Tap a card to check it, tick to offer it; add tokens on the next step.
          </p>
          <PickGrid items={myItems} picked={give} onToggle={toggle(setGive)} empty="You have nothing free to trade, but you can offer tokens."
            actionLabel={(on) => (on ? 'Take it out' : 'Offer this')} />
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
