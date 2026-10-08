'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import CardCelebration from './CardCelebration'
import ConditionedCard from './ConditionedCard'
import Slab from './Slab'
import { fmt } from './tokens'
import HoloMark, { rarityLabel } from './HoloMark'

export interface UnopenedPack {
  id: number
  set_name: string
  pack_name: string
  image_url: string
}

/** One pulled copy, with its own condition. */
export interface CardCopy {
  id: number
  center_x: number
  center_y: number
  corners: number
  edges: number
  surface: number
  border_wear: number
  wear_seed: number
  /** null until sent for grading. */
  grading_started_at: string | null
  grading_ready_at: string | null
  /** null until the grade has been collected. */
  graded_at: string | null
  grade: number | null
}

type GradeState = 'ungraded' | 'waiting' | 'ready' | 'graded'

function gradeState(c: CardCopy): GradeState {
  if (c.graded_at) return 'graded'
  if (!c.grading_started_at) return 'ungraded'
  if (c.grading_ready_at && new Date(c.grading_ready_at).getTime() <= Date.now()) return 'ready'
  return 'waiting'
}

/** "6 days", "4 hours", "12 min" - whichever unit still reads as a wait. */
function waitLabel(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'any moment'
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `${mins} min`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'}`
  return `${Math.round(hours / 24)} days`
}

/** Gem mint down to played, for the badge. */
function gradeTone(g: number): string {
  if (g >= 10) return 'bg-amber-400 text-ink'
  if (g >= 9) return 'bg-emerald-400 text-ink'
  if (g >= 8) return 'bg-sky-400 text-ink'
  if (g >= 6) return 'bg-slate-300 text-ink'
  return 'bg-stone-500 text-white'
}

const GRADE_LABEL: Record<number, string> = {
  10: 'Gem Mint', 9: 'Mint', 8: 'Near Mint-Mint', 7: 'Near Mint',
  6: 'Excellent-Mint', 5: 'Excellent', 4: 'Very Good-Excellent',
}

export interface CollectionCard {
  card_id: number
  set_code: string
  number: string
  name: string
  rarity: string
  image_url: string
  /** Every copy owned, oldest first. Never empty. */
  copies: CardCopy[]
}

export interface SetTotal {
  set_code: string
  set_name: string
  total: number
}

interface RevealCard {
  card_id: number
  name: string
  rarity: string
  number: string
  image_url: string
  slot: number
  center_x: number
  center_y: number
  corners: number
  edges: number
  surface: number
  border_wear: number
  wear_seed: number
}

export interface OwnedTicket {
  ticket_id: number
  name: string
  description: string | null
  rarity: string
  image_url: string | null
  copies: number
}

interface Props {
  packs: UnopenedPack[]
  collection: CollectionCard[]
  setTotals: SetTotal[]
  tickets: OwnedTicket[]
  gradingCost: number
  gradingDays: number
}

const TICKET_RARITY_COLOR: Record<string, string> = {
  common: '#6B7280',
  uncommon: '#16A34A',
  rare: '#0EA5E9',
  ultra: '#A855F7',
  legendary: '#F6A609',
}

const RARITY_LABEL: Record<string, string> = {
  C: 'Common', U: 'Uncommon', R: 'Rare', H: 'Holo Rare', S: 'Secret Rare',
}

/**
 * Binder styling per set.
 *
 * `fit: 'cover'` is for real cover artwork, which should fill the window
 * edge to edge like an actual binder face. `fit: 'contain'` is for the pack
 * wrappers standing in until artwork exists - those are tall and narrow, so
 * cropping them would cut the design apart.
 */
type Binder = { cover: string; spine: string; body: string; foil: string; fit: 'cover' | 'contain' }

const BINDERS: Record<string, Binder> = {
  base1: { cover: '/binders/base-set.webp',           spine: '#1e3a8a', body: '#1d4ed8', foil: '#93c5fd', fit: 'cover' },
  base2: { cover: '/binders/jungle.webp',             spine: '#14532d', body: '#166534', foil: '#86efac', fit: 'cover' },
  // Amber, chosen when Base Set took blue, happens to match the kraft-paper
  // artwork exactly.
  base3: { cover: '/binders/fossil.webp',             spine: '#78350f', body: '#92400e', foil: '#fcd34d', fit: 'cover' },
  base5: { cover: '/binders/team-rocket.webp',        spine: '#1c1917', body: '#292524', foil: '#f87171', fit: 'cover' },
  // Vivid orange rather than Fossil's brown-amber: the two covers are both
  // warm, and the binder bodies are what tells them apart down the shelf.
  gym1:  { cover: '/binders/gym-heroes.webp',         spine: '#c2410c', body: '#ea580c', foil: '#fde68a', fit: 'cover' },
}

const DEFAULT_BINDER: Binder = { cover: '', spine: '#334155', body: '#475569', foil: '#cbd5e1', fit: 'contain' }

/**
 * A binder on the shelf. Drawn in CSS rather than shipped as artwork: a
 * spine with rings, a foil nameplate, and a cover window showing one of the
 * set's own pack wrappers. Empty binders sit closed and desaturated.
 */
function BinderCover({
  setCode, setName, owned, total, onOpen,
}: {
  setCode: string
  setName: string
  owned: number
  total: number
  onOpen: () => void
}) {
  const t = BINDERS[setCode] ?? DEFAULT_BINDER
  const empty = owned === 0
  const pct = total > 0 ? Math.round((owned / total) * 100) : 0

  return (
    <button
      onClick={onOpen}
      className={`group relative block w-full aspect-[3/4] rounded-lg overflow-hidden shadow-md transition-transform ${
        empty ? 'opacity-55' : 'hover:-translate-y-0.5 hover:shadow-lg'
      }`}
      style={{ background: t.body }}
      aria-label={`Open the ${setName} binder, ${owned} of ${total} cards`}
    >
      {/* Spine with rings */}
      <div className="absolute inset-y-0 left-0 w-5" style={{ background: t.spine }}>
        <div className="h-full flex flex-col items-center justify-center gap-3">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="block w-2.5 h-2.5 rounded-full border"
              style={{ borderColor: t.foil, background: 'rgba(0,0,0,0.25)' }}
            />
          ))}
        </div>
      </div>

      {/* Cover window */}
      <div className="absolute inset-y-3 left-8 right-3 rounded-sm overflow-hidden"
           style={{ background: 'rgba(0,0,0,0.22)', boxShadow: `inset 0 0 0 1px ${t.foil}55` }}>
        {t.cover ? (
          <img
            src={t.cover}
            alt=""
            className={`w-full h-full ${
              t.fit === 'cover' ? 'object-cover' : 'object-contain p-1.5'
            } ${empty ? 'grayscale' : ''}`}
            loading="lazy"
          />
        ) : null}
      </div>

      {/* Nameplate */}
      <div className="absolute inset-x-8 bottom-2 rounded-sm px-1.5 py-1 text-center"
           style={{ background: 'rgba(0,0,0,0.55)' }}>
        <p className="text-[10px] font-semibold leading-tight truncate text-white">{setName}</p>
        <p className="font-mono text-[9px] leading-tight" style={{ color: t.foil }}>
          {owned}/{total}
        </p>
        <div className="mt-1 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.18)' }}>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: t.foil }} />
        </div>
      </div>
    </button>
  )
}

/** Border treatment per rarity. Holo and secret get the loud ones. */
function rarityRing(r: string): string {
  switch (r) {
    case 'S': return 'ring-2 ring-fuchsia-400 shadow-[0_0_10px_rgba(232,121,249,0.6)]'
    case 'H': return 'ring-2 ring-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]'
    case 'R': return 'ring-1 ring-sky-400'
    case 'U': return 'ring-1 ring-emerald-400'
    default: return 'ring-1 ring-black/10'
  }
}

export default function CollectionPanel({
  packs, collection, setTotals, tickets, gradingCost, gradingDays,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [opening, setOpening] = useState(false)
  const [reveal, setReveal] = useState<RevealCard[] | null>(null)
  const [revealed, setRevealed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  // null = the shelf; a set_code = that binder is open.
  const [openBinder, setOpenBinder] = useState<string | null>(null)
  // Index into the open binder's cards, for the enlarged view.
  const [zoomIndex, setZoomIndex] = useState<number | null>(null)
  // Which copy of the zoomed card is showing. Duplicates are not the same
  // object any more, so they get their own page rather than a ×N badge alone.
  const [copyIndex, setCopyIndex] = useState(0)
  // Packs opened in this session drop out immediately, rather than lingering
  // until the server props catch up and inviting a second tap that would be
  // refused with "already open".
  const [openedIds, setOpenedIds] = useState<Set<number>>(new Set())

  const visiblePacks = useMemo(
    () => packs.filter((p) => !openedIds.has(p.id)),
    [packs, openedIds]
  )

  const [grading, setGrading] = useState<number | null>(null)
  const [gradeNote, setGradeNote] = useState<string | null>(null)
  const [patch, setPatch] = useState<Record<number, Partial<CardCopy>>>({})
  // The vault is a peer of the shelf, not a binder inside it.
  const [shelf, setShelf] = useState<'binders' | 'vault'>('binders')
  const [slabIndex, setSlabIndex] = useState<number | null>(null)
  const [gradeReveal, setGradeReveal] = useState<{ card: CollectionCard; copy: CardCopy } | null>(null)
  // Submitting is posting the card away: it costs tokens, leaves the binder,
  // and cannot be recalled. Worth a beat before it happens.
  const [confirmGrading, setConfirmGrading] = useState<{ card: CollectionCard; copy: CardCopy } | null>(null)
  const withPatch = useCallback(
    (c: CardCopy): CardCopy => ({ ...c, ...(patch[c.id] ?? {}) }),
    [patch]
  )

  /**
   * Graded copies leave the binder for the vault, the way a slabbed card
   * leaves the page it was in. Derived rather than stored: a copy's grade
   * already says where it lives.
   */
  const slabs = useMemo(() => {
    const out: { card: CollectionCard; copy: CardCopy }[] = []
    for (const card of collection) {
      for (const raw of card.copies) {
        const copy = withPatch(raw)
        if (copy.graded_at && copy.grade != null) out.push({ card, copy })
      }
    }
    // Best first - a shelf of slabs is a trophy case.
    return out.sort((a, b) =>
      (b.copy.grade ?? 0) - (a.copy.grade ?? 0) || a.card.name.localeCompare(b.card.name))
  }, [collection, withPatch])

  /**
   * The binder holds raw copies only. A card whose every copy has been
   * slabbed keeps its slot rather than leaving a hole in the set - grading
   * your only Charizard should not look like losing it.
   */
  const bySet = useMemo(() => {
    const map = new Map<string, (CollectionCard & { raw: CardCopy[]; slabbed: number })[]>()
    for (const c of collection) {
      const copies = c.copies.map(withPatch)
      const raw = copies.filter((x) => !x.graded_at)
      const slabbed = copies.length - raw.length
      if (!map.has(c.set_code)) map.set(c.set_code, [])
      map.get(c.set_code)!.push({ ...c, raw, slabbed })
    }
    for (const list of map.values()) {
      list.sort((a, b) => Number(a.number) - Number(b.number))
    }
    return map
  }, [collection, withPatch])

  const totalCards = collection.reduce((n, c) => n + c.copies.length, 0)
  const uniqueCards = collection.length
  const allTotal = setTotals.reduce((n, s) => n + s.total, 0)

  async function openPack(id: number) {
    setOpening(true); setError(null)
    const supabase = createClient()
    const { data, error: err } = await supabase.rpc('open_pack', { p_user_pack_id: id })
    setOpening(false)
    if (err) { setError(err.message.replace(/^.*?:\s*/, '')); return }
    setOpenedIds((prev) => new Set(prev).add(id))
    const cards = ((data as RevealCard[]) ?? []).sort((a, b) => a.slot - b.slot)
    setReveal(cards)
    setRevealed(0)
  }

  function closeReveal() {
    setReveal(null)
    setRevealed(0)
    router.refresh()
  }

  const zoomCards = openBinder ? bySet.get(openBinder) ?? [] : []

  const stepZoom = useCallback((delta: number) => {
    setZoomIndex((i) => {
      if (i === null) return i
      // Skip past cards that are entirely in the vault - their binder slot is
      // a marker, not something that can be enlarged.
      let next = i + delta
      while (next >= 0 && next < zoomCards.length && zoomCards[next].raw.length === 0) {
        next += delta
      }
      if (next < 0 || next >= zoomCards.length) return i
      setCopyIndex(0)
      return next
    })
  }, [zoomCards])

  // Keyboard: escape closes, arrows page through the binder.
  useEffect(() => {
    if (zoomIndex === null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setZoomIndex(null)
      else if (e.key === 'ArrowRight') stepZoom(1)
      else if (e.key === 'ArrowLeft') stepZoom(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoomIndex, stepZoom])

  // Leaving a binder should not leave a card floating over the shelf.
  useEffect(() => { setZoomIndex(null) }, [openBinder])

  // Grading. Copies are server props, so an accepted action is reflected
  // locally first and the refresh catches up behind it - otherwise the button
  // sits dead for a beat and invites a second tap.

  async function sendForGrading(copy: CardCopy) {
    setGrading(copy.id); setGradeNote(null)
    const supabase = createClient()
    const { data, error: err } = await supabase.rpc('submit_for_grading', {
      p_user_card_id: copy.id,
    })
    setGrading(null)
    const row = (Array.isArray(data) ? data[0] : data) as
      { ok: boolean; reason: string; ready_at: string | null } | null
    if (err || !row?.ok) {
      setGradeNote(
        row?.reason === 'insufficient_tokens' ? `Not enough tokens — grading costs ${gradingCost}.`
        : row?.reason === 'already_submitted' ? 'That copy is already with the graders.'
        : 'Could not send that card for grading.'
      )
      return
    }
    setPatch((p) => ({
      ...p,
      [copy.id]: { grading_started_at: new Date().toISOString(), grading_ready_at: row.ready_at },
    }))
    setGradeNote('Sent for grading.')
    startTransition(() => router.refresh())
  }

  async function collectGrade(card: CollectionCard, copy: CardCopy) {
    setGrading(copy.id); setGradeNote(null)
    const supabase = createClient()
    const { data, error: err } = await supabase.rpc('collect_grade', { p_user_card_id: copy.id })
    setGrading(null)
    const row = (Array.isArray(data) ? data[0] : data) as
      { ok: boolean; reason: string; grade: number | null } | null
    if (err || !row?.ok) {
      setGradeNote(row?.reason === 'not_ready' ? 'Still with the graders.' : 'Could not fetch that grade.')
      return
    }
    const graded: CardCopy = { ...copy, graded_at: new Date().toISOString(), grade: row.grade }
    setPatch((p) => ({ ...p, [copy.id]: graded }))
    // The copy leaves the binder the moment it is graded, so without this the
    // card would simply vanish under the tap that revealed it.
    setGradeReveal({ card, copy: graded })
    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-5">
      {/* ── Unopened packs ── */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display font-semibold text-base">Unopened</h2>
          <span className="font-mono text-[10px] text-muted">
            {visiblePacks.length} pack{visiblePacks.length === 1 ? '' : 's'}
          </span>
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">{error}</p>
        )}

        {visiblePacks.length === 0 ? (
          <p className="text-sm text-muted">
            No unopened packs. Buy some from the machine.
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-2">
            {visiblePacks.map((p) => (
              <li key={p.id} className="bg-card border border-card-border rounded-xl p-2 flex flex-col gap-1.5">
                <img src={p.image_url} alt={`${p.set_name} — ${p.pack_name}`} className="w-full aspect-[2/3] object-contain" loading="lazy" />
                <p className="text-[10px] text-muted text-center truncate">{p.set_name}</p>
                <button
                  onClick={() => openPack(p.id)}
                  disabled={opening}
                  className="bg-signal hover:bg-signal/90 disabled:opacity-50 text-white text-xs font-semibold rounded-lg py-1.5 transition-colors"
                >
                  {opening ? '…' : 'Open'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Raffle tickets ── */}
      {tickets.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display font-semibold text-base">Raffle Tickets</h2>
            <span className="font-mono text-[10px] text-muted">
              {tickets.reduce((n, t) => n + t.copies, 0)} held
            </span>
          </div>
          <ul className="grid grid-cols-2 gap-2">
            {tickets.map((t) => {
              const colour = TICKET_RARITY_COLOR[t.rarity] ?? TICKET_RARITY_COLOR.common
              return (
                <li
                  key={t.ticket_id}
                  className="relative bg-card rounded-xl p-2 flex gap-2 items-center"
                  style={{ border: `2px solid ${colour}` }}
                >
                  {t.image_url ? (
                    <img src={t.image_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0"
                      style={{ backgroundColor: `${colour}22` }}
                    >
                      🎟️
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate">{t.name}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wide" style={{ color: colour }}>
                      {t.rarity}
                    </p>
                  </div>
                  {t.copies > 1 && (
                    <span
                      className="shrink-0 rounded-full text-white text-[10px] font-bold px-1.5"
                      style={{ backgroundColor: colour }}
                    >
                      ×{t.copies}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* ── Collection ── */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display font-semibold text-base">Collection</h2>
          <span className="font-mono text-[10px] text-muted">
            {uniqueCards}/{allTotal} unique · {totalCards} cards
          </span>
        </div>

        {/* Raw cards live in binders, graded ones in the vault - the two do
            not mix, so they get their own shelves rather than a filter. */}
        {openBinder === null && (
          <div className="flex gap-1.5">
            {([['binders', 'Binders'], ['vault', 'Vault']] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setShelf(k)}
                className={`text-xs font-medium rounded-lg px-3 py-1.5 transition-colors ${
                  shelf === k
                    ? 'bg-ink text-white'
                    : 'border border-card-border text-muted hover:text-ink'
                }`}
                aria-pressed={shelf === k}
              >
                {label}
                {k === 'vault' && slabs.length > 0 && (
                  <span className={shelf === k ? 'text-white/60' : 'text-muted'}> · {slabs.length}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {openBinder === null && shelf === 'vault' ? (
          /* ── The vault ── */
          slabs.length === 0 ? (
            <p className="text-sm text-muted">
              Nothing graded yet. Open a card in a binder and send it off.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2.5 pt-1">
              {slabs.map(({ card, copy }, i) => (
                <button
                  key={copy.id}
                  onClick={() => setSlabIndex(i)}
                  className="block w-full transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal rounded-[6%]"
                  aria-label={`${card.name}, graded ${copy.grade}`}
                >
                  <Slab
                    condition={copy}
                    grade={copy.grade!}
                    src={card.image_url}
                    alt={card.name}
                    name={card.name}
                    number={card.number}
                    setCode={card.set_code}
                    setName={setTotals.find((s) => s.set_code === card.set_code)?.set_name ?? card.set_code}
                  />
                </button>
              ))}
            </div>
          )
        ) : openBinder === null ? (
          /* ── The shelf ── */
          uniqueCards === 0 && visiblePacks.length === 0 ? (
            <p className="text-sm text-muted">Nothing collected yet. Open a pack to start.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 pt-1">
              {setTotals.map((s) => {
                const owned = bySet.get(s.set_code)?.length ?? 0
                return (
                  <BinderCover
                    key={s.set_code}
                    setCode={s.set_code}
                    setName={s.set_name}
                    owned={owned}
                    total={s.total}
                    onOpen={() => setOpenBinder(s.set_code)}
                  />
                )
              })}
            </div>
          )
        ) : (
          /* ── An open binder ── */
          (() => {
            const s = setTotals.find((t) => t.set_code === openBinder)
            const cards = bySet.get(openBinder) ?? []
            const theme = BINDERS[openBinder] ?? DEFAULT_BINDER
            return (
              <div className="space-y-2">
                <button
                  onClick={() => setOpenBinder(null)}
                  className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to shelf
                </button>

                <div
                  className="rounded-xl px-3 py-2 flex items-baseline justify-between gap-2"
                  style={{ background: theme.body }}
                >
                  <p className="font-display font-semibold text-sm text-white">{s?.set_name ?? openBinder}</p>
                  <p className="font-mono text-[10px]" style={{ color: theme.foil }}>
                    {cards.length}/{s?.total ?? 0}
                  </p>
                </div>

                {cards.length === 0 ? (
                  <p className="text-sm text-muted py-4 text-center">
                    This binder is empty. Open a {s?.set_name} pack to fill it.
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-1.5">
                    {cards.map((c, i) => (
                      <div key={c.card_id} className="relative">
                        <button
                          onClick={() => { setZoomIndex(i); setCopyIndex(0) }}
                          disabled={c.raw.length === 0}
                          className="block w-full rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal transition-transform enabled:hover:-translate-y-0.5 disabled:cursor-default"
                          aria-label={c.raw.length === 0
                            ? `${c.name}${rarityLabel(c.rarity)}, in the vault`
                            : `Enlarge ${c.name}${rarityLabel(c.rarity)}`}
                        >
                          {c.raw.length > 0 ? (
                            /* The first copy stands in for the stack, so the
                               slot shows a card actually owned rather than
                               pristine catalogue art. */
                            <ConditionedCard
                              src={c.image_url}
                              alt={c.name}
                              condition={c.raw[0]}
                              rarity={c.rarity}
                              className={`w-full aspect-[245/342] rounded ${rarityRing(c.rarity)}`}
                            />
                          ) : (
                            /* Every copy slabbed: the slot stays filled so the
                               set still reads as complete, and says where the
                               card went. */
                            <div className="w-full aspect-[245/342] rounded border border-dashed border-card-border bg-paper flex flex-col items-center justify-center gap-1 px-1">
                              <svg className="w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24"
                                   stroke="currentColor" strokeWidth={1.5}>
                                <rect x="5" y="3" width="14" height="18" rx="2" />
                                <path d="M8 7h8" strokeLinecap="round" />
                              </svg>
                              <span className="font-mono text-[8px] text-muted text-center leading-tight">
                                in vault
                              </span>
                            </div>
                          )}
                        </button>
                        {/* Also on an "in vault" slot: that placeholder shows
                            no art and no name, so holo and plain prints of the
                            same card would otherwise be identical boxes. */}
                        <HoloMark rarity={c.rarity} />
                        {c.raw.length > 1 && (
                          <span className="pointer-events-none absolute -top-1 -right-1 rounded-full bg-ink text-white text-[9px] font-bold px-1.5 py-0.5 shadow">
                            ×{c.raw.length}
                          </span>
                        )}
                        {c.slabbed > 0 && c.raw.length > 0 && (
                          <span className="pointer-events-none absolute -bottom-1 -right-1 rounded-full bg-amber-400 text-ink text-[9px] font-bold px-1.5 py-0.5 shadow">
                            {c.slabbed}★
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })()
        )}
      </section>

      {/* ── Enlarged card ── */}
      {zoomIndex !== null && zoomCards[zoomIndex]?.raw.length > 0 && (() => {
        const c = zoomCards[zoomIndex]
        const first = zoomIndex === 0
        const last = zoomIndex === zoomCards.length - 1
        // copyIndex can outrun the stack when the arrows move to a card with
        // fewer copies, so clamp rather than trusting it.
        const ci = Math.min(copyIndex, c.raw.length - 1)
        const copy = c.raw[ci]
        return (
          <div
            className="fixed inset-0 z-50 bg-black/85 flex flex-col items-center justify-center p-4 gap-3"
            onClick={() => setZoomIndex(null)}
            role="dialog"
            aria-modal="true"
            aria-label={`${c.name}, enlarged`}
          >
            <button
              onClick={() => setZoomIndex(null)}
              className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Arrows sit at the overlay edges rather than inline, so they do
                not squeeze the card on a narrow screen. */}
            <button
              onClick={(e) => { e.stopPropagation(); stepZoom(-1) }}
              disabled={first}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center disabled:opacity-20 hover:bg-white/20 transition-colors"
              aria-label="Previous card"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Capped near the source resolution (245px wide), so enlarging
                does not just magnify compression artefacts. */}
            <div onClick={(e) => e.stopPropagation()}>
              <ConditionedCard
                src={c.image_url}
                alt={c.name}
                condition={copy}
                rarity={c.rarity}
                detail="full"
                className={`w-[min(72vw,330px)] aspect-[245/342] rounded-lg ${rarityRing(c.rarity)}`}
              />
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); stepZoom(1) }}
              disabled={last}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center disabled:opacity-20 hover:bg-white/20 transition-colors"
              aria-label="Next card"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <div className="text-center" onClick={(e) => e.stopPropagation()}>
              <p className="text-white font-semibold text-sm">{c.name}</p>
              <p className={`text-xs font-medium ${
                c.rarity === 'H' ? 'text-amber-300' : c.rarity === 'S' ? 'text-fuchsia-300' : 'text-white/50'
              }`}>
                {RARITY_LABEL[c.rarity] ?? c.rarity} · #{c.number}
              </p>

              {/* Each copy is its own object, so switching between them is
                  switching card, not just incrementing a counter. */}
              {c.raw.length > 1 && (
                <div className="flex items-center justify-center flex-wrap gap-2 mt-2.5">
                  {c.raw.map((cp, i) => {
                    const g = gradeState(cp)
                    return (
                      <button
                        key={cp.id}
                        onClick={() => setCopyIndex(i)}
                        className={`font-mono text-xs rounded-md px-2.5 py-1 min-w-[30px] transition-colors ${
                          i === ci
                            ? 'bg-white text-ink font-bold'
                            : 'bg-white/10 text-white/60 hover:bg-white/20'
                        }`}
                        aria-label={`View copy ${i + 1} of ${c.raw.length}${
                          g === 'graded' ? `, graded ${cp.grade}` : g === 'ready' ? ', grade ready' : ''
                        }`}
                        aria-pressed={i === ci}
                      >
                        {i + 1}
                        {/* A dot so a graded or waiting copy is findable
                            without opening each one in turn. */}
                        {g !== 'ungraded' && (
                          <span className={`ml-1 inline-block w-1.5 h-1.5 rounded-full align-middle ${
                            // Amber and signal orange are near-identical at
                            // 4px; ready needs action, so it gets its own hue.
                            g === 'graded' ? 'bg-amber-400'
                            : g === 'ready' ? 'bg-emerald-400'
                            : 'bg-white/40'
                          }`} />
                        )}
                      </button>
                    )
                  })}
                  <span className="font-mono text-[10px] text-white/35 ml-0.5">
                    {c.raw.length} copies
                  </span>
                </div>
              )}

              {/* Condition is visible on the card itself from the moment it
                  is pulled; the numbers behind it stay sealed until grading
                  comes back. */}
              {(() => {
                const st = gradeState(copy)
                const busy = grading === copy.id
                return (
                  <div className="mt-5">
                    {st === 'graded' && copy.grade != null && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-center gap-2">
                          <span className={`rounded-md px-2 py-0.5 font-display font-bold text-sm ${gradeTone(copy.grade)}`}>
                            {copy.grade}
                          </span>
                          <span className="text-white/80 text-xs font-medium">
                            {GRADE_LABEL[copy.grade] ?? 'Graded'}
                          </span>
                        </div>
                        {/* Unsealed: the numbers behind the wear. */}
                        <div className="grid grid-cols-4 gap-x-2 font-mono text-[9px] text-white/45">
                          <span>CEN {100 - Math.max(Math.abs(copy.center_x), Math.abs(copy.center_y))}</span>
                          <span>COR {copy.corners}</span>
                          <span>EDG {copy.edges}</span>
                          <span>SUR {copy.surface}</span>
                        </div>
                        <div className="font-mono text-[9px] text-white/45">
                          BORDER {copy.border_wear}
                        </div>
                      </div>
                    )}

                    {st === 'ungraded' && (
                      <button
                        onClick={() => setConfirmGrading({ card: c, copy })}
                        disabled={busy}
                        className="rounded-lg border border-white/25 text-white/85 text-sm font-medium px-4 py-2 hover:bg-white/10 transition-colors disabled:opacity-40"
                      >
                        {busy ? 'Sending…' : `Send for grading · ${fmt(gradingCost)} token${gradingCost === 1 ? '' : 's'}`}
                      </button>
                    )}

                    {st === 'waiting' && copy.grading_ready_at && (
                      <p className="font-mono text-[10px] text-white/45">
                        At the graders · back in {waitLabel(copy.grading_ready_at)}
                      </p>
                    )}

                    {st === 'ready' && (
                      <button
                        onClick={() => collectGrade(c, copy)}
                        disabled={busy}
                        className="rounded-lg bg-signal text-white text-sm font-semibold px-4 py-2 hover:bg-signal/90 transition-colors disabled:opacity-40"
                      >
                        {busy ? 'Opening…' : 'Grade is back — reveal'}
                      </button>
                    )}

                    {st === 'ungraded' && (
                      <p className="font-mono text-[9px] text-white/30 mt-1">
                        Takes {gradingDays} day{gradingDays === 1 ? '' : 's'}
                      </p>
                    )}

                    {gradeNote && (
                      <p className="text-[10px] text-amber-300/90 mt-1.5">{gradeNote}</p>
                    )}
                  </div>
                )
              })()}

              <p className="font-mono text-[10px] text-white/35 mt-1.5">
                {zoomIndex + 1} of {zoomCards.length}
              </p>
            </div>
          </div>
        )
      })()}

      {/* ── Enlarged slab ── */}
      {slabIndex !== null && slabs[slabIndex] && (() => {
        const { card, copy } = slabs[slabIndex]
        const setName = setTotals.find((s) => s.set_code === card.set_code)?.set_name ?? card.set_code
        return (
          <div
            className="fixed inset-0 z-50 bg-black/85 flex flex-col items-center justify-center p-4 gap-3"
            onClick={() => setSlabIndex(null)}
            role="dialog" aria-modal="true" aria-label={`${card.name}, graded ${copy.grade}`}
          >
            <button
              onClick={() => setSlabIndex(null)}
              className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div onClick={(e) => e.stopPropagation()} className="w-[min(78vw,320px)]">
              <Slab
                condition={copy} grade={copy.grade!} src={card.image_url} alt={card.name}
                name={card.name} number={card.number} setCode={card.set_code} setName={setName}
              />
            </div>

            <div className="text-center" onClick={(e) => e.stopPropagation()}>
              <div className="grid grid-cols-4 gap-x-2 font-mono text-[9px] text-white/45">
                <span>CEN {100 - Math.max(Math.abs(copy.center_x), Math.abs(copy.center_y))}</span>
                <span>COR {copy.corners}</span>
                <span>EDG {copy.edges}</span>
                <span>SUR {copy.surface}</span>
              </div>
              <p className="font-mono text-[9px] text-white/45 mt-0.5">BORDER {copy.border_wear}</p>
              <p className="font-mono text-[10px] text-white/35 mt-1.5">
                {slabIndex + 1} of {slabs.length}
              </p>
            </div>
          </div>
        )
      })()}

      {/* ── Confirm before posting a card off ── */}
      {confirmGrading && (() => {
        const { card, copy } = confirmGrading
        const busy = grading === copy.id
        return (
          <div
            className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-5"
            role="dialog" aria-modal="true" aria-labelledby="grading-confirm-title"
          >
            <div className="bg-card border border-card-border rounded-2xl p-5 max-w-sm w-full space-y-3">
              <h3 id="grading-confirm-title" className="font-display font-semibold text-base">
                Send {card.name} for grading?
              </h3>

              <p className="text-sm text-muted leading-snug">
                This is like dropping the card in a mailbox. Once it is posted you cannot cancel,
                recall it, or change your mind.
              </p>

              <ul className="text-sm text-muted space-y-1.5">
                <li className="flex gap-2">
                  <span className="text-ink font-semibold shrink-0">{fmt(gradingCost)}</span>
                  <span>token{gradingCost === 1 ? '' : 's'} charged now, and not refunded.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-ink font-semibold shrink-0">{gradingDays}</span>
                  <span>
                    day{gradingDays === 1 ? '' : 's'} away. It leaves your binder for the whole
                    wait and you cannot open or trade it.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-ink font-semibold shrink-0">★</span>
                  <span>
                    The grade is whatever the card already is — grading reveals its condition, it
                    does not improve it.
                  </span>
                </li>
              </ul>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setConfirmGrading(null)}
                  disabled={busy}
                  className="flex-1 rounded-xl border border-card-border text-sm font-medium py-2.5 text-muted hover:text-ink transition-colors disabled:opacity-40"
                >
                  Keep it
                </button>
                <button
                  onClick={async () => {
                    const target = confirmGrading
                    setConfirmGrading(null)
                    await sendForGrading(target.copy)
                  }}
                  disabled={busy}
                  className="flex-1 rounded-xl bg-signal text-white text-sm font-semibold py-2.5 hover:bg-signal/90 transition-colors disabled:opacity-40"
                >
                  {busy ? 'Posting…' : 'Post it'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── A grade coming back ── */}
      {gradeReveal && (() => {
        const { card, copy } = gradeReveal
        const setName = setTotals.find((s) => s.set_code === card.set_code)?.set_name ?? card.set_code
        return (
          <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 gap-4">
            {(copy.grade ?? 0) >= 9 && <CardCelebration rarity={copy.grade === 10 ? 'S' : 'H'} />}
            <p className="relative text-white font-display font-semibold">Back from grading</p>
            <div className="relative w-[min(70vw,280px)]">
              <Slab
                condition={copy} grade={copy.grade!} src={card.image_url} alt={card.name}
                name={card.name} number={card.number} setCode={card.set_code} setName={setName}
              />
            </div>
            <button
              onClick={() => { setGradeReveal(null); setZoomIndex(null); setShelf('vault') }}
              className="relative bg-signal text-white font-semibold rounded-xl px-6 py-2.5 text-sm"
            >
              Put it in the vault
            </button>
          </div>
        )
      })()}

      {/* ── Reveal overlay ── */}
      {reveal && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/85 flex flex-col items-center justify-center p-4 gap-4">
          {(() => {
            const idx = Math.min(revealed, reveal.length - 1)
            const card = reveal[idx]
            const done = revealed >= reveal.length
            if (done) {
              const best = [...reveal].sort((a, b) => 'CURHS'.indexOf(b.rarity) - 'CURHS'.indexOf(a.rarity))[0]
              return (
                <>
                  <p className="text-white font-display font-semibold">Pack opened</p>
                  <div className="grid grid-cols-4 gap-1.5 max-w-sm">
                    {reveal.map((c) => (
                      <ConditionedCard
                        key={c.card_id}
                        src={c.image_url}
                        alt={c.name}
                        condition={c}
                        rarity={c.rarity}
                        className={`w-full aspect-[245/342] rounded ${rarityRing(c.rarity)}`}
                      />
                    ))}
                  </div>
                  <p className="text-white/70 text-xs">
                    Best pull: <span className="font-semibold text-white">{best.name}</span> · {RARITY_LABEL[best.rarity]}
                  </p>
                  <button onClick={closeReveal} className="bg-signal text-white font-semibold rounded-xl px-6 py-2.5 text-sm">
                    Add to collection
                  </button>
                </>
              )
            }
            const special = card.rarity === 'H' || card.rarity === 'S'
            return (
              <>
                {/* Keyed by card so the animation restarts on every hit
                    rather than only the first one in a pack. */}
                {special && <CardCelebration key={card.card_id} rarity={card.rarity as 'H' | 'S'} />}

                <p className="relative font-mono text-[10px] text-white/50">
                  {idx + 1} of {reveal.length}
                </p>
                <button onClick={() => setRevealed((n) => n + 1)} className="relative block">
                  {/* Condition lands with the card, so the first look already
                      tells you whether the cut was kind to it. */}
                  <ConditionedCard
                    src={card.image_url}
                    alt={card.name}
                    condition={card}
                    rarity={card.rarity}
                    detail="full"
                    className={`h-[55vh] aspect-[245/342] rounded-lg ${rarityRing(card.rarity)} ${
                      special ? (card.rarity === 'S' ? 'vm-card-hit vm-card-secret' : 'vm-card-hit vm-card-holo') : ''
                    }`}
                  />
                </button>
                <div className="relative text-center">
                  <p className={`font-semibold ${special ? 'text-base' : 'text-sm'} text-white`}>{card.name}</p>
                  <p className={`text-xs font-medium ${
                    card.rarity === 'H' ? 'text-amber-300' : card.rarity === 'S' ? 'text-fuchsia-300' : 'text-white/50'
                  }`}>
                    {card.rarity === 'S' ? '★ SECRET RARE ★' : card.rarity === 'H' ? '✦ HOLO RARE ✦' : RARITY_LABEL[card.rarity] ?? card.rarity}
                  </p>
                </div>
                <button
                  onClick={() => setRevealed((n) => n + 1)}
                  className="relative text-white/60 text-xs underline underline-offset-2"
                >
                  {idx + 1 === reveal.length ? 'Finish' : 'Next card'}
                </button>

                <style>{`
                  @keyframes vmCardIn {
                    0%   { transform: scale(0.72) rotate(-6deg); opacity: 0; }
                    55%  { transform: scale(1.06) rotate(1.5deg); opacity: 1; }
                    100% { transform: scale(1) rotate(0deg); opacity: 1; }
                  }
                  @keyframes vmGlowHolo {
                    0%, 100% { box-shadow: 0 0 18px 2px rgba(251,191,36,0.55); }
                    50%      { box-shadow: 0 0 40px 10px rgba(251,191,36,0.85); }
                  }
                  @keyframes vmGlowSecret {
                    0%   { box-shadow: 0 0 22px 4px rgba(232,121,249,0.7); }
                    33%  { box-shadow: 0 0 34px 8px rgba(34,211,238,0.7); }
                    66%  { box-shadow: 0 0 34px 8px rgba(167,139,250,0.7); }
                    100% { box-shadow: 0 0 22px 4px rgba(232,121,249,0.7); }
                  }
                  .vm-card-hit    { animation: vmCardIn 620ms cubic-bezier(.2,.8,.3,1.1) both; }
                  .vm-card-holo   { animation: vmCardIn 620ms cubic-bezier(.2,.8,.3,1.1) both, vmGlowHolo 1.9s ease-in-out 620ms infinite; }
                  .vm-card-secret { animation: vmCardIn 620ms cubic-bezier(.2,.8,.3,1.1) both, vmGlowSecret 2.4s linear 620ms infinite; }
                  @media (prefers-reduced-motion: reduce) {
                    .vm-card-hit, .vm-card-holo, .vm-card-secret { animation: none; }
                    .vm-card-holo   { box-shadow: 0 0 20px 4px rgba(251,191,36,0.6); }
                    .vm-card-secret { box-shadow: 0 0 20px 4px rgba(232,121,249,0.6); }
                  }
                `}</style>
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}
