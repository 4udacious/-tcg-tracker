'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ShowcaseRoom, { type ShowcaseItem, type Lighting, SLOTS, SET_NAMES } from './ShowcaseRoom'
import ConditionedCard from './ConditionedCard'
import type { CollectionCard } from './CollectionPanel'

/**
 * Marks a holo or secret rare in a picker grid.
 *
 * Jungle, Fossil and Team Rocket each print about sixteen cards twice - once
 * holo, once not - with the same name and the same artwork. At thumbnail size
 * the two are identical, so without this there is no way to tell which copy
 * you are putting on the shelf. Uses the same glyphs as the pull reveal.
 */
function HoloMark({ rarity }: { rarity: string }) {
  if (rarity !== 'H' && rarity !== 'S') return null
  const secret = rarity === 'S'
  return (
    <span
      className={`pointer-events-none absolute -top-1 -left-1 rounded-full text-[9px] font-bold px-1 py-0.5 shadow leading-none ${
        secret ? 'bg-fuchsia-500 text-white' : 'bg-amber-400 text-ink'
      }`}
      title={secret ? 'Secret rare' : 'Holo rare'}
    >
      {secret ? '★' : '✦'}
    </span>
  )
}

const SHELF_OPTIONS: { value: string; label: string }[] = [
  { value: 'oak', label: 'Oak' },
  { value: 'walnut', label: 'Walnut' },
  { value: 'slate', label: 'Slate' },
  { value: 'white', label: 'White' },
]

/** The owner's view: the same room, plus the means to arrange it. */
export default function ShowcasePanel({
  initialItems, initialLighting, collection,
}: {
  initialItems: ShowcaseItem[]
  initialLighting: Lighting
  collection: CollectionCard[]
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  // Lighting is previewed locally and saved on release - dragging a slider
  // should not post on every pixel.
  const [light, setLight] = useState<Lighting>(initialLighting)
  const [items, setItems] = useState<ShowcaseItem[]>(initialItems)
  const [picking, setPicking] = useState<number | null>(null)
  // null = every set. Reset each time the picker opens, since the set you
  // wanted last time says nothing about the slot you are filling now.
  const [setFilter, setSetFilter] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const placed = useMemo(() => new Set(items.map((i) => i.user_card_id)), [items])

  /** Every copy owned, flattened, with what the room needs to draw it. */
  const candidates = useMemo(() => {
    const out: ShowcaseItem[] = []
    for (const card of collection) {
      for (const copy of card.copies) {
        out.push({
          slot: -1,
          user_card_id: copy.id,
          card_id: card.card_id,
          name: card.name,
          number: card.number,
          rarity: card.rarity,
          image_url: card.image_url,
          set_code: card.set_code,
          center_x: copy.center_x, center_y: copy.center_y,
          corners: copy.corners, edges: copy.edges,
          surface: copy.surface, border_wear: copy.border_wear,
          wear_seed: copy.wear_seed,
          grade: copy.graded_at ? copy.grade : null,
        })
      }
    }
    // Slabs first, best grade down, then the rest - the things people want to
    // show off should not be below a hundred commons.
    return out.sort((a, b) =>
      (b.grade ?? -1) - (a.grade ?? -1) || a.name.localeCompare(b.name))
  }, [collection])

  /** Only the sets this trainer actually owns something from, with counts. */
  const setTabs = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of candidates) counts.set(c.set_code, (counts.get(c.set_code) ?? 0) + 1)
    return [...counts.entries()]
      .map(([code, n]) => ({ code, name: SET_NAMES[code] ?? code, n }))
      .sort((a, b) => a.code.localeCompare(b.code))
  }, [candidates])

  const shown = useMemo(
    () => (setFilter ? candidates.filter((c) => c.set_code === setFilter) : candidates),
    [candidates, setFilter]
  )

  async function saveLighting(next: Lighting) {
    setLight(next)
    const supabase = createClient()
    const { error } = await supabase.rpc('update_showcase_lighting', {
      p_warmth: next.warmth, p_brightness: next.brightness, p_shelf: next.shelf,
    })
    if (error) setNote('Could not save the lighting.')
  }

  async function place(slot: number, pick: ShowcaseItem) {
    setBusy(true); setNote(null)
    const supabase = createClient()
    const { error } = await supabase.rpc('set_showcase_slot', {
      p_slot: slot, p_user_card_id: pick.user_card_id,
    })
    setBusy(false)
    if (error) { setNote('Could not place that card.'); return }
    setItems((prev) => [
      // A card can only stand in one place, so clear it from any other slot
      // the way the database just did.
      ...prev.filter((i) => i.slot !== slot && i.user_card_id !== pick.user_card_id),
      { ...pick, slot },
    ])
    setPicking(null)
    startTransition(() => router.refresh())
  }

  async function clear(slot: number) {
    setBusy(true); setNote(null)
    const supabase = createClient()
    const { error } = await supabase.rpc('clear_showcase_slot', { p_slot: slot })
    setBusy(false)
    if (error) { setNote('Could not clear that slot.'); return }
    setItems((prev) => prev.filter((i) => i.slot !== slot))
    setPicking(null)
    startTransition(() => router.refresh())
  }

  const occupant = picking == null ? null : items.find((i) => i.slot === picking) ?? null

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display font-semibold text-base">Showcase</h2>
        <span className="font-mono text-[10px] text-muted">
          {items.length}/{SLOTS} on display
        </span>
      </div>
      <p className="text-xs text-muted leading-snug -mt-2">
        Anyone who visits your profile sees this room, lit the way you leave it.
      </p>

      {note && (
        <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
          {note}
        </p>
      )}

      <ShowcaseRoom
        items={items}
        lighting={light}
        onSlotClick={(slot) => { setPicking(slot); setSetFilter(null) }}
      />

      {/* ── Lighting ── */}
      <div className="bg-card border border-card-border rounded-2xl p-4 space-y-3">
        <p className="text-sm font-medium text-ink">Lighting</p>

        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted">
            <label htmlFor="sc-warmth">Warmth</label>
            <span className="font-mono">{light.warmth < 35 ? 'cool' : light.warmth > 70 ? 'warm' : 'neutral'}</span>
          </div>
          <input
            id="sc-warmth" type="range" min={0} max={100} value={light.warmth}
            onChange={(e) => setLight({ ...light, warmth: Number(e.target.value) })}
            onPointerUp={() => saveLighting(light)}
            onKeyUp={() => saveLighting(light)}
            className="w-full accent-signal"
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted">
            <label htmlFor="sc-bright">Brightness</label>
            <span className="font-mono">{light.brightness}%</span>
          </div>
          <input
            id="sc-bright" type="range" min={0} max={100} value={light.brightness}
            onChange={(e) => setLight({ ...light, brightness: Number(e.target.value) })}
            onPointerUp={() => saveLighting(light)}
            onKeyUp={() => saveLighting(light)}
            className="w-full accent-signal"
          />
        </div>

        <div className="space-y-1.5">
          <p className="text-xs text-muted">Shelves</p>
          <div className="flex flex-wrap gap-1.5">
            {SHELF_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => saveLighting({ ...light, shelf: o.value })}
                className={`text-xs font-medium rounded-lg px-3 py-1.5 transition-colors ${
                  light.shelf === o.value
                    ? 'bg-ink text-white'
                    : 'border border-card-border text-muted hover:text-ink'
                }`}
                aria-pressed={light.shelf === o.value}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Picker ── */}
      {picking !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center"
          onClick={() => setPicking(null)}
          role="dialog" aria-modal="true" aria-label="Choose a card for this slot"
        >
          <div
            className="bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-4 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-baseline justify-between gap-2 shrink-0">
              <h3 className="font-display font-semibold text-base">
                Slot {picking + 1}
              </h3>
              <button onClick={() => setPicking(null)} className="text-xs text-muted hover:text-ink">
                Close
              </button>
            </div>

            {occupant && (
              <button
                onClick={() => clear(picking)}
                disabled={busy}
                className="mt-3 shrink-0 text-xs font-medium text-red-500 border border-red-500/30 rounded-lg px-3 py-2 hover:bg-red-500/10 transition-colors disabled:opacity-40"
              >
                Take {occupant.name} off the shelf
              </button>
            )}

            {candidates.length === 0 ? (
              <p className="text-sm text-muted mt-4">
                Nothing to display yet. Open a pack first.
              </p>
            ) : (
              <>
                {/* Only worth a tab row once there is more than one set to
                    choose between. */}
                {setTabs.length > 1 && (
                  <div className="flex gap-1.5 mt-3 overflow-x-auto shrink-0 pb-0.5">
                    <button
                      onClick={() => setSetFilter(null)}
                      className={`shrink-0 text-xs font-medium rounded-lg px-2.5 py-1.5 transition-colors ${
                        setFilter === null
                          ? 'bg-ink text-white'
                          : 'border border-card-border text-muted hover:text-ink'
                      }`}
                      aria-pressed={setFilter === null}
                    >
                      All <span className={setFilter === null ? 'text-white/60' : ''}>{candidates.length}</span>
                    </button>
                    {setTabs.map((t) => (
                      <button
                        key={t.code}
                        onClick={() => setSetFilter(t.code)}
                        className={`shrink-0 text-xs font-medium rounded-lg px-2.5 py-1.5 transition-colors ${
                          setFilter === t.code
                            ? 'bg-ink text-white'
                            : 'border border-card-border text-muted hover:text-ink'
                        }`}
                        aria-pressed={setFilter === t.code}
                      >
                        {t.name} <span className={setFilter === t.code ? 'text-white/60' : ''}>{t.n}</span>
                      </button>
                    ))}
                  </div>
                )}

              <ul className="grid grid-cols-4 gap-2 mt-3 overflow-y-auto">
                {shown.map((c) => {
                  const already = placed.has(c.user_card_id)
                  return (
                    <li key={c.user_card_id}>
                      <button
                        onClick={() => place(picking, c)}
                        disabled={busy}
                        className="block w-full relative rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal disabled:opacity-40"
                        // The badge is no help to a screen reader, which would
                        // otherwise hear two identical "Put Haunter" buttons.
                        aria-label={
                          `Put ${c.name}` +
                          (c.rarity === 'S' ? ', secret rare' : c.rarity === 'H' ? ', holo' : '') +
                          (c.grade != null ? `, graded ${c.grade}` : '') +
                          `, in slot ${picking + 1}`
                        }
                      >
                        <ConditionedCard
                          src={c.image_url} alt={c.name} condition={c} rarity={c.rarity}
                          className={`w-full aspect-[245/342] rounded ${already ? 'opacity-45' : ''}`}
                        />
                        <HoloMark rarity={c.rarity} />
                        {c.grade != null && (
                          <span className="absolute -top-1 -right-1 rounded-full bg-amber-400 text-ink text-[9px] font-bold px-1.5 py-0.5 shadow">
                            {c.grade}
                          </span>
                        )}
                        {already && (
                          <span className="absolute inset-x-0 bottom-0 bg-ink/80 text-white text-[8px] font-mono text-center py-0.5 rounded-b">
                            on shelf
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
