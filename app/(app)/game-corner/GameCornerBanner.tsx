'use client'

/*
 * The way into the Game Corner from the VVM page: a casino at night (warm lights out of focus, a row of marquee
 * bulbs chasing along the top, the green felt of a table in front with chips and a pair of cards on it, a roulette
 * wheel turning in the corner) and the name in gold. While the Game Corner is closed only admins see it, and it
 * says so in a small tag.
 */
import Link from 'next/link'
import { Chip, GOLD_TEXT, NOISE } from './fx'

/** Lights across the room, out of focus: [left %, top %, size px, colour, opacity]. */
const BOKEH: [number, number, number, string, number][] = [
  [6, 18, 22, '#fbbf24', 0.5], [18, 8, 14, '#f472b6', 0.45], [31, 26, 10, '#fde68a', 0.5], [44, 6, 18, '#a855f7', 0.4],
  [57, 22, 12, '#fbbf24', 0.45], [66, 4, 24, '#f43f5e', 0.35], [78, 30, 10, '#fde68a', 0.55], [90, 12, 16, '#38bdf8', 0.35],
  [12, 44, 12, '#f59e0b', 0.4], [38, 48, 9, '#f9a8d4', 0.4], [61, 46, 14, '#fbbf24', 0.35], [86, 50, 11, '#c084fc', 0.4],
]
const BULBS = 22
const CSS = `
@keyframes gcb-bulb{0%,100%{opacity:1}50%{opacity:.25}}
@keyframes gcb-shine{from{background-position:200% 0}to{background-position:-200% 0}}
@keyframes gcb-turn{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion: reduce){.gcb-motion{animation:none!important}}
`

/** A small playing card, face up. */
function Card({ rank, suit, red, style }: { rank: string; suit: string; red?: boolean; style: React.CSSProperties }) {
  return (
    <span className="absolute grid place-items-center w-[30px] h-[42px] rounded-[4px] border border-zinc-300 shadow-md font-bold leading-none"
      style={{ background: 'linear-gradient(160deg,#fff,#f1f1ef)', color: red ? '#dc2626' : '#18181b', ...style }} aria-hidden>
      <span className="absolute left-[3px] top-[2px] text-[10px] text-center leading-[1]">{rank}<br />{suit}</span>
      <span className="text-lg mt-2">{suit}</span>
    </span>
  )
}

/** The wheel in the corner: red and black pockets round a brass centre, turning slowly. */
function Wheel() {
  const n = 18, R = 50
  return (
    <svg viewBox="0 0 100 100" className="absolute -right-8 -top-8 w-[104px] h-[104px] opacity-60 gcb-motion" style={{ animation: 'gcb-turn 24s linear infinite' }} aria-hidden>
      <circle cx={R} cy={R} r={50} fill="#3b1d0a" />
      {Array.from({ length: n }, (_, i) => {
        const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, r1 = 46, r2 = 32
        // Rounded: the server and the browser don't always agree on a cosine's last digit, and the page must match.
        const p = (a: number, r: number) => `${(R + r * Math.sin(a)).toFixed(2)} ${(R - r * Math.cos(a)).toFixed(2)}`
        return <path key={i} d={`M${p(a0, r1)} A${r1} ${r1} 0 0 1 ${p(a1, r1)} L${p(a1, r2)} A${r2} ${r2} 0 0 0 ${p(a0, r2)} Z`} fill={i === 0 ? '#047857' : i % 2 ? '#18181b' : '#b91c1c'} stroke="#d4a017" strokeWidth="0.5" />
      })}
      <circle cx={R} cy={R} r={32} fill="#7a4319" stroke="#d4a017" strokeWidth="1" />
      <circle cx={R} cy={R} r={9} fill="#d4a017" />
    </svg>
  )
}

export default function GameCornerBanner({ adminsOnly = false }: { adminsOnly?: boolean }) {
  return (
    <Link href="/game-corner" aria-label="WAPC Game Corner"
      className="group relative block w-full h-28 overflow-hidden rounded-2xl text-white shadow-lg ring-1 ring-black/40 transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
      style={{ background: 'radial-gradient(ellipse at 18% 120%, rgba(220,38,38,.55), transparent 55%), radial-gradient(ellipse at 88% -25%, rgba(168,85,247,.55), transparent 55%), radial-gradient(ellipse at 50% 40%, #31102f, #0c0612 78%)' }}>
      <style>{CSS}</style>
      {/* The room's lights, out of focus. */}
      {BOKEH.map(([x, y, r, c, o], i) => (
        <span key={i} className="absolute rounded-full blur-[5px] pointer-events-none" aria-hidden style={{ left: `${x}%`, top: `${y}%`, width: r, height: r, background: c, opacity: o }} />
      ))}
      <Wheel />
      {/* The marquee bulbs along the top, chasing. */}
      <span className="absolute inset-x-3 top-1.5 flex justify-between pointer-events-none" aria-hidden>
        {Array.from({ length: BULBS }, (_, i) => (
          <span key={i} className="block w-1.5 h-1.5 rounded-full gcb-motion" style={{
            background: 'radial-gradient(circle at 40% 35%, #fffbeb, #fde047 45%, #f59e0b)', boxShadow: '0 0 5px 1px rgba(253,224,71,.7)',
            animation: `gcb-bulb 1.4s ease-in-out ${(i % 4) * 0.35}s infinite`,
          }} />
        ))}
      </span>
      {/* The table in front: green felt with gold piping, chips stacked on the left, two cards on the right. */}
      <span className="absolute -inset-x-6 -bottom-12 h-[78px] rounded-[50%] pointer-events-none" aria-hidden style={{
        backgroundColor: '#0f4a2a', backgroundImage: `${NOISE}, radial-gradient(ellipse at 50% 0%, #17703f, #0a3a20 70%)`, boxShadow: 'inset 0 2px 0 #d4a017, 0 -6px 18px rgba(0,0,0,.5)',
      }} />
      <span className="absolute left-3 bottom-2 pointer-events-none" aria-hidden>
        <Chip value={5} size={26} style={{ position: 'absolute', left: 0, bottom: 0 }} />
        <Chip value={5} size={26} style={{ position: 'absolute', left: 0, bottom: 4 }} />
        <Chip value={1} size={26} style={{ position: 'absolute', left: 0, bottom: 8 }} />
        <Chip value={25} size={26} style={{ position: 'absolute', left: 22, bottom: 0, transform: 'rotate(-12deg)' }} />
        <span className="block w-12 h-9" />
      </span>
      <span className="absolute right-4 bottom-1 w-14 h-12 pointer-events-none" aria-hidden>
        <Card rank="A" suit="♠" style={{ left: 0, bottom: 0, transform: 'rotate(-14deg)' }} />
        <Card rank="K" suit="♥" red style={{ left: 16, bottom: 2, transform: 'rotate(9deg)' }} />
      </span>
      {/* The name. */}
      <span className="relative flex h-full flex-col items-center justify-center pb-3 text-center">
        <span className="text-[11px] font-black tracking-[0.55em] pl-[0.55em] text-amber-100/85" style={{ textShadow: '0 0 8px rgba(251,191,36,.6)' }}>WAPC</span>
        <span className="font-display font-black text-[28px] sm:text-[32px] leading-none tracking-wide gcb-motion"
          style={{ ...GOLD_TEXT, WebkitTextStroke: '0.5px rgba(124,45,18,.6)', filter: 'drop-shadow(0 2px 0 #7c2d12) drop-shadow(0 0 10px rgba(245,158,11,.55))', animation: 'gcb-shine 4s linear infinite' }}>
          GAME CORNER
        </span>
      </span>
      {adminsOnly && (
        <span className="absolute left-2.5 top-4 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-amber-100 ring-1 ring-amber-300/40">Admins only</span>
      )}
    </Link>
  )
}
