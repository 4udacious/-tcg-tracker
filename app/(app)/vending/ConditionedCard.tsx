'use client'

import { useMemo } from 'react'
import { borderColor } from './cardBorders'

export interface Condition {
  center_x: number
  center_y: number
  corners: number
  edges: number
  surface: number
  /** The coloured border going chalky, distinct from the cut itself. */
  border_wear: number
  wear_seed: number
}

/**
 * Centering is the width of the border, not a crop.
 *
 * The art sits inside a frame painted the card's own yellow, inset by MARGIN
 * on every side. Shifting it spends margin from one side and adds it to the
 * other, so the border goes thin on one edge and fat on the opposite one -
 * which is exactly what a miscut card is. Nothing is cropped and the whole
 * picture stays visible, unlike the earlier overscan approach, which ate the
 * card's yellow border to buy its travel.
 *
 * At centre 100 the borders land around 69/31. MARGIN trades travel against
 * how thick a well-cut card's border looks, since the frame margin adds to
 * the border already in the scan.
 */
const MARGIN = 2.2
/** Card aspect, for expressing a width-relative inset as a height percentage. */
const VK = 245 / 342

/**
 * Card units for the wear overlay's SVG. Marks are authored against the
 * source art's pixel dimensions and stretched to whatever size the card is
 * drawn at, so a scratch sits in the same place on a thumbnail and enlarged.
 */
const W = 245
const H = 342

type WhiteBand = { d: string; alpha: number }

type Scratch = {
  d: string
  width: number
  alpha: number
  dark: boolean
  kind: 'hair' | 'nick' | 'scrape' | 'gouge'
}

/** A point on one of the four edges, kept off the very corners. */
function edgePoint(rnd: () => number, side: number): [number, number] {
  const t = 0.12 + rnd() * 0.76
  switch (side) {
    case 0:  return [t * W, 0]
    case 1:  return [W, t * H]
    case 2:  return [t * W, H]
    default: return [0, t * H]
  }
}

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
  const { center_x, center_y, corners, edges, surface, border_wear, wear_seed } = condition

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

    // Border whitening: the card's white core showing through the ink along
    // the cut. Not a haze spreading inward across the border face - a thin
    // ragged fringe hugging the very edge, thick in places, gone in others,
    // heaviest at the corners. Drawn as filled bands whose inner boundary
    // wobbles, because the tell is the raggedness; a smooth one reads as a
    // glow or a drop shadow.
    //
    // This is the one mark kept at thumbnail size: in a binder grid it is
    // the clearest signal that a card is worn.
    const bw = Math.max(0, (100 - border_wear) / 100)
    const whitening: WhiteBand[] = []
    if (bw > 0.02) {
      const runsPerEdge = Math.max(1, Math.round(1 + bw * (detail === 'full' ? 3.2 : 2)))
      for (let side = 0; side < 4; side++) {
        const along = side < 2 ? W : H
        for (let i = 0; i < runsPerEdge; i++) {
          // Biased toward both ends: whitening starts at the corners, which
          // is where a card is gripped and where the cut has two exposed
          // faces meeting.
          const u = rnd()
          const centre = u < 0.5
            ? Math.pow(u * 2, 1.8) * 0.5 * along
            : along - Math.pow((1 - u) * 2, 1.8) * 0.5 * along
          const len = along * (0.07 + rnd() * (0.14 + bw * 0.3))
          const a0 = Math.max(0, centre - len / 2)
          const a1 = Math.min(along, centre + len / 2)
          if (a1 - a0 < 4) continue

          const steps = Math.max(4, Math.round((a1 - a0) / 7))
          const peak = 0.9 + bw * 6.5
          const inner: [number, number][] = []
          for (let s = 0; s <= steps; s++) {
            const t = s / steps
            // Taper at both ends so a run fades into clean border instead of
            // stopping square, and drop out entirely now and then.
            const taper = Math.sin(Math.PI * t)
            const gap = rnd() < 0.18 ? 0.1 : 1
            inner.push([a0 + (a1 - a0) * t, peak * taper * gap * (0.35 + rnd() * 0.75)])
          }

          const pt = (p: number, d: number): string => {
            switch (side) {
              case 0:  return `${p.toFixed(1)} ${d.toFixed(1)}`
              case 1:  return `${p.toFixed(1)} ${(H - d).toFixed(1)}`
              case 2:  return `${d.toFixed(1)} ${p.toFixed(1)}`
              default: return `${(W - d).toFixed(1)} ${p.toFixed(1)}`
            }
          }
          const d =
            `M${pt(a0, 0)} L${pt(a1, 0)} ` +
            inner.slice().reverse().map(([p, dep]) => `L${pt(p, dep)}`).join(' ') +
            ' Z'
          whitening.push({ d, alpha: Math.min(0.95, 0.5 + bw * 0.6) })
        }
      }
    }

    // Everything below is drawn only on the enlarged view. At four columns
    // these are sub-pixel, and they are the expensive part of the card.
    const detailed = detail === 'full'

    // Scratches, as paths rather than rotated bars, so they can bow and vary
    // in length the way handling marks actually do. Four kinds mixed: fine
    // hairlines, short nicks, long curved scrapes, and dark gouges where the
    // surface has been taken off rather than just scuffed.
    const scratches: Scratch[] = []
    if (detailed) {
      const n = Math.round(sw * 15)
      let lx = rnd() * W, ly = rnd() * H
      for (let i = 0; i < n; i++) {
        const roll = rnd()
        const kind: Scratch['kind'] =
          roll < 0.3 ? 'nick' : roll < 0.52 ? 'scrape' : roll < 0.66 ? 'gouge' : 'hair'

        // Handling marks cluster - a card gets scuffed in the same places
        // repeatedly. Scattering every scratch independently looks sprayed on.
        if (rnd() < 0.45) {
          lx = Math.max(0, Math.min(W, lx + (rnd() - rnd()) * 34))
          ly = Math.max(0, Math.min(H, ly + (rnd() - rnd()) * 34))
        } else {
          lx = rnd() * W; ly = rnd() * H
        }

        let len: number, bow: number, width: number, alpha: number, dark = false
        if (kind === 'nick') {
          len = 3 + rnd() * 11; bow = 0
          width = 0.5 + rnd() * 0.5; alpha = 0.3 + sw * rnd() * 0.6
        } else if (kind === 'scrape') {
          len = 38 + rnd() * 105; bow = (rnd() - 0.5) * 20
          width = 0.4 + rnd() * 0.5; alpha = 0.16 + sw * rnd() * 0.44
        } else if (kind === 'gouge') {
          len = 8 + rnd() * 26; bow = (rnd() - 0.5) * 5
          width = 0.6 + rnd() * 0.7; alpha = 0.18 + sw * rnd() * 0.42; dark = true
        } else {
          len = 22 + rnd() * 85; bow = (rnd() - 0.5) * 7
          width = 0.3 + rnd() * 0.35; alpha = 0.2 + sw * rnd() * 0.55
        }

        const ang = (rnd() - 0.5) * Math.PI * 1.25
        const x2 = lx + Math.cos(ang) * len
        const y2 = ly + Math.sin(ang) * len
        const mx = (lx + x2) / 2 - Math.sin(ang) * bow
        const my = (ly + y2) / 2 + Math.cos(ang) * bow
        scratches.push({
          d: `M${lx.toFixed(1)} ${ly.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`,
          width, alpha: Math.min(0.9, alpha), dark, kind,
        })
      }
    }

    // Creases. A real crease is a ridge: it catches light along one side and
    // shadows along the other, which is why it is drawn as an offset pair
    // rather than a single line. Severe damage, so only beaten cards get one
    // - a clean card with a fold through it would make no sense.
    const creases: string[] = []
    if (detailed) {
      const chance = Math.max(0, Math.min(0.8, (68 - surface) / 60))
      if (rnd() < chance) {
        const make = () => {
          const a = Math.floor(rnd() * 4)
          let b = Math.floor(rnd() * 4)
          if (b === a) b = (b + 1 + Math.floor(rnd() * 3)) % 4
          const [x1, y1] = edgePoint(rnd, a)
          const [x2, y2] = edgePoint(rnd, b)
          // Two control points: a fold wanders rather than arcing cleanly.
          const c1x = x1 + (x2 - x1) * 0.33 + (rnd() - 0.5) * 34
          const c1y = y1 + (y2 - y1) * 0.33 + (rnd() - 0.5) * 34
          const c2x = x1 + (x2 - x1) * 0.66 + (rnd() - 0.5) * 34
          const c2y = y1 + (y2 - y1) * 0.66 + (rnd() - 0.5) * 34
          return `M${x1.toFixed(1)} ${y1.toFixed(1)} C${c1x.toFixed(1)} ${c1y.toFixed(1)} ` +
                 `${c2x.toFixed(1)} ${c2y.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`
        }
        creases.push(make())
        if (rnd() < 0.22) creases.push(make())
      }
    }

    // Dirt and finger grease: soft irregular darkening, no hard edge. Rotated
    // ellipses rather than circles, or they read as drop shadows.
    const smudges = detailed
      ? Array.from({ length: Math.round(sw * 5) }, () => {
          const w = 9 + rnd() * 26
          return {
            left: `${rnd() * 96 - 6}%`,
            top: `${rnd() * 96 - 6}%`,
            w: `${w}%`,
            h: `${w * (0.45 + rnd() * 0.75)}%`,
            angle: rnd() * 180,
            opacity: 0.06 + sw * rnd() * 0.26,
            warm: rnd() < 0.45,
          }
        })
      : []

    // Dents and print nicks: small soft dark spots.
    const dents = detailed
      ? Array.from({ length: Math.round(sw * 5) }, () => ({
          top: `${4 + rnd() * 90}%`,
          left: `${4 + rnd() * 90}%`,
          size: `${2 + rnd() * 5}%`,
          opacity: 0.12 + sw * rnd() * 0.4,
        }))
      : []

    return {
      background: [...corner, ...edge].join(', '),
      whitening,
      scratches,
      creases,
      smudges,
      dents,
      swirl: rnd() * 360,
    }
  }, [corners, edges, surface, border_wear, wear_seed, detail])

  const holo = detail === 'full' && (rarity === 'H' || rarity === 'S')

  const dx = (center_x / 100) * MARGIN
  const dy = (center_y / 100) * MARGIN

  return (
    <div
      className={`relative overflow-hidden isolate ${className}`}
      // The frame is the card's border. Painting it the card's own yellow is
      // what lets the margin and the border in the scan read as one edge.
      style={{ background: borderColor(src) }}
    >
      <div className={`absolute inset-0 ${frameClassName}`}>
        <div
          className="absolute overflow-hidden"
          style={{
            left: `${(MARGIN + dx).toFixed(3)}%`,
            right: `${(MARGIN - dx).toFixed(3)}%`,
            top: `${((MARGIN + dy) * VK).toFixed(3)}%`,
            bottom: `${((MARGIN - dy) * VK).toFixed(3)}%`,
          }}
        >
          <img
            src={src}
            alt={alt}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-fill"
          />

          {/* Holo swirl, under the wear so scratches read as being on top of
              the foil rather than beneath it. Confined to the art window:
              these sets foil the picture only, so running it full-bleed tints
              the text box too and reads as a filter over the card rather than
              foil in it. Inset matches the Base-era layout every set here
              uses, and it lives inside the art so it travels with a bad cut. */}
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
        </div>

        {/* Corner and edge wear. */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: layers.background }}
        />

        {/* Grime, under the scratches: dirt settles into the surface, the
            marks that cut through it sit on top. */}
        {layers.smudges.map((s, i) => (
          <span
            key={`m${i}`}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: s.left, top: s.top, width: s.w, height: s.h,
              opacity: s.opacity,
              transform: `rotate(${s.angle.toFixed(1)}deg)`,
              background: s.warm
                ? 'radial-gradient(ellipse, rgba(92,74,48,0.85) 0%, rgba(92,74,48,0.4) 45%, rgba(92,74,48,0) 76%)'
                : 'radial-gradient(ellipse, rgba(64,66,72,0.8) 0%, rgba(64,66,72,0.36) 45%, rgba(64,66,72,0) 76%)',
            }}
          />
        ))}

        {(layers.scratches.length > 0 || layers.creases.length > 0 ||
          layers.whitening.length > 0) && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {/* The exposed core along the cut. Drawn first so scratches and
                folds pass over it. */}
            {layers.whitening.map((b, i) => (
              <path key={`w${i}`} d={b.d} fill="#fdfcf7" opacity={b.alpha} />
            ))}

            {/* Creases: a scratch can lie across a fold, not under it. */}
            {layers.creases.map((d, i) => (
              <g key={`c${i}`} fill="none" strokeLinecap="round">
                {/* The lit side of the ridge and its shadow, offset apart. */}
                <path d={d} stroke="rgba(255,255,255,0.5)" strokeWidth={1.3}
                      transform="translate(-0.8,-0.8)" />
                <path d={d} stroke="rgba(48,38,26,0.38)" strokeWidth={1.3}
                      transform="translate(0.8,0.8)" />
                <path d={d} stroke="rgba(255,255,255,0.22)" strokeWidth={2.6} />
              </g>
            ))}

            {layers.scratches.map((s, i) => (
              <path
                key={`s${i}`}
                d={s.d}
                fill="none"
                strokeLinecap="round"
                strokeWidth={s.width}
                stroke={s.dark ? 'rgba(46,36,24,0.95)' : 'rgba(255,255,255,0.95)'}
                opacity={s.alpha}
              />
            ))}
          </svg>
        )}

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
