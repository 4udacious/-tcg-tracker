'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ShowcaseRoom, { type ShowcaseItem, type Lighting, SLOTS, SET_NAMES, lightRgb, hueRgb } from './ShowcaseRoom'
import ConditionedCard from './ConditionedCard'
import type { CollectionCard, OwnedBox } from './CollectionPanel'
import HoloMark, { rarityLabel } from './HoloMark'
import { Sheet } from '@/components/ui/Sheet'

const SHELF_OPTIONS: { value: string; label: string }[] = [
  { value: 'oak', label: 'Oak' },
  { value: 'walnut', label: 'Walnut' },
  { value: 'slate', label: 'Slate' },
  { value: 'white', label: 'White' },
]

/** The owner's view: the same room, plus the means to arrange it. */
export default function ShowcasePanel({
  initialItems, initialLighting, collection, boxes = [],
}: {
  initialItems: ShowcaseItem[]
  initialLighting: Lighting
  collection: CollectionCard[]
  /** Sealed booster boxes, which can stand on a shelf too. */
  boxes?: OwnedBox[]
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

  // What is already out, keyed by kind and id: a card and a box can share an id.
  const keyOf = (i: ShowcaseItem) => (i.item_kind === 'box' ? `b${i.user_box_id}` : `c${i.user_card_id}`)
  const placed = useMemo(() => new Set(items.map(keyOf)), [items])

  /** Every copy owned, flattened, with what the room needs to draw it. */
  const candidates = useMemo(() => {
    const out: ShowcaseItem[] = []
    for (const card of collection) {
      for (const copy of card.copies) {
        // Away at the cleaners: the shelf cannot hold what is not here.
        if (copy.cleaning_started_at) continue
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
          crease: copy.crease, holes: copy.holes, rips: copy.rips,
          grade: copy.graded_at ? copy.grade : null,
        })
      }
    }
    // Slabs first, best grade down, then the rest - the things people want to
    // show off should not be below a hundred commons.
    out.sort((a, b) =>
      (b.grade ?? -1) - (a.grade ?? -1) || a.name.localeCompare(b.name))
    // Sealed boxes lead: there are only ever a few, and they are the showpieces.
    const sealed: ShowcaseItem[] = boxes.map((b) => ({
      slot: -1, item_kind: 'box', user_box_id: b.id, user_card_id: null, card_id: null,
      name: b.name, number: '', rarity: '', image_url: b.image_url ?? '', set_code: b.set_code,
      center_x: 0, center_y: 0, corners: 100, edges: 100, surface: 100, border_wear: 100, wear_seed: 0,
      crease: 0, holes: 0, rips: 0, grade: null,
    }))
    return [...sealed, ...out]
  }, [collection, boxes])

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
      p_mode: next.light_mode ?? 'white', p_hue: next.hue ?? 280,
    })
    if (error) setNote('Could not save the lighting.')
  }

  async function place(slot: number, pick: ShowcaseItem) {
    setBusy(true); setNote(null)
    const supabase = createClient()
    const box = pick.item_kind === 'box'
    const { error } = box
      ? await supabase.rpc('set_showcase_box_slot', { p_slot: slot, p_user_box_id: pick.user_box_id })
      : await supabase.rpc('set_showcase_slot', { p_slot: slot, p_user_card_id: pick.user_card_id })
    setBusy(false)
    if (error) { setNote(box ? 'Could not place that box.' : 'Could not place that card.'); return }
    setItems((prev) => [
      // A card (or box) can only stand in one place, so clear it from any
      // other slot the way the database just did.
      ...prev.filter((i) => i.slot !== slot && keyOf(i) !== keyOf(pick)),
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

        {/* Mode first: it decides which of the two colour controls below is
            even meaningful. */}
        <div className="flex gap-1.5">
          {([['white', 'White'], ['colour', 'Colour'], ['rgb', 'RGB']] as const).map(([k, label]) => {
            const on = (light.light_mode ?? 'white') === k
            return (
              <button
                key={k}
                onClick={() => saveLighting({ ...light, light_mode: k })}
                className={`flex-1 text-xs font-medium rounded-lg px-2 py-1.5 transition-colors ${
                  on ? 'bg-ink text-white' : 'border border-card-border text-muted hover:text-ink'
                }`}
                aria-pressed={on}
              >
                {label}
              </button>
            )
          })}
        </div>

        {(light.light_mode ?? 'white') === 'white' ? (
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
              className="w-full"
              style={{ accentColor: `rgb(${lightRgb(light.warmth)})` }}
            />
          </div>
        ) : light.light_mode === 'colour' ? (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted">
              <label htmlFor="sc-hue">Colour</label>
              <span className="font-mono">{light.hue ?? 280}&deg;</span>
            </div>
            {/* The track is the spectrum itself, so the slider shows what it
                selects rather than needing a swatch beside it. */}
            <input
              id="sc-hue" type="range" min={0} max={359} value={light.hue ?? 280}
              onChange={(e) => setLight({ ...light, hue: Number(e.target.value) })}
              onPointerUp={() => saveLighting(light)}
              onKeyUp={() => saveLighting(light)}
              className="w-full h-2 appearance-none rounded-full cursor-pointer"
              style={{
                background:
                  'linear-gradient(90deg, hsl(0 82% 62%), hsl(60 82% 62%), hsl(120 82% 62%), ' +
                  'hsl(180 82% 62%), hsl(240 82% 62%), hsl(300 82% 62%), hsl(360 82% 62%))',
                accentColor: `rgb(${hueRgb(light.hue ?? 280)})`,
              }}
            />
          </div>
        ) : (
          <p className="text-xs text-muted leading-snug">
            The shelf lights cycle through the spectrum. Brightness still applies.
          </p>
        )}

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
      <Sheet open={picking !== null} onClose={() => setPicking(null)} wide
        title={picking !== null ? `Slot ${picking + 1}: choose a card${boxes.length ? ' or box' : ''}` : ''}>
        {picking !== null && (
          <>

            {occupant && (
              <button
                onClick={() => clear(picking)}
                disabled={busy}
                className="w-full min-h-10 shrink-0 text-xs font-medium text-red-500 border border-red-500/30 rounded-lg px-3 py-2 hover:bg-red-500/10 transition-colors disabled:opacity-40"
              >
                Take {occupant.name} off the shelf
              </button>
            )}

            {candidates.length === 0 ? (
              <p className="text-sm text-muted mt-4">
                Nothing to display yet. Open a pack, or buy a sealed box.
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
                  const already = placed.has(keyOf(c))
                  if (c.item_kind === 'box') {
                    return (
                      <li key={keyOf(c)}>
                        <button
                          onClick={() => place(picking, c)}
                          disabled={busy}
                          className="block w-full relative rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal disabled:opacity-40"
                          aria-label={`Put the sealed ${c.name} in slot ${picking + 1}`}
                        >
                          <div className={`w-full aspect-[245/342] rounded bg-white flex items-center justify-center overflow-hidden ${already ? 'opacity-45' : ''}`}>
                            {c.image_url && <img src={c.image_url} alt="" className="w-full object-contain" />}
                          </div>
                          <span className="absolute inset-x-0 bottom-0 bg-ink/80 text-white text-[10px] font-mono text-center py-0.5 rounded-b">
                            {already ? 'on shelf' : 'sealed box'}
                          </span>
                        </button>
                      </li>
                    )
                  }
                  return (
                    <li key={keyOf(c)}>
                      <button
                        onClick={() => place(picking, c)}
                        disabled={busy}
                        className="block w-full relative rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal disabled:opacity-40"
                        // The badge is no help to a screen reader, which would
                        // otherwise hear two identical "Put Haunter" buttons.
                        aria-label={
                          `Put ${c.name}` + rarityLabel(c.rarity) +
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
                          <span className="absolute -top-1 -right-1 rounded-full bg-amber-400 text-ink text-[10px] font-bold px-1.5 py-0.5 shadow">
                            {c.grade}
                          </span>
                        )}
                        {already && (
                          <span className="absolute inset-x-0 bottom-0 bg-ink/80 text-white text-[10px] font-mono text-center py-0.5 rounded-b">
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
          </>
        )}
      </Sheet>
    </div>
  )
}
