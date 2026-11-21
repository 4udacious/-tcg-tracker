'use client'

/*
 * What the Game Corner's games share for looks: the keyframes (CORNER_CSS, put on the page once), textures drawn
 * as SVG (grain, wood, velvet, scratches), casino chips, and the celebrations: coins spraying out and a banner.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

const svg = (body: string, w = 200, h = 200) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>${body}</svg>`)}")`

/** Fine grain, dark specks on clear: velvet, paint, grime. */
export const NOISE = svg(
  `<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/>` +
  `<feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .55 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/>`)

/** A much finer, fainter grain: plush, cared-for velvet. */
export const NOISE_FINE = svg(
  `<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='1.4' numOctaves='1' stitchTiles='stitch'/>` +
  `<feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .22 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/>`)

/** Wood grain, running along: warm browns. */
export const WOOD = svg(
  `<filter id='w'><feTurbulence type='fractalNoise' baseFrequency='.005 .16' numOctaves='3' seed='4' stitchTiles='stitch'/>` +
  `<feColorMatrix values='0 0 0 .42 .2  0 0 0 .24 .08  0 0 0 .12 .03  0 0 0 0 1'/></filter><rect width='100%' height='100%' filter='url(#w)'/>`, 420, 160)

/** A seeded run of numbers, so the wear is the same on every visit. */
function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

/** Light scratches, mostly along, as on old paint or plastic. */
function scratches(seed: number, n: number, color: string, w = 260, h = 260) {
  const r = rng(seed)
  let body = ''
  for (let i = 0; i < n; i++) {
    const x = r() * w, y = r() * h, len = 4 + r() * 36, a = (r() - 0.5) * (r() < 0.8 ? 0.7 : 3)
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len
    body += `<path d='M${x.toFixed(1)} ${y.toFixed(1)} Q${((x + x2) / 2 + (r() - 0.5) * 4).toFixed(1)} ${((y + y2) / 2 + (r() - 0.5) * 4).toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}' stroke='${color}' stroke-opacity='${(0.12 + r() * 0.3).toFixed(2)}' stroke-width='${(0.4 + r() * 0.7).toFixed(2)}' fill='none' stroke-linecap='round'/>`
  }
  return svg(body, w, h)
}
export const SCRATCHES = scratches(7, 70, '#fff')
export const SCUFFS = scratches(21, 40, '#000')

/** Green velvet: deep, with a sheen where the light catches it. */
export const VELVET: CSSProperties = {
  backgroundColor: '#0f3d24',
  backgroundImage: `${NOISE}, radial-gradient(ellipse at 50% 0%, rgba(255,255,255,.13), transparent 55%), radial-gradient(ellipse at 50% 40%, #17663a 0%, #0f4a2a 50%, #072a17 100%)`,
  backgroundBlendMode: 'multiply, screen, normal',
}

/** A wooden rail: polished, the grain showing, darker at the edges. */
export const RAIL: CSSProperties = {
  backgroundColor: '#5a2d0c',
  backgroundImage: `linear-gradient(180deg, rgba(255,220,170,.22), transparent 18%, transparent 75%, rgba(0,0,0,.4)), ${WOOD}`,
  backgroundSize: 'auto, 420px 160px',
  boxShadow: 'inset 0 1px 0 rgba(255,235,200,.35), inset 0 -2px 4px rgba(0,0,0,.5), 0 10px 24px rgba(0,0,0,.45)',
}

/** The main floor's rail, its varnish scuffed by years of elbows. */
export const RAIL_WORN: CSSProperties = {
  ...RAIL,
  backgroundImage: `${SCUFFS}, ${RAIL.backgroundImage}`,
  backgroundSize: '260px 260px, auto, 420px 160px',
}

/** The high-limit room's velvet: burgundy, plush and spotless. */
export const VELVET_RED: CSSProperties = {
  backgroundColor: '#4a0d1c',
  backgroundImage: `${NOISE_FINE}, radial-gradient(ellipse at 50% 0%, rgba(255,240,220,.16), transparent 55%), radial-gradient(ellipse at 50% 40%, #8a1c40 0%, #5e1029 52%, #2a0612 100%)`,
  backgroundBlendMode: 'multiply, screen, normal',
}

/** The high-limit room's rail: piano-black lacquer, a gold inlay line, a deep gloss. */
export const RAIL_LUXE: CSSProperties = {
  backgroundColor: '#0c0a09',
  backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,.24), rgba(255,255,255,.05) 20%, transparent 38%, transparent 72%, rgba(255,255,255,.07) 90%, rgba(0,0,0,.4)), linear-gradient(135deg, #2a2522, #0c0a09 55%, #1c1917)',
  boxShadow: 'inset 0 0 0 1px rgba(243,210,122,.95), inset 0 0 0 3px #0c0a09, inset 0 0 0 4px rgba(243,210,122,.45), 0 12px 28px rgba(0,0,0,.55)',
}

/** Gold lettering. */
export const GOLD_TEXT: CSSProperties = {
  backgroundImage: 'linear-gradient(90deg,#fde68a,#f59e0b 25%,#fff7ed 50%,#f59e0b 75%,#fde68a)',
  backgroundSize: '200% 100%',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
}

export const CORNER_CSS = `
@keyframes gc-fx{from{transform:translateX(0)}to{transform:translateX(var(--dx))}}
@keyframes gc-fy{0%{transform:translateY(0);animation-timing-function:cubic-bezier(.2,.7,.4,1)}38%{transform:translateY(var(--up));animation-timing-function:cubic-bezier(.55,0,.9,.6)}92%{opacity:1}100%{transform:translateY(75vh);opacity:0}}
@keyframes gc-rain{from{transform:translateY(-40px)}to{transform:translateY(110vh)}}
@keyframes gc-flip{0%,100%{transform:scaleX(1)}50%{transform:scaleX(.12)}}
@keyframes gc-banner{0%{transform:scale(.3) rotate(-8deg);opacity:0}14%{transform:scale(1.14) rotate(2deg);opacity:1}24%{transform:scale(1) rotate(0)}86%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.04) translateY(-14px)}}
@keyframes gc-shine{from{background-position:200% 0}to{background-position:-200% 0}}
@keyframes gc-rays{to{transform:rotate(360deg)}}
@keyframes gc-bulb{0%,100%{opacity:1}50%{opacity:.25}}
@keyframes gc-flash{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes gc-glow{0%,100%{box-shadow:0 0 0 0 rgba(250,204,21,0)}50%{box-shadow:0 0 0 3px rgba(250,204,21,.95),0 0 14px rgba(250,204,21,.8)}}
@keyframes gc-shake{0%,100%{transform:none}15%{transform:translate(-4px,2px) rotate(-.6deg)}30%{transform:translate(4px,-2px) rotate(.6deg)}45%{transform:translate(-3px,-1px)}60%{transform:translate(3px,2px)}75%{transform:translate(-2px,1px)}}
@keyframes gc-reel{from{transform:translateY(var(--h))}to{transform:translateY(0)}}
@keyframes gc-stop{0%{transform:translateY(-22%)}65%{transform:translateY(6%)}100%{transform:translateY(0)}}
@keyframes gc-deal{from{transform:translate(var(--fx,80px),var(--fy,-120px)) rotate(-25deg) scale(.7);opacity:0}to{transform:none;opacity:1}}
@keyframes gc-turn{0%{transform:rotateY(90deg)}100%{transform:rotateY(0)}}
@keyframes gc-drop{from{transform:translateY(-16px) scale(1.25);opacity:0}to{transform:none;opacity:1}}
@keyframes gc-bounce{0%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}
@keyframes gc-glint{0%,72%{transform:translateX(-140%) skewX(-18deg)}100%{transform:translateX(420%) skewX(-18deg)}}
@keyframes gc-pop{0%{transform:scale(.6);opacity:0}60%{transform:scale(1.15);opacity:1}100%{transform:scale(1)}}
@media (prefers-reduced-motion: reduce){.gc-motion{animation:none!important;transition:none!important}}
`

// ─────────────────────────────────────────────── chips
/** A casino chip's colours by value: face, edge stripes, lettering. */
export function chipColors(v: number): { face: string; stripe: string; ink: string } {
  if (v >= 50) return { face: '#ca8a04', stripe: '#1c1917', ink: '#1c1917' }
  if (v >= 25) return { face: '#be185d', stripe: '#fdf2f8', ink: '#fff' }
  if (v >= 10) return { face: '#ea580c', stripe: '#fff7ed', ink: '#fff' }
  if (v >= 5) return { face: '#6d28d9', stripe: '#fde68a', ink: '#fff' }
  if (v >= 2) return { face: '#18181b', stripe: '#f4f4f5', ink: '#fde68a' }
  if (v >= 1) return { face: '#15803d', stripe: '#f4f4f5', ink: '#fff' }
  if (v >= 0.5) return { face: '#1d4ed8', stripe: '#f4f4f5', ink: '#fff' }
  if (v >= 0.25) return { face: '#dc2626', stripe: '#f4f4f5', ink: '#fff' }
  return { face: '#f4f4f5', stripe: '#2563eb', ink: '#1e3a8a' }
}

/** One casino chip, seen from above: striped edge, dashed inlay, the value. */
export function Chip({ value, label, size = 40, style }: { value: number; label?: string; size?: number; style?: CSSProperties }) {
  const c = chipColors(value)
  return (
    <span className="relative inline-grid place-items-center rounded-full shrink-0" aria-hidden
      style={{
        width: size, height: size,
        background: `repeating-conic-gradient(${c.face} 0deg 24deg, ${c.stripe} 24deg 36deg)`,
        boxShadow: `0 ${Math.max(1, size * 0.06)}px 0 rgba(0,0,0,.45), 0 ${size * 0.1}px ${size * 0.16}px rgba(0,0,0,.3), inset 0 0 0 ${Math.max(1, size * 0.03)}px rgba(0,0,0,.25)`,
        ...style,
      }}>
      <span className="absolute grid place-items-center rounded-full font-mono font-extrabold leading-none"
        style={{
          inset: size * 0.16, color: c.ink, fontSize: Math.max(7, size * (label && label.length > 3 ? 0.22 : 0.27)),
          background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,.35), transparent 60%), ${c.face}`,
          border: `${Math.max(1, size * 0.035)}px dashed ${c.stripe}`,
        }}>
        {label}
      </span>
    </span>
  )
}

const DENOMS = [50, 25, 10, 5, 2, 1, 0.5, 0.25, 0.1]
/** The chips a table offers, between its smallest bet and its limit. */
export const chipsFor = (min: number, max: number) => [...DENOMS].reverse().filter((c) => c >= min && c <= max)
/** A stack of chips making up an amount (up to five shown), the amount on the top one. */
export function ChipStack({ amount, size = 26, label }: { amount: number; size?: number; label?: string }) {
  const chips: number[] = []
  let left = Math.round(amount * 100)
  for (const d of DENOMS) { const c = Math.round(d * 100); while (left >= c && chips.length < 5) { chips.push(d); left -= c } }
  if (!chips.length) chips.push(0.1)
  const lift = size * 0.14
  return (
    <span className="relative inline-block" style={{ width: size, height: size + lift * (chips.length - 1) }}>
      {chips.map((v, i) => (
        <Chip key={i} value={v} size={size} label={i === chips.length - 1 ? label : undefined}
          style={{ position: 'absolute', left: 0, bottom: i * lift }} />
      ))}
    </span>
  )
}

// ─────────────────────────────────────────────── coins and banners
export function Coin({ size = 18 }: { size?: number }) {
  return (
    <span className="block rounded-full" style={{
      width: size, height: size,
      background: 'radial-gradient(circle at 35% 30%, #fffbeb 0 10%, #fcd34d 30%, #d97706 72%, #92400e 100%)',
      boxShadow: 'inset 0 0 0 2px rgba(255,255,255,.35), inset 0 -2px 2px rgba(120,53,15,.6), 0 1px 2px rgba(0,0,0,.4)',
      border: '1px solid #78350f',
    }} />
  )
}

export type Tier = 'back' | 'small' | 'big' | 'jackpot' | 'blackjack'
type Party = { id: number; tier: Tier; title?: string; amount?: string; from?: { x: number; y: number } }

const COUNT: Record<Tier, number> = { back: 5, small: 14, big: 34, jackpot: 56, blackjack: 30 }

function PartyLayer({ p }: { p: Party }) {
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const many = p.tier === 'big' || p.tier === 'jackpot' || p.tier === 'blackjack'
  const coins = useMemo(() => {
    const r = Math.random
    return {
      spray: Array.from({ length: reduced ? 0 : COUNT[p.tier] }, () => ({
        dx: (r() - 0.5) * (many ? 360 : 220), up: -(110 + r() * (many ? 260 : 140)), delay: r() * (many ? 0.9 : 0.35),
        dur: 1.1 + r() * 0.8, size: 12 + r() * 10, spin: 0.25 + r() * 0.4,
      })),
      rain: Array.from({ length: reduced || !many ? 0 : COUNT[p.tier] }, () => ({ left: r() * 100, delay: r() * 1.6, dur: 1.4 + r() * 1.2, size: 12 + r() * 12, spin: 0.3 + r() * 0.4 })),
    }
  }, [p.tier, many, reduced])
  const at = p.from ?? (typeof window !== 'undefined' ? { x: window.innerWidth / 2, y: window.innerHeight * 0.6 } : { x: 0, y: 0 })
  const long = p.tier === 'jackpot' ? 4 : 2.6
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      {coins.rain.map((c, i) => (
        <span key={`r${i}`} className="absolute top-0 gc-motion" style={{ left: `${c.left}%`, animation: `gc-rain ${c.dur}s linear ${c.delay}s both` }}>
          <span className="block gc-motion" style={{ animation: `gc-flip ${c.spin}s linear infinite` }}><Coin size={c.size} /></span>
        </span>
      ))}
      {coins.spray.map((c, i) => (
        <span key={`s${i}`} className="absolute gc-motion" style={{ left: at.x, top: at.y, ['--dx' as string]: `${c.dx}px`, animation: `gc-fx ${c.dur}s linear ${c.delay}s both` }}>
          <span className="block gc-motion" style={{ ['--up' as string]: `${c.up}px`, animation: `gc-fy ${c.dur}s ${c.delay}s both` }}>
            <span className="block gc-motion" style={{ animation: `gc-flip ${c.spin}s linear infinite` }}><Coin size={c.size} /></span>
          </span>
        </span>
      ))}
      {p.title && (
        <div className="absolute inset-x-0 top-[26%] flex flex-col items-center gc-motion" style={{ animation: `gc-banner ${long}s ease-out both` }}>
          {many && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] h-[440px] rounded-full opacity-70 gc-motion" style={{
              background: 'repeating-conic-gradient(rgba(253,224,71,.4) 0 9deg, transparent 9deg 18deg)',
              WebkitMaskImage: 'radial-gradient(circle, #000 20%, transparent 68%)', maskImage: 'radial-gradient(circle, #000 20%, transparent 68%)',
              animation: 'gc-rays 7s linear infinite',
            }} />
          )}
          <div className={`relative font-display font-black tracking-tight text-center px-4 ${many ? 'text-5xl' : 'text-4xl'}`}
            style={{ ...GOLD_TEXT, WebkitTextStroke: '1px #7c2d12', filter: 'drop-shadow(0 3px 0 #7c2d12) drop-shadow(0 8px 14px rgba(0,0,0,.45))', animation: 'gc-shine 1.6s linear infinite' }}>
            {p.title}
          </div>
          {p.amount && <div className="relative mt-2 rounded-full bg-black/75 px-4 py-1 font-mono text-xl font-bold text-amber-300 shadow-lg">{p.amount}</div>}
        </div>
      )}
    </div>
  )
}

/**
 * A celebration to show over the page: coins spraying up from `from` (a point on screen, or the middle), raining
 * down too for the big ones, and a banner if there's a title. Gone again after a few seconds.
 */
export function useCelebration() {
  const [party, setParty] = useState<Party | null>(null)
  const seq = useRef(0)
  const celebrate = useCallback((p: Omit<Party, 'id'>) => { seq.current += 1; setParty({ ...p, id: seq.current }) }, [])
  useEffect(() => {
    if (!party) return
    const id = setTimeout(() => setParty(null), party.tier === 'jackpot' ? 4400 : 3000)
    return () => clearTimeout(id)
  }, [party])
  return { party: party ? <PartyLayer key={party.id} p={party} /> : null, celebrate }
}

/** The middle of an element on screen, where coins should spray from. */
export function centerOf(el: Element | null | undefined) {
  if (!el) return undefined
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

/** A number that counts up to `to` over `ms` whenever `to` changes (from 0, or from `from`). */
export function useCountUp(to: number, ms = 900, from = 0) {
  const [shown, setShown] = useState(to)
  useEffect(() => {
    if (to <= from) { setShown(to); return }
    const start = performance.now()
    let raf = 0
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms)
      setShown(from + (to - from) * (1 - Math.pow(1 - k, 3)))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [to, ms, from])
  return shown
}
