'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ShowcaseRoom, { type ShowcaseItem, type Lighting, SLOTS } from './ShowcaseRoom'
import ConditionedCard from './ConditionedCard'
import type { CollectionCard } from './CollectionPanel'

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

      <ShowcaseRoom items={items} lighting={light} onSlotClick={setPicking} />

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
              <ul className="grid grid-cols-4 gap-2 mt-3 overflow-y-auto">
                {candidates.map((c) => {
                  const already = placed.has(c.user_card_id)
                  return (
                    <li key={c.user_card_id}>
                      <button
                        onClick={() => place(picking, c)}
                        disabled={busy}
                        className="block w-full relative rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal disabled:opacity-40"
                        aria-label={`Put ${c.name} in slot ${picking + 1}`}
                      >
                        <ConditionedCard
                          src={c.image_url} alt={c.name} condition={c} rarity={c.rarity}
                          className={`w-full aspect-[245/342] rounded ${already ? 'opacity-45' : ''}`}
                        />
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
            )}
          </div>
        </div>
      )}
    </div>
  )
}
