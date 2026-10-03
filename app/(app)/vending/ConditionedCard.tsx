'use client'

import { useMemo } from 'react'

export interface Condition {
  center_x: number
  center_y: number
  corners: number
  edges: number
  surface: number
  wear_seed: number
}

/**
 * How far off-centre the worst card can look, as a percentage of card width
 * in each direction. The image is overscanned by twice this so there is slack
 * to slide into: at centre_x = 100 one border crops to nothing and the
 * opposite one doubles, which is what a badly cut card actually looks like.
 */
const TRAVEL = 3
const OVERSCAN = 1 + (TRAVEL * 2) / 100

/** Deterministic PRNG so a given copy always wears the same way. */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * A collected card with its condition drawn on top.
 *
 * One layer of artwork per card, never one per condition: centering is a crop
 * offset, and wear is gradients and hairlines composited above the image. So
 * 3,784 copies share 102 source images and still all look different.
 *
 * `detail="full"` adds the scratches, dents and holo swirl. Those are extra
 * DOM nodes per card, so the grid stays on "thumb" - at four columns the
 * hairlines would be sub-pixel there anyway.
 */
export default function ConditionedCard({
  src, alt, condition, rarity, detail = 'thumb', className = '', frameClassName = '',
}: {
  src: string
  alt: string
  condition: Condition
  rarity?: string
  detail?: 'thumb' | 'full'
  /** Applied to the clipping frame (sizing, ring, radius). */
  className?: string
  /** Extra classes for the inner stack, rarely needed. */
  frameClassName?: string
}) {
  const { center_x, center_y, corners, edges, surface, wear_seed } = condition

  const layers = useMemo(() => {
    const rnd = mulberry32(wear_seed || 1)

    // 0 = flawless, 1 = destroyed.
    const cw = Math.max(0, (100 - corners) / 100)
    const ew = Math.max(0, (100 - edges) / 100)
    const sw = Math.max(0, (100 - surface) / 100)

    // Corner fraying: white blooms, each corner worn its own amount so the
    // card does not look symmetrically stamped.
    const cornerPos = ['0% 0%', '100% 0%', '0% 100%', '100% 100%']
    const corner = cornerPos.map((pos) => {
      const amt = cw * (0.55 + rnd() * 0.9)
      // Tight radius: fraying belongs at the corner, not bloomed across the
      // art. The hard inner stop keeps it from reading as a soft glow.
      const r = 5 + amt * 11
      return `radial-gradient(ellipse ${r}% ${r * 0.74}% at ${pos}, ` +
             `rgba(255,255,255,${Math.min(0.95, amt * 1.35).toFixed(3)}) 0%, ` +
             `rgba(255,255,255,${Math.min(0.5, amt * 0.5).toFixed(3)}) 45%, ` +
             `rgba(255,255,255,0) 100%)`
    })

    // Edge whitening, again uneven side to side.
    const sides: [string, string][] = [
      ['to right', 'left'], ['to left', 'right'],
      ['to bottom', 'top'], ['to top', 'bottom'],
    ]
    const edge = sides.map(([dir]) => {
      const amt = ew * (0.4 + rnd() * 1.0)
      // A crisp fringe hugging the cut, fading fast. Wide and soft reads as
      // a lighting effect rather than a worn edge.
      const w = (0.7 + amt * 1.9).toFixed(2)
      return `linear-gradient(${dir}, rgba(255,255,255,${Math.min(0.95, amt * 1.15).toFixed(3)}) 0%, ` +
             `rgba(255,255,255,0) ${w}%)`
    })

    // Scratches: hairlines at shallow angles. Count and contrast both scale
    // with surface wear, so a 95 card gets one faint line and a 45 gets a mess.
    const scratches = detail === 'full'
      ? Array.from({ length: Math.round(sw * 11) }, () => ({
          top: `${rnd() * 96}%`,
          left: `${-10 + rnd() * 50}%`,
          width: `${18 + rnd() * 62}%`,
          angle: (rnd() - 0.5) * 70,
          opacity: 0.18 + sw * rnd() * 0.72,
          thick: rnd() < 0.22,
        }))
      : []

    // Dents and print nicks: small soft dark spots.
    const dents = detail === 'full'
      ? Array.from({ length: Math.round(sw * 5) }, () => ({
          top: `${4 + rnd() * 90}%`,
          left: `${4 + rnd() * 90}%`,
          size: `${2 + rnd() * 5}%`,
          opacity: 0.12 + sw * rnd() * 0.4,
        }))
      : []

    return {
      background: [...corner, ...edge].join(', '),
      scratches,
      dents,
      swirl: rnd() * 360,
    }
  }, [corners, edges, surface, wear_seed, detail])

  const holo = detail === 'full' && (rarity === 'H' || rarity === 'S')

  return (
    <div className={`relative overflow-hidden isolate ${className}`}>
      <div className={`absolute inset-0 ${frameClassName}`}>
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            // Scale first, then slide: the translate percentages stay
            // relative to the unscaled box, so TRAVEL means what it says.
            transform: `translate(${((center_x / 100) * TRAVEL).toFixed(3)}%, ` +
                       `${((center_y / 100) * TRAVEL).toFixed(3)}%) scale(${OVERSCAN})`,
          }}
        />

        {/* Holo swirl, under the wear so scratches read as being on top of
            the foil rather than beneath it. Confined to the art window: these
            sets foil the picture only, so running it full-bleed tints the
            text box too and reads as a filter over the card rather than foil
            in it. Inset matches the Base-era layout every set here uses. */}
        {holo && (
          <div
            className="absolute pointer-events-none opacity-25"
            style={{
              top: '12.5%', bottom: '53%', left: '8%', right: '8%',
              mixBlendMode: 'color-dodge',
              background:
                `repeating-conic-gradient(from ${layers.swirl.toFixed(1)}deg at 50% 45%, ` +
                'rgba(56,189,248,0.55) 0deg, rgba(167,139,250,0.2) 14deg, ' +
                'rgba(244,114,182,0.5) 28deg, rgba(56,189,248,0.55) 42deg)',
            }}
          />
        )}

        {/* Corner and edge wear. */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: layers.background }}
        />

        {layers.scratches.map((s, i) => (
          <span
            key={`s${i}`}
            className="absolute pointer-events-none"
            style={{
              top: s.top, left: s.left, width: s.width,
              height: s.thick ? 1.6 : 0.8,
              background: 'rgba(255,255,255,0.95)',
              opacity: s.opacity,
              transform: `rotate(${s.angle.toFixed(1)}deg)`,
              transformOrigin: 'left center',
            }}
          />
        ))}

        {layers.dents.map((d, i) => (
          <span
            key={`d${i}`}
            className="absolute rounded-full pointer-events-none"
            style={{
              top: d.top, left: d.left, width: d.size, aspectRatio: '1',
              background: 'radial-gradient(circle, rgba(60,50,40,0.9) 0%, rgba(60,50,40,0) 72%)',
              opacity: d.opacity,
            }}
          />
        ))}
      </div>
    </div>
  )
}
