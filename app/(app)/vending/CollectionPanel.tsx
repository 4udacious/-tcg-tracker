'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import CardCelebration from './CardCelebration'

export interface UnopenedPack {
  id: number
  set_name: string
  pack_name: string
  image_url: string
}

export interface CollectionCard {
  card_id: number
  set_code: string
  number: string
  name: string
  rarity: string
  image_url: string
  copies: number
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
}

interface Props {
  packs: UnopenedPack[]
  collection: CollectionCard[]
  setTotals: SetTotal[]
}

const RARITY_LABEL: Record<string, string> = {
  C: 'Common', U: 'Uncommon', R: 'Rare', H: 'Holo Rare', S: 'Secret Rare',
}

/**
 * Binder styling per set. The cover art reuses a pack wrapper we already
 * ship, so the shelf needs no new image assets and each binder is
 * recognisably its set.
 */
const BINDERS: Record<string, { cover: string; spine: string; body: string; foil: string }> = {
  base1: { cover: '/packs/base-set-charizard.webp',     spine: '#7f1d1d', body: '#b91c1c', foil: '#fca5a5' },
  base2: { cover: '/packs/jungle-scyther.webp',         spine: '#14532d', body: '#166534', foil: '#86efac' },
  base3: { cover: '/packs/fossil-aerodactyl.webp',      spine: '#1e3a5f', body: '#1e4976', foil: '#93c5fd' },
  base5: { cover: '/packs/team-rocket-giovanni.webp',   spine: '#1c1917', body: '#292524', foil: '#d6d3d1' },
}

const DEFAULT_BINDER = { cover: '', spine: '#334155', body: '#475569', foil: '#cbd5e1' }

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
            className={`w-full h-full object-contain p-1.5 ${empty ? 'grayscale' : ''}`}
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

export default function CollectionPanel({ packs, collection, setTotals }: Props) {
  const router = useRouter()
  const [opening, setOpening] = useState(false)
  const [reveal, setReveal] = useState<RevealCard[] | null>(null)
  const [revealed, setRevealed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  // null = the shelf; a set_code = that binder is open.
  const [openBinder, setOpenBinder] = useState<string | null>(null)

  const bySet = useMemo(() => {
    const map = new Map<string, CollectionCard[]>()
    for (const c of collection) {
      if (!map.has(c.set_code)) map.set(c.set_code, [])
      map.get(c.set_code)!.push(c)
    }
    for (const list of map.values()) {
      list.sort((a, b) => Number(a.number) - Number(b.number))
    }
    return map
  }, [collection])

  const totalCards = collection.reduce((n, c) => n + c.copies, 0)
  const uniqueCards = collection.length
  const allTotal = setTotals.reduce((n, s) => n + s.total, 0)

  async function openPack(id: number) {
    setOpening(true); setError(null)
    const supabase = createClient()
    const { data, error: err } = await supabase.rpc('open_pack', { p_user_pack_id: id })
    setOpening(false)
    if (err) { setError(err.message.replace(/^.*?:\s*/, '')); return }
    const cards = ((data as RevealCard[]) ?? []).sort((a, b) => a.slot - b.slot)
    setReveal(cards)
    setRevealed(0)
  }

  function closeReveal() {
    setReveal(null)
    setRevealed(0)
    router.refresh()
  }

  return (
    <div className="space-y-5">
      {/* ── Unopened packs ── */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display font-semibold text-base">Unopened</h2>
          <span className="font-mono text-[10px] text-muted">
            {packs.length} pack{packs.length === 1 ? '' : 's'}
          </span>
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">{error}</p>
        )}

        {packs.length === 0 ? (
          <p className="text-sm text-muted">
            No unopened packs. Buy some from the machine.
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-2">
            {packs.map((p) => (
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

      {/* ── Collection ── */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display font-semibold text-base">Collection</h2>
          <span className="font-mono text-[10px] text-muted">
            {uniqueCards}/{allTotal} unique · {totalCards} cards
          </span>
        </div>

        {openBinder === null ? (
          /* ── The shelf ── */
          uniqueCards === 0 && packs.length === 0 ? (
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
                    {cards.map((c) => (
                      <div key={c.card_id} className="relative">
                        <img
                          src={c.image_url}
                          alt={c.name}
                          title={`${c.name} · ${RARITY_LABEL[c.rarity] ?? c.rarity} · #${c.number}`}
                          className={`w-full aspect-[245/342] object-contain rounded bg-white ${rarityRing(c.rarity)}`}
                          loading="lazy"
                        />
                        {c.copies > 1 && (
                          <span className="absolute -top-1 -right-1 rounded-full bg-ink text-white text-[9px] font-bold px-1.5 py-0.5 shadow">
                            ×{c.copies}
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
                      <img
                        key={c.card_id}
                        src={c.image_url}
                        alt={c.name}
                        className={`w-full aspect-[245/342] object-contain rounded bg-white ${rarityRing(c.rarity)}`}
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
                  <img
                    src={card.image_url}
                    alt={card.name}
                    className={`max-h-[55vh] w-auto rounded-lg bg-white ${rarityRing(card.rarity)} ${
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
