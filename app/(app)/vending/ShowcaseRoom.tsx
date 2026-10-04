'use client'

import { useMemo } from 'react'
import ConditionedCard, { type Condition } from './ConditionedCard'
import Slab from './Slab'

export interface ShowcaseItem extends Condition {
  slot: number
  user_card_id: number
  card_id: number
  name: string
  number: string
  rarity: string
  image_url: string
  set_code: string
  /** null when the card is raw rather than slabbed. */
  grade: number | null
}

export interface Lighting {
  warmth: number
  brightness: number
  shelf: string
  /** white = the warmth slider, colour = a fixed hue, rgb = cycling. */
  light_mode?: 'white' | 'colour' | 'rgb'
  hue?: number
}

export const SHELVES = 4
export const PER_SHELF = 3
export const SLOTS = SHELVES * PER_SHELF

export const SET_NAMES: Record<string, string> = {
  base1: 'Base Set', base2: 'Jungle', base3: 'Fossil', base5: 'Team Rocket',
}

/** Plank face, its lit edge, and the back wall the shelf hangs on. */
const SHELF_STYLES: Record<string, { face: string; edge: string; wall: string }> = {
  oak:    { face: '#a9762f', edge: '#d8a257', wall: '#2a1f16' },
  walnut: { face: '#5a3824', edge: '#8a5a38', wall: '#241812' },
  slate:  { face: '#3d434d', edge: '#656d79', wall: '#171a1f' },
  white:  { face: '#ddd8cf', edge: '#f6f2ea', wall: '#2b2a28' },
}

/**
 * The lamp colour, cold white through warm amber.
 *
 * Returned as an "r, g, b" string so callers can set their own alpha, which
 * they need constantly - the same colour appears as a bulb, a wash and a
 * bounce off the plank at three different strengths.
 */
export function lightRgb(warmth: number): string {
  const t = Math.max(0, Math.min(100, warmth)) / 100
  const r = Math.round(186 + (255 - 186) * t)
  const g = Math.round(214 + (198 - 214) * t)
  const b = Math.round(255 + (118 - 255) * t)
  return `${r}, ${g}, ${b}`
}

/** Saturated lamp colour for a hue, in the same "r, g, b" form. */
export function hueRgb(hue: number, sat = 0.82, light = 0.62): string {
  const h = ((hue % 360) + 360) % 360 / 60
  const c = (1 - Math.abs(2 * light - 1)) * sat
  const x = c * (1 - Math.abs((h % 2) - 1))
  const m = light - c / 2
  const [r, g, b] =
    h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x]
    : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x]
  return [r, g, b].map((v) => Math.round((v + m) * 255)).join(', ')
}

/**
 * The lamp colour for a room, whichever mode it is in.
 *
 * `rgb` starts at red and is cycled by a CSS hue-rotate on the light layers
 * only - rotating the whole room would drag the card art round with it.
 */
export function lightColor(l: Lighting): string {
  if (l.light_mode === 'rgb') return hueRgb(0)
  if (l.light_mode === 'colour') return hueRgb(l.hue ?? 280)
  return lightRgb(l.warmth)
}

function Item({ item }: { item: ShowcaseItem }) {
  const setName = SET_NAMES[item.set_code] ?? item.set_code
  if (item.grade != null) {
    return (
      <Slab
        condition={item} grade={item.grade} src={item.image_url} alt={item.name}
        name={item.name} number={item.number} setCode={item.set_code} setName={setName}
        className="w-full"
      />
    )
  }
  return (
    <ConditionedCard
      src={item.image_url} alt={item.name} condition={item} rarity={item.rarity}
      detail="full" className="w-full aspect-[245/342] rounded-[3%] shadow-lg"
    />
  )
}

/**
 * A trainer's display room.
 *
 * Read-only by default. The owner's own view passes `onSlotClick` to make the
 * slots interactive, which is the only difference between arranging your room
 * and visiting someone else's.
 */
export default function ShowcaseRoom({
  items, lighting, onSlotClick,
}: {
  items: ShowcaseItem[]
  lighting: Lighting
  onSlotClick?: (slot: number) => void
}) {
  const bySlot = useMemo(() => {
    const m = new Map<number, ShowcaseItem>()
    for (const it of items) m.set(it.slot, it)
    return m
  }, [items])

  const rgb = lightColor(lighting)
  // Applied to the light layers only. Rotating the whole room would spin the
  // hue of every card as well, which is the one thing that must stay true.
  const cycling = lighting.light_mode === 'rgb' ? 'sc-rgb' : ''
  // Never fully dark: at zero the room is dim, not off, or an empty showcase
  // would look broken rather than unlit.
  const b = 0.18 + (Math.max(0, Math.min(100, lighting.brightness)) / 100) * 0.82
  const style = SHELF_STYLES[lighting.shelf] ?? SHELF_STYLES.oak

  return (
    <div className="relative rounded-2xl overflow-hidden" style={{ background: style.wall }}>
      {/* The wall picks up a little of the lamp, which is what stops a warm
          room and a cold one from looking like the same room. Its own layer,
          so the cycle can rotate it without touching the cards. */}
      <div
        className={`absolute inset-0 pointer-events-none ${cycling}`}
        style={{
          background:
            `linear-gradient(180deg, rgba(${rgb},${(b * 0.13).toFixed(3)}) 0%, ` +
            `rgba(${rgb},0) 55%)`,
        }}
      />

      <div className="relative px-3 pt-4 pb-3 space-y-5">
        {Array.from({ length: SHELVES }, (_, shelfIndex) => (
          <div key={shelfIndex} className="relative">
            {/* The strip light above this shelf. */}
            <div
              className={`absolute left-[8%] right-[8%] -top-1 h-[2px] rounded-full pointer-events-none ${cycling}`}
              style={{
                background: `rgba(${rgb},${(b * 0.95).toFixed(3)})`,
                boxShadow: `0 0 ${(10 + b * 20).toFixed(0)}px ${(3 + b * 7).toFixed(0)}px rgba(${rgb},${(b * 0.45).toFixed(3)})`,
              }}
            />
            {/* Its wash falling over whatever is on the shelf. */}
            <div
              className={`absolute inset-x-0 top-0 bottom-2 pointer-events-none ${cycling}`}
              style={{
                background: `linear-gradient(180deg, rgba(${rgb},${(b * 0.3).toFixed(3)}) 0%, rgba(${rgb},0) 72%)`,
              }}
            />

            <div className="relative grid gap-2.5 items-end px-2 pt-3"
                 style={{ gridTemplateColumns: `repeat(${PER_SHELF}, minmax(0,1fr))` }}>
              {Array.from({ length: PER_SHELF }, (_, col) => {
                const slot = shelfIndex * PER_SHELF + col
                const item = bySlot.get(slot)
                const interactive = !!onSlotClick

                const content = item
                  ? <Item item={item} />
                  : (
                    <div
                      className="w-full aspect-[100/161] rounded-lg flex items-center justify-center"
                      style={{
                        border: `1px dashed rgba(${rgb},${(b * 0.3).toFixed(3)})`,
                        background: `rgba(255,255,255,0.03)`,
                      }}
                    >
                      {interactive && (
                        <span className="text-lg leading-none" style={{ color: `rgba(${rgb},${(b * 0.7).toFixed(3)})` }}>
                          +
                        </span>
                      )}
                    </div>
                  )

                return (
                  <div key={slot} className="relative">
                    {interactive ? (
                      <button
                        onClick={() => onSlotClick(slot)}
                        className="block w-full transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal rounded-lg"
                        aria-label={item ? `Change ${item.name} on shelf` : `Add a card to slot ${slot + 1}`}
                      >
                        {content}
                      </button>
                    ) : content}

                    {/* What the plank throws back up under the item. */}
                    {item && (
                      <div
                        className="absolute inset-x-1 -bottom-0.5 h-2 rounded-[50%] pointer-events-none blur-[2px]"
                        style={{ background: `rgba(0,0,0,${(0.55 - b * 0.2).toFixed(3)})` }}
                      />
                    )}
                  </div>
                )
              })}
            </div>

            {/* The plank itself: a lit front edge over a shadowed face. */}
            <div className="relative mt-1">
              <div className="h-[3px] rounded-t-sm"
                   style={{ background: style.edge, opacity: 0.35 + b * 0.65 }} />
              <div className="h-[9px] rounded-b-sm"
                   style={{
                     background: `linear-gradient(180deg, ${style.face} 0%, rgba(0,0,0,0.55) 100%)`,
                     boxShadow: '0 6px 12px rgba(0,0,0,0.55)',
                   }} />
            </div>
          </div>
        ))}
      </div>

      {lighting.light_mode === 'rgb' && (
        <style>{`
          @keyframes scRgb { to { filter: hue-rotate(360deg); } }
          .sc-rgb { animation: scRgb 8s linear infinite; }
          @media (prefers-reduced-motion: reduce) {
            /* Still coloured, just not moving. */
            .sc-rgb { animation: none; filter: hue-rotate(265deg); }
          }
        `}</style>
      )}
    </div>
  )
}
