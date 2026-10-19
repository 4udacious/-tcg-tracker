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
  /**
   * Damage that stays put (v50). Optional so a caller that predates it
   * still draws: missing is undamaged.
   *
   * crease: 0 none, 1 light (a corner bend or a short ding), 2 a crease
   * across the card, 3 heavy (a fold, or several). holes: punctures, 0-3.
   * rips: corners torn off, a bitmask clockwise from the top left
   * (1 TL, 2 TR, 4 BR, 8 BL).
   */
  crease?: number
  holes?: number
  rips?: number
}

/** Corners in rip-bit order, clockwise from the top left. */
export const RIP_CORNERS = ['top left', 'top right', 'bottom right', 'bottom left'] as const

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
 * A stream of its own for one kind of mark. The original stream is shared by
 * every wear mark in order, so anything drawn from it moves when the marks
 * before it change. Structural damage must not: a hole stays where it is when
 * the card is cleaned, and a second hole does not move the first.
 */
function stream(seed: number, salt: number): () => number {
  return mulberry32((((seed || 1) ^ salt) >>> 0) || salt)
}

const f1 = (n: number) => n.toFixed(1)
type Pt = [number, number]

/** n+1 points along a cubic Bézier. */
function cubic([p0, p1, p2, p3]: Pt[], n: number): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ])
  }
  return out
}

/** Short broken white marks along a fold, where the ink has cracked open. */
function inkCracks(pts: Pt[], rnd: () => number, density: number): string[] {
  const out: string[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    if (rnd() > density) continue
    const j = (rnd() - 0.5) * 1.2
    out.push(`M${f1(pts[i][0] + j)} ${f1(pts[i][1] - j)} L${f1(pts[i + 1][0])} ${f1(pts[i + 1][1])}`)
  }
  return out
}

type Crease = {
  d: string
  /** Ridge thickness: a corner bend is slight, a fold is heavy. */
  weight: number
  cracks: string[]
  /** A bent-over corner, shaded as its own facet. */
  flap?: string
  /** Where a fold runs off the card and the edge has split white. */
  ends?: Pt[]
}

/** The creases a copy's level calls for, each kind drawn its own way. */
function creaseMarks(level: number, seed: number): Crease[] {
  if (!level) return []
  const rnd = stream(seed, 0x2c1b3c6d)

  // A crease that wanders right across the card, edge to edge.
  const across = (): Crease => {
    const a = Math.floor(rnd() * 4)
    let b = Math.floor(rnd() * 4)
    if (b === a) b = (a + 2) % 4
    const p0 = edgePoint(rnd, a)
    const p3 = edgePoint(rnd, b)
    const p1: Pt = [p0[0] + (p3[0] - p0[0]) * 0.33 + (rnd() - 0.5) * 34,
                    p0[1] + (p3[1] - p0[1]) * 0.33 + (rnd() - 0.5) * 34]
    const p2: Pt = [p0[0] + (p3[0] - p0[0]) * 0.66 + (rnd() - 0.5) * 34,
                    p0[1] + (p3[1] - p0[1]) * 0.66 + (rnd() - 0.5) * 34]
    return {
      d: `M${f1(p0[0])} ${f1(p0[1])} C${f1(p1[0])} ${f1(p1[1])} ${f1(p2[0])} ${f1(p2[1])} ${f1(p3[0])} ${f1(p3[1])}`,
      weight: 1,
      cracks: inkCracks(cubic([p0, p1, p2, p3], 24), rnd, 0.35),
    }
  }

  if (level === 1) {
    if (rnd() < 0.55) {
      // A corner bent over and back: a short line cutting the corner off,
      // and the little triangle beyond it catching the light differently.
      const c = Math.floor(rnd() * 4)
      const cx = c === 1 || c === 2 ? W : 0
      const cy = c >= 2 ? H : 0
      const sx = cx === 0 ? 1 : -1
      const sy = cy === 0 ? 1 : -1
      const p1: Pt = [cx + sx * (12 + rnd() * 22), cy]
      const p2: Pt = [cx, cy + sy * (14 + rnd() * 26)]
      const mx = (p1[0] + p2[0]) / 2 - sx * (1 + rnd() * 3)
      const my = (p1[1] + p2[1]) / 2 - sy * (1 + rnd() * 3)
      const curve = `Q${f1(mx)} ${f1(my)} ${f1(p2[0])} ${f1(p2[1])}`
      return [{
        d: `M${f1(p1[0])} ${f1(p1[1])} ${curve}`,
        weight: 1,
        cracks: [],
        flap: `M${cx} ${cy} L${f1(p1[0])} ${f1(p1[1])} ${curve} Z`,
      }]
    }
    // A short ding: in from an edge and gone again.
    const side = Math.floor(rnd() * 4)
    const [x0, y0] = edgePoint(rnd, side)
    const inward = side === 0 ? Math.PI / 2 : side === 1 ? Math.PI : side === 2 ? -Math.PI / 2 : 0
    const ang = inward + (rnd() - 0.5) * 1.2
    const len = 14 + rnd() * 22
    const x1 = x0 + Math.cos(ang) * len
    const y1 = y0 + Math.sin(ang) * len
    const bow = (rnd() - 0.5) * 6
    const mx = (x0 + x1) / 2 - Math.sin(ang) * bow
    const my = (y0 + y1) / 2 + Math.cos(ang) * bow
    return [{ d: `M${f1(x0)} ${f1(y0)} Q${f1(mx)} ${f1(my)} ${f1(x1)} ${f1(y1)}`, weight: 0.8, cracks: [] }]
  }

  if (level === 2) return [across()]

  // Heavy: either one hard fold straight through, or several creases.
  if (rnd() < 0.5) {
    const horizontal = rnd() < 0.55
    let p0: Pt, p3: Pt
    if (horizontal) {
      const y0 = H * (0.35 + rnd() * 0.3)
      p0 = [0, y0]; p3 = [W, y0 + (rnd() - 0.5) * 30]
    } else {
      const x0 = W * (0.35 + rnd() * 0.3)
      p0 = [x0, 0]; p3 = [x0 + (rnd() - 0.5) * 24, H]
    }
    const p1: Pt = [p0[0] + (p3[0] - p0[0]) * 0.33 + (rnd() - 0.5) * 8, p0[1] + (p3[1] - p0[1]) * 0.33 + (rnd() - 0.5) * 8]
    const p2: Pt = [p0[0] + (p3[0] - p0[0]) * 0.66 + (rnd() - 0.5) * 8, p0[1] + (p3[1] - p0[1]) * 0.66 + (rnd() - 0.5) * 8]
    return [{
      d: `M${f1(p0[0])} ${f1(p0[1])} C${f1(p1[0])} ${f1(p1[1])} ${f1(p2[0])} ${f1(p2[1])} ${f1(p3[0])} ${f1(p3[1])}`,
      weight: 1.6,
      cracks: inkCracks(cubic([p0, p1, p2, p3], 30), rnd, 0.7),
      ends: [p0, p3],
    }]
  }
  const out = [across(), across()]
  if (rnd() < 0.4) out.push(across())
  return out
}

type Hole = { x: number; y: number; r: number }

/** Punctures: pinholes or bigger punched-through holes, kept off the edges. */
function holeMarks(count: number, seed: number): Hole[] {
  const out: Hole[] = []
  for (let i = 0; i < Math.min(3, count); i++) {
    // One stream per hole, so a second hole leaves the first where it was.
    const rnd = stream(seed, 0x51ed270b + i * 0x9e37)
    const pin = rnd() < 0.5
    out.push({
      x: 24 + rnd() * (W - 48),
      y: 30 + rnd() * (H - 60),
      r: pin ? 1.6 + rnd() * 1.4 : 3.8 + rnd() * 3.2,
    })
  }
  return out
}

type Rip = {
  /** The missing piece, run slightly past the card so the mask leaves no sliver. */
  poly: string
  /** The torn edge itself, where the white core shows. */
  tear: string
}

/** Corners torn away along a ragged line, one stream per corner. */
function ripMarks(bits: number, seed: number): Rip[] {
  const out: Rip[] = []
  for (let c = 0; c < 4; c++) {
    if (!(bits & (1 << c))) continue
    const rnd = stream(seed, 0x7f4a7c15 + c * 0x3c6e)
    const cx = c === 1 || c === 2 ? W : 0
    const cy = c >= 2 ? H : 0
    const sx = cx === 0 ? 1 : -1
    const sy = cy === 0 ? 1 : -1
    const start: Pt = [cx + sx * (16 + rnd() * 24), cy]
    const end: Pt = [cx, cy + sy * (18 + rnd() * 28)]
    const pts: Pt[] = [start]
    const steps = 7 + Math.floor(rnd() * 4)
    for (let i = 1; i < steps; i++) {
      const t = i / steps
      // Bellied in toward the card, and ragged all along.
      const bow = Math.sin(Math.PI * t) * (3 + rnd() * 5)
      pts.push([
        start[0] + (end[0] - start[0]) * t + sx * bow + (rnd() - 0.5) * 4.5,
        start[1] + (end[1] - start[1]) * t + sy * bow + (rnd() - 0.5) * 4.5,
      ])
    }
    pts.push(end)
    const line = pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join(' L')
    const o = 4
    out.push({
      poly: `M${cx - sx * o} ${cy - sy * o} L${f1(start[0])} ${cy - sy * o} L${line} L${cx - sx * o} ${f1(end[1])} Z`,
      tear: `M${line}`,
    })
  }
  return out
}

type Pattern = { d: string; width: number; alpha: number }

/**
 * Handling marks that come in patterns rather than one at a time: runs of
 * parallel sleeve scuffs, swirls from being rubbed on something, and long
 * drags just inside a border. Scaled by surface wear like the rest.
 */
function scratchPatterns(sw: number, seed: number): Pattern[] {
  if (sw < 0.1) return []
  const rnd = stream(seed, 0x632be5ab)
  const out: Pattern[] = []

  // Sleeve scuffs: a card slid in and out of a sleeve picks up a run of
  // fine lines all at one angle.
  const sleeves = sw > 0.12 ? 1 + (sw > 0.3 ? 1 : 0) + (sw > 0.5 ? 1 : 0) : 0
  for (let s = 0; s < sleeves; s++) {
    const x = 20 + rnd() * (W - 40)
    const y = 20 + rnd() * (H - 40)
    const ang = (rnd() - 0.5) * Math.PI
    const n = 4 + Math.floor(rnd() * 6)
    const gap = 1.2 + rnd() * 1.4
    const len = 26 + rnd() * 54
    const dx = Math.cos(ang), dy = Math.sin(ang)
    for (let i = 0; i < n; i++) {
      const off = (i - n / 2) * gap
      const l = len * (0.7 + rnd() * 0.5)
      const slide = (rnd() - 0.5) * 8
      const ox = x - dy * off + dx * slide
      const oy = y + dx * off + dy * slide
      out.push({
        d: `M${f1(ox - dx * l / 2)} ${f1(oy - dy * l / 2)} L${f1(ox + dx * l / 2)} ${f1(oy + dy * l / 2)}`,
        width: 0.3 + rnd() * 0.25,
        alpha: 0.1 + sw * (0.2 + rnd() * 0.3),
      })
    }
  }

  // Rub swirls: nested partial arcs around one spot.
  const swirls = sw > 0.25 ? 1 + (sw > 0.45 ? 1 : 0) : 0
  for (let s = 0; s < swirls; s++) {
    const cx = 30 + rnd() * (W - 60)
    const cy = 40 + rnd() * (H - 80)
    const n = 3 + Math.floor(rnd() * 4)
    const r0 = 6 + rnd() * 12
    for (let i = 0; i < n; i++) {
      const r = r0 + i * (2.4 + rnd() * 2.2)
      const a0 = rnd() * Math.PI * 2
      // Short arcs, faint: a swirl is a sheen of rub marks, not drawn rings.
      const span = 0.5 + rnd() * 1.1
      const a1 = a0 + span
      out.push({
        d: `M${f1(cx + Math.cos(a0) * r)} ${f1(cy + Math.sin(a0) * r)} ` +
           `A${f1(r)} ${f1(r)} 0 0 1 ${f1(cx + Math.cos(a1) * r)} ${f1(cy + Math.sin(a1) * r)}`,
        width: 0.3 + rnd() * 0.25,
        alpha: 0.07 + sw * (0.1 + rnd() * 0.18),
      })
    }
  }

  // Edge drags: long, nearly straight, just inside one border.
  const drags = sw > 0.18 ? 1 + (rnd() < sw ? 1 : 0) : 0
  for (let s = 0; s < drags; s++) {
    const side = Math.floor(rnd() * 4)
    const inset = 5 + rnd() * 10
    const along = side % 2 === 0 ? W : H
    const len = along * (0.35 + rnd() * 0.4)
    const a = rnd() * (along - len)
    const wob = (rnd() - 0.5) * 3
    const at = (p: number, d: number): string =>
      side === 0 ? `${f1(p)} ${f1(d)}`
      : side === 1 ? `${f1(W - d)} ${f1(p)}`
      : side === 2 ? `${f1(p)} ${f1(H - d)}`
      : `${f1(d)} ${f1(p)}`
    out.push({
      d: `M${at(a, inset)} Q${at(a + len / 2, inset + wob)} ${at(a + len, inset + wob * 0.5)}`,
      width: 0.35 + rnd() * 0.3,
      alpha: 0.15 + sw * (0.2 + rnd() * 0.25),
    })
  }
  return out
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
    // Calibrated against a photo of heavy whitening: even at its worst it is
    // a scatter of small nicks and short frays hugging the cut, not long
    // bands. Heavier wear means MORE marks, not bigger ones - scaling the
    // size instead is what made the first attempt look like damage.
    //
    // Enlarged only. At true scale these are under a pixel deep on an 84px
    // thumbnail, so the grid showed nothing; drawing them big enough to see
    // there would mean a card looking more worn in the binder than in hand.
    // Corner and edge wear carry the grid instead - they scale with the card.
    const bw = detail === 'full' ? Math.max(0, (100 - border_wear) / 100) : 0
    const whitening: WhiteBand[] = []
    if (bw > 0.02) {
      const runsPerEdge = Math.max(1, Math.round(1 + bw * 6))
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
          const len = along * (0.015 + rnd() * (0.025 + bw * 0.07))
          const a0 = Math.max(0, centre - len / 2)
          const a1 = Math.min(along, centre + len / 2)
          if (a1 - a0 < 2) continue

          // Short runs still need a few points, or the wobble flattens into
          // a plain rectangle.
          const steps = Math.max(3, Math.round((a1 - a0) / 3.5))
          const peak = 0.5 + bw * 2.0
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
          // Opaque where it exists - exposed core is white card stock, not a
          // wash. The marks stay subtle by being small, not by being faint.
          whitening.push({ d, alpha: Math.min(0.9, 0.55 + bw * 0.35) })
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

    // Creases used to be decided here, from this stream. They are stored per
    // copy now (v50, which recorded every crease this drew) and drawn from a
    // stream of their own below. These draws still happen, unused, so the
    // grime and dents after them land exactly where they always have.
    if (detailed) {
      const chance = Math.max(0, Math.min(0.8, (68 - surface) / 60))
      if (rnd() < chance) {
        const burn = () => {
          const a = Math.floor(rnd() * 4)
          const b = Math.floor(rnd() * 4)
          if (b === a) rnd()
          for (let i = 0; i < 6; i++) rnd() // two edge points, two control points
        }
        burn()
        if (rnd() < 0.22) burn()
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
      smudges,
      dents,
      swirl: rnd() * 360,
    }
  }, [corners, edges, surface, border_wear, wear_seed, detail])

  // Structural damage, each kind from its own stream so none of it moves
  // when the wear above changes. Holes and tears show at every size - they
  // are what a card is at a glance - while creases and scratch patterns are
  // hairlines and wait for the enlarged view like the rest.
  const crease = condition.crease ?? 0
  const holes = condition.holes ?? 0
  const rips = condition.rips ?? 0
  const damage = useMemo(() => {
    const full = detail === 'full'
    return {
      creases: full ? creaseMarks(crease, wear_seed) : [],
      patterns: full ? scratchPatterns(Math.max(0, (100 - surface) / 100), wear_seed) : [],
      holes: holeMarks(holes, wear_seed),
      rips: ripMarks(rips, wear_seed),
    }
  }, [crease, holes, rips, surface, wear_seed, detail])

  // Holes and torn corners are cut out of the card, so whatever is behind it
  // - a binder page, the slab, the dark of a reveal - shows through. An alpha
  // mask with the damage as even-odd holes in a full-card rectangle.
  const mask = useMemo(() => {
    if (damage.holes.length === 0 && damage.rips.length === 0) return undefined
    let d = `M0 0H${W}V${H}H0Z`
    for (const h of damage.holes) {
      d += ` M${f1(h.x - h.r)} ${f1(h.y)}a${f1(h.r)} ${f1(h.r)} 0 1 0 ${f1(2 * h.r)} 0` +
           `a${f1(h.r)} ${f1(h.r)} 0 1 0 ${f1(-2 * h.r)} 0Z`
    }
    for (const r of damage.rips) d += ` ${r.poly}`
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${W} ${H}' preserveAspectRatio='none'>` +
                `<path fill-rule='evenodd' d='${d}'/></svg>`
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`
  }, [damage])

  const holo = detail === 'full' && (rarity === 'H' || rarity === 'S')

  const dx = (center_x / 100) * MARGIN
  const dy = (center_y / 100) * MARGIN

  return (
    <div className={`relative overflow-hidden isolate ${className}`}>
      {/* The frame is the card's border. Painting it the card's own yellow is
          what lets the margin and the border in the scan read as one edge.
          It, and the mask that cuts holes and tears out of the card, sit on
          this inner layer rather than the outer one: a mask there would
          also cut away a rarity ring or glow drawn around the card. */}
      <div
        className={`absolute inset-0 ${frameClassName}`}
        style={{
          background: borderColor(src),
          ...(mask && {
            maskImage: mask, WebkitMaskImage: mask,
            maskSize: '100% 100%', WebkitMaskSize: '100% 100%',
            maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat',
          }),
        }}
      >
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

        {(layers.scratches.length > 0 || layers.whitening.length > 0 ||
          damage.creases.length > 0 || damage.patterns.length > 0 ||
          damage.holes.length > 0 || damage.rips.length > 0) && (
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

            {/* Patterned handling marks: under the creases, since a fold can
                cut through a scuffed patch but not the other way round. */}
            {damage.patterns.map((p, i) => (
              <path key={`p${i}`} d={p.d} fill="none" strokeLinecap="round"
                    stroke="rgba(255,255,255,0.95)" strokeWidth={p.width} opacity={p.alpha} />
            ))}

            {/* Creases. A real crease is a ridge: it catches light along one
                side and shadows along the other, so it is an offset pair
                rather than a single line. Heavier ones crack the ink open
                along their length and split the edge where they run off. */}
            {damage.creases.map((c, i) => (
              <g key={`c${i}`} fill="none" strokeLinecap="round">
                {c.flap && <path d={c.flap} fill="rgba(255,255,255,0.24)" stroke="none" />}
                <path d={c.d} stroke="rgba(255,255,255,0.5)" strokeWidth={1.3 * c.weight}
                      transform={`translate(${-0.8 * c.weight},${-0.8 * c.weight})`} />
                <path d={c.d} stroke={`rgba(48,38,26,${Math.min(0.6, 0.38 * c.weight).toFixed(2)})`}
                      strokeWidth={1.3 * c.weight}
                      transform={`translate(${0.8 * c.weight},${0.8 * c.weight})`} />
                <path d={c.d} stroke="rgba(255,255,255,0.22)" strokeWidth={2.6 * c.weight} />
                {c.cracks.map((d, j) => (
                  <path key={j} d={d} stroke="#fdfcf7" strokeWidth={0.7} opacity={0.75} />
                ))}
                {c.ends?.map(([x, y], j) => (
                  <circle key={`e${j}`} cx={x} cy={y} r={2.6} fill="#fdfcf7" opacity={0.85} />
                ))}
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

            {/* The hole itself is cut out by the mask; this is its rim -
                fibres of white card stock round the edge, and the stock
                pressed down around it where it was pushed through. */}
            {damage.holes.map((h, i) => (
              <g key={`h${i}`} fill="none">
                <circle cx={h.x} cy={h.y} r={h.r + 1.7} stroke="rgba(60,45,30,0.28)" strokeWidth={1.6} />
                <circle cx={h.x} cy={h.y} r={h.r + 0.5} stroke="#efe8d8" strokeWidth={1.1} opacity={0.92} />
              </g>
            ))}

            {/* Torn corners: the ragged edge shows the white core of the
                card, with a little shadow just inside where it lifted. */}
            {damage.rips.map((r, i) => (
              <g key={`r${i}`} fill="none" strokeLinejoin="round" strokeLinecap="round">
                <path d={r.tear} stroke="rgba(60,45,30,0.3)" strokeWidth={2.2} />
                <path d={r.tear} stroke="#f7f2e6" strokeWidth={1.4} />
              </g>
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
