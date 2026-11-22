'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmt, money } from '../vending/tokens'
import { capsFor, colorOf, refusal, RED, WHEEL, type BetKind, type Caps, type CornerState, type RouletteBet, type RouletteState } from './state'
import { centerOf, Chip, chipsFor, GOLD_TEXT, RAIL_LUXE, RAIL_WORN, VELVET, VELVET_RED, WOOD, useCelebration } from './fx'
import { sfx } from './sfx'

/** How long the wheel turns, and when the ball leaves the track for the pockets (ms). */
const SPIN_MS = 5400, DROP_MS = 3700
const STEP = 360 / 37
/** The wheel's turn that puts number n at the top, where the ball comes to rest. */
const angleOf = (n: number) => (360 - WHEEL.indexOf(n) * STEP) % 360
const FILL = { red: '#b91c1c', black: '#18181b', green: '#047857' } as const
const key = (kind: BetKind, pick: number | null) => `${kind}:${pick ?? ''}`
const LABEL: Record<string, string> = { red: 'Red', black: 'Black', odd: 'Odd', even: 'Even', low: '1–18', high: '19–36' }
const betName = (b: { kind: BetKind; pick: number | null }) =>
  b.kind === 'number' ? String(b.pick) : b.kind === 'dozen' ? `${['1st', '2nd', '3rd'][(b.pick ?? 1) - 1]} 12` : b.kind === 'column' ? `Column ${b.pick}` : LABEL[b.kind]

/** Whether a bet wins on a result (game_corner_roulette_pays, v115). */
function wins(kind: BetKind, pick: number | null, r: number): boolean {
  if (kind === 'number') return r === pick
  if (r === 0) return false
  switch (kind) {
    case 'red': return RED.has(r)
    case 'black': return !RED.has(r)
    case 'odd': return r % 2 === 1
    case 'even': return r % 2 === 0
    case 'low': return r <= 18
    case 'high': return r >= 19
    case 'dozen': return Math.floor((r - 1) / 12) + 1 === pick
    case 'column': return ((r - 1) % 3) + 1 === pick
  }
  return false
}

/**
 * The wheel in its wooden bowl. The bowl and the ball track stay put; the head (numbers, pockets, cone, turret)
 * turns; the ball runs the other way round the track, then drops and rattles into its pocket at the top.
 */
function Wheel({ turn, ball, dropped, luxe = false, size = 252 }: { turn: number; ball: number; dropped: boolean; luxe?: boolean; size?: number }) {
  const head = size * 0.7, R = 100
  const pt = (a: number, rad: number) => [R + rad * Math.sin((a * Math.PI) / 180), R - rad * Math.cos((a * Math.PI) / 180)]
  const b = Math.max(9, size * 0.042)
  return (
    <div className="relative mx-auto rounded-full" style={luxe ? {
      // High limit: a black lacquer bowl ringed in gold.
      width: size, height: size,
      backgroundColor: '#0c0a09',
      backgroundImage: 'radial-gradient(circle, transparent 56%, rgba(0,0,0,.6) 70%, rgba(255,255,255,.16) 90%, rgba(0,0,0,.7) 100%), linear-gradient(145deg,#2f2a27,#0c0a09 58%,#1c1917)',
      boxShadow: '0 14px 30px rgba(0,0,0,.7), inset 0 0 0 2px #f3d27a, inset 0 0 0 4px #0c0a09, inset 0 0 0 5px rgba(243,210,122,.65), inset 0 0 0 7px #0c0a09',
    } : {
      width: size, height: size,
      backgroundColor: '#4a2309',
      backgroundImage: `radial-gradient(circle, transparent 56%, rgba(0,0,0,.55) 70%, rgba(255,220,170,.18) 90%, rgba(0,0,0,.65) 100%), ${WOOD}`,
      backgroundSize: 'auto, 320px 122px',
      boxShadow: '0 14px 30px rgba(0,0,0,.7), inset 0 0 0 3px #2a1406, inset 0 0 0 5px #b8860b, inset 0 0 0 7px #3b1d0a',
    }}>
      {/* The ball track: polished, darker, worn smooth (or, at high limit, black glass). */}
      <div className="absolute rounded-full" style={{ inset: size * 0.075, background: luxe ? 'radial-gradient(circle, #030303 63%, #18181b 74%, #44403c 88%, #0c0a09 100%)' : 'radial-gradient(circle, #140902 63%, #3b1d0a 74%, #7a4319 88%, #2a1406 100%)', boxShadow: 'inset 0 3px 7px rgba(0,0,0,.85)' }} />
      {/* Brass diamonds that knock the ball about. */}
      {Array.from({ length: 8 }, (_, i) => (
        <span key={i} className="absolute left-1/2 top-1/2 w-[7px] h-[7px]" aria-hidden
          style={{ transform: `translate(-50%,-50%) rotate(${i * 45 + 22.5}deg) translateY(${-size * 0.365}px) rotate(45deg)`, background: 'linear-gradient(135deg,#fef3c7,#b8860b 60%,#713f12)' }} />
      ))}
      <svg viewBox="0 0 200 200" className="absolute gc-motion" aria-hidden
        style={{ left: (size - head) / 2, top: (size - head) / 2, width: head, height: head, transform: `rotate(${turn}deg)`, transition: `transform ${SPIN_MS}ms cubic-bezier(.15,.85,.25,1)` }}>
        <defs>
          <radialGradient id="gc-cone" cx="45%" cy="40%" r="60%"><stop offset="0" stopColor="#c2843f" /><stop offset=".55" stopColor="#7a4319" /><stop offset="1" stopColor="#3b1d0a" /></radialGradient>
          <radialGradient id="gc-cone-lx" cx="42%" cy="36%" r="62%"><stop offset="0" stopColor="#52525b" /><stop offset=".5" stopColor="#18181b" /><stop offset="1" stopColor="#030303" /></radialGradient>
          <radialGradient id="gc-brass" cx="40%" cy="35%" r="65%"><stop offset="0" stopColor="#fef3c7" /><stop offset=".45" stopColor="#d4a017" /><stop offset="1" stopColor="#713f12" /></radialGradient>
        </defs>
        {WHEEL.map((n, i) => {
          const a0 = i * STEP - STEP / 2, a1 = a0 + STEP
          const [x0, y0] = pt(a0, 99), [x1, y1] = pt(a1, 99), [x2, y2] = pt(a1, 79), [x3, y3] = pt(a0, 79)
          const [p0, q0] = pt(a0, 79), [p1, q1] = pt(a1, 79), [p2, q2] = pt(a1, 63), [p3, q3] = pt(a0, 63)
          const [tx, ty] = pt(i * STEP, 89)
          return (
            <g key={n}>
              <path d={`M${x0} ${y0} A99 99 0 0 1 ${x1} ${y1} L${x2} ${y2} A79 79 0 0 0 ${x3} ${y3} Z`} fill={FILL[colorOf(n)]} stroke="#d4a017" strokeWidth="0.5" />
              <text x={tx} y={ty} fill="#fff" fontSize="9" fontWeight="700" textAnchor="middle" dominantBaseline="middle" transform={`rotate(${i * STEP} ${tx} ${ty})`}>{n}</text>
              {/* The pocket below the number, a silver fret either side. */}
              <path d={`M${p0} ${q0} A79 79 0 0 1 ${p1} ${q1} L${p2} ${q2} A63 63 0 0 0 ${p3} ${q3} Z`} fill={i % 2 ? '#27272a' : '#1f1f23'} stroke={luxe ? '#f3d27a' : '#d4d4d8'} strokeWidth="0.9" />
            </g>
          )
        })}
        <circle cx={R} cy={R} r={63} fill={luxe ? 'url(#gc-cone-lx)' : 'url(#gc-cone)'} stroke="#d4a017" strokeWidth="1.2" />
        <circle cx={R} cy={R} r={44} fill="none" stroke={luxe ? 'rgba(243,210,122,.35)' : 'rgba(255,220,170,.12)'} strokeWidth={luxe ? 1 : 6} />
        {luxe && <circle cx={R} cy={R} r={52} fill="none" stroke="rgba(243,210,122,.25)" strokeWidth="0.6" />}
        {/* The turret: a brass cross with ball ends, a knob in the middle. */}
        {[0, 90, 180, 270].map((a) => {
          const [x, y] = pt(a, 30)
          return <g key={a}><line x1={R} y1={R} x2={x} y2={y} stroke="url(#gc-brass)" strokeWidth="5" strokeLinecap="round" /><circle cx={x} cy={y} r="5" fill="url(#gc-brass)" /></g>
        })}
        <circle cx={R} cy={R} r={13} fill="url(#gc-brass)" stroke="#713f12" strokeWidth="1" />
        <circle cx={R - 3} cy={R - 4} r={4} fill="rgba(255,255,255,.55)" />
      </svg>
      {/* The ball: round the track the other way, then down into the pocket at the top. */}
      <div className="absolute inset-0 gc-motion" style={{ transform: `rotate(${ball}deg)`, transition: `transform ${SPIN_MS - 300}ms cubic-bezier(.2,.72,.3,1)` }}>
        <span className="absolute left-1/2 top-1/2 rounded-full gc-motion" style={{
          width: b, height: b, marginLeft: -b / 2, marginTop: -b / 2,
          transform: `translateY(${-(dropped ? size * 0.25 : size * 0.4)}px)`,
          transition: dropped ? 'transform .75s cubic-bezier(.35,1.8,.55,1)' : 'transform .3s ease-out',
          background: 'radial-gradient(circle at 35% 30%, #fff, #e5e7eb 55%, #9ca3af)', boxShadow: '0 1px 3px rgba(0,0,0,.7)',
        }} />
      </div>
    </div>
  )
}

/**
 * The roulette table: one single-zero wheel everyone shares, in a wooden frame with green velvet. A round every 30
 * seconds: 20 to bet, the bell, then the spin. Everyone's chips are on the board, by name, and everyone sees the
 * same ball drop.
 */
export default function Roulette({ state, skew, onPlayed, onHold }: { state: CornerState; skew: number; onPlayed: () => void; onHold: (balance: number | null) => void }) {
  const [high, setHigh] = useState(false)
  const rt = high && state.roulette_high ? state.roulette_high : state.roulette
  return (
    <div className="space-y-3">
      {state.roulette_high && (
        <nav aria-label="Wheels" className="grid grid-cols-2 gap-1.5">
          {[false, true].map((h) => {
            const c = capsFor(state, h), on = (rt.wheel === 2) === h
            return (
              <button key={String(h)} type="button" aria-pressed={on} onClick={() => { if (!on) sfx.click(); setHigh(h) }}
                className={`rounded-xl border px-3 py-1.5 text-left ${on ? (h ? 'border-amber-500 text-amber-100' : 'border-ink bg-ink text-white') : 'border-card-border bg-card'}`}
                style={on && h ? { background: 'linear-gradient(180deg,#3b0a17,#1c0509)' } : undefined}>
                <span className="block text-sm font-semibold">{h ? 'High limit' : 'Main wheel'}</span>
                <span className={`block text-[11px] ${on ? 'opacity-70' : 'text-muted'}`}>{fmt(c.min)} to {fmt(c.roulette)} a spin</span>
              </button>
            )
          })}
        </nav>
      )}
      {/* Its own table each: switching wheels starts afresh, the ball where that wheel's last landed. */}
      <Table key={rt.wheel} rt={rt} caps={capsFor(state, rt.wheel === 2)} open={state.open} balance={state.balance} skew={skew} onPlayed={onPlayed} onHold={onHold} />
    </div>
  )
}

/**
 * One wheel's table: the main one in a well-used wooden frame on green velvet; the high-limit one spotless, black
 * lacquer inlaid with gold on burgundy velvet, the wheel to match.
 */
function Table({ rt, caps, open: cornerOpen, balance, skew, onPlayed, onHold }: {
  rt: RouletteState; caps: Caps; open: boolean; balance: number; skew: number; onPlayed: () => void; onHold: (balance: number | null) => void
}) {
  const high = rt.wheel === 2
  const chips = chipsFor(caps.min, caps.roulette).slice(-6)
  const [chip, setChip] = useState(chips[0] ?? caps.min)
  const [note, setNote] = useState<string | null>(null)
  const [placing, setPlacing] = useState(false)
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 250); return () => clearInterval(t) }, [])
  const wheelBox = useRef<HTMLDivElement>(null)
  const { party, celebrate } = useCelebration()

  // The wheel starts where the last ball landed; each new result spins it (always forwards) and sends the ball round.
  const settledNow = rt.result != null && !rt.betting
  const [turn, setTurn] = useState(() => 360 * 3 + angleOf(settledNow ? rt.result! : rt.history[0] ?? 0))
  const [ball, setBall] = useState(0)
  const [dropped, setDropped] = useState(true)
  const [landed, setLanded] = useState<number | null>(settledNow ? rt.round : null)
  // The round is paid the moment the bets close, but the ball is still rolling: until it lands, the token count stays
  // at what it was before the round was paid.
  const rolling = settledNow && landed !== rt.round
  const before = useRef(balance)
  useEffect(() => { if (!rolling) before.current = balance })
  const hold = rolling ? before.current : null
  useEffect(() => { onHold(hold) }, [hold, onHold])
  useEffect(() => () => onHold(null), [onHold])
  const shown = useRef<number | null>(settledNow ? rt.round : null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  useEffect(() => {
    if (rt.result == null || rt.betting || shown.current === rt.round) return
    shown.current = rt.round
    const round = rt.round, result = rt.result
    sfx.wheel(SPIN_MS / 1000, DROP_MS / 1000)
    setDropped(false)
    setTurn((t) => t - (t % 360) + 360 * 5 + angleOf(result))
    setBall((b) => b - (((b % 360) + 360) % 360) - 360 * 6)
    timers.current.push(setTimeout(() => setDropped(true), DROP_MS), setTimeout(() => setLanded(round), SPIN_MS))
  }, [rt.result, rt.betting, rt.round])

  // The bell as the bets close; a tick for each of the last three seconds.
  const now = Date.now() + skew
  const closesIn = Math.max(0, Math.ceil((Date.parse(rt.bets_close_at) - now) / 1000))
  const nextIn = Math.max(0, Math.ceil((Date.parse(rt.round_ends_at) - now) / 1000))
  // Bets open: the round's betting time, and the Game Corner open (or you're an admin).
  const open = cornerOpen && rt.betting && closesIn > 0
  const was = useRef({ betting: rt.betting, closesIn, bets: rt.bets.length, round: rt.round })
  useEffect(() => {
    const p = was.current
    was.current = { betting: rt.betting, closesIn, bets: rt.bets.length, round: rt.round }
    if (p.betting && !rt.betting) sfx.bell()
    else if (open && closesIn <= 3 && closesIn < p.closesIn) sfx.tick()
    if (p.round === rt.round && rt.bets.length > p.bets) sfx.chip()
  }, [rt.betting, closesIn, open, rt.bets.length, rt.round])

  // Once the ball has landed: your winnings, or a shrug.
  const celebrated = useRef<number | null>(landed)
  useEffect(() => {
    if (landed == null || celebrated.current === landed) return
    celebrated.current = landed
    const my = rt.last && rt.last.round === landed ? rt.last : null
    if (!my) return
    if (my.payout > 0) {
      const big = my.payout >= my.stake * 10
      sfx.win(big ? 'big' : 'small'); sfx.coins(big ? 20 : 8)
      celebrate({ tier: big ? 'big' : 'small', title: big ? 'WINNER!' : 'You win!', amount: `+${fmt(my.payout)}`, from: centerOf(wheelBox.current) })
    } else sfx.lose()
  }, [landed, rt.last, celebrate])

  const result = landed === rt.round && settledNow ? rt.result : null
  const myLast = result != null && rt.last && rt.last.round === rt.round ? rt.last : null
  const history = settledNow && result == null ? rt.history.slice(1) : rt.history

  const mineTotal = money(rt.bets.filter((b) => b.mine).reduce((a, b) => a + b.amount, 0))
  const onCell = useMemo(() => {
    const m = new Map<string, { total: number; mine: number; who: string[] }>()
    for (const b of rt.bets) {
      const k = key(b.kind, b.pick), e = m.get(k) ?? { total: 0, mine: 0, who: [] }
      e.total = money(e.total + b.amount); if (b.mine) e.mine = money(e.mine + b.amount)
      if (!e.who.includes(b.player)) e.who.push(b.player)
      m.set(k, e)
    }
    return m
  }, [rt.bets])
  const byPlayer = useMemo(() => {
    const m = new Map<string, RouletteBet[]>()
    for (const b of rt.bets) m.set(b.mine ? 'You' : b.player, [...(m.get(b.mine ? 'You' : b.player) ?? []), b])
    return [...m.entries()]
  }, [rt.bets])

  async function place(kind: BetKind, pick: number | null) {
    if (!open || placing) return
    setPlacing(true); setNote(null)
    // The main wheel is the default, so a page newer than the database (before v117) still bets on it.
    const { error } = await createClient().rpc('game_corner_roulette_bet', { p_kind: kind, p_pick: pick, p_amount: chip, ...(high ? { p_wheel: 2 } : {}) })
    setPlacing(false)
    if (error) setNote(refusal(error)); else onPlayed()
  }
  async function clear() {
    sfx.click()
    const { error } = await createClient().rpc('game_corner_roulette_clear', high ? { p_wheel: 2 } : undefined)
    if (error) setNote(refusal(error)); else onPlayed()
  }

  // A place to bet on the layout. Called as a function, not mounted as a component of its own, so the cells keep
  // their place (and their chips' animations) across the four re-renders a second.
  const cell = ({ kind, pick, label, fill, side = false, style }: { kind: BetKind; pick: number | null; label: string; fill?: string; side?: boolean; style?: CSSProperties }) => {
    const e = onCell.get(key(kind, pick))
    const hit = result != null && wins(kind, pick, result)
    return (
      <button key={key(kind, pick)} type="button" onClick={() => place(kind, pick)} disabled={!open}
        title={e ? `${e.who.join(', ')}: ${fmt(e.total)}` : `Bet ${fmt(chip)} on ${label}`}
        className={`relative rounded-[4px] text-xs font-bold text-white disabled:cursor-default ${hit ? 'z-10' : ''}`}
        style={{
          background: fill ?? (hit ? 'rgba(253,230,138,.14)' : 'transparent'),
          boxShadow: `inset 0 0 0 1px rgba(253,230,138,.55)${fill ? ', inset 0 -2px 3px rgba(0,0,0,.35)' : ''}`,
          textShadow: '0 1px 1px rgba(0,0,0,.6)',
          ...style,
        }}>
        {hit && <span className="absolute inset-0 rounded-[4px] pointer-events-none gc-motion" style={{ animation: `gc-glow ${kind === 'number' ? 0.7 : 1.1}s ease-in-out infinite` }} aria-hidden />}
        {side ? <span className="inline-block [writing-mode:vertical-rl] rotate-180">{label}</span> : label}
        {e && (
          <span className={`absolute -top-2 -right-2 z-10 rounded-full ${e.mine ? 'ring-2 ring-amber-300' : ''} ${hit && e.mine ? 'gc-motion' : ''}`}
            style={{ animation: hit && e.mine ? 'gc-bounce .6s ease-in-out infinite' : 'gc-drop .25s ease-out' }}>
            <Chip value={e.total} size={22} label={fmt(e.total)} />
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="space-y-4">
      {party}
      {/* The table: a polished wooden rail round green velvet, gold piping inside it. */}
      <section className="rounded-[26px] p-2.5" style={high ? RAIL_LUXE : RAIL_WORN}>
        <div className="relative rounded-[18px] p-3 space-y-3 text-white" style={{ ...(high ? VELVET_RED : VELVET), boxShadow: 'inset 0 0 0 2px #c9a227, inset 0 0 0 3px rgba(0,0,0,.45), inset 0 0 40px rgba(0,0,0,.65)' }}>
          <div ref={wheelBox} className="pt-1"><Wheel turn={turn} ball={ball} dropped={dropped} luxe={high} /></div>

          <div className="text-center min-h-12" aria-live="polite">
            {open ? (
              <p className="font-display font-semibold text-lg">Place your bets · <span className="font-mono tabular-nums text-amber-300">{closesIn}s</span></p>
            ) : result == null ? (
              <p className="font-display font-semibold text-lg italic text-white/90">{rt.betting ? 'No more bets…' : 'No more bets. The ball is rolling…'}</p>
            ) : (
              <div className="font-display font-semibold">
                <span className="inline-grid place-items-center w-10 h-10 rounded-full mr-2 align-middle text-lg gc-motion" style={{ background: FILL[colorOf(result)], boxShadow: '0 0 0 2px #fde68a, 0 0 16px rgba(253,230,138,.6)', animation: 'gc-pop .4s ease-out' }}>{result}</span>
                <span className="text-lg align-middle">{result === 0 ? 'Zero' : colorOf(result) === 'red' ? 'Red' : 'Black'}</span>
                {myLast && <span className={`ml-2 align-middle ${myLast.payout > 0 ? 'text-amber-300' : 'text-white/60'}`}>{myLast.payout > 0 ? `You win ${fmt(myLast.payout)}!` : `You lost ${fmt(myLast.stake)}.`}</span>}
                <span className="block text-xs text-white/60 font-normal mt-0.5">Next round in {nextIn}s</span>
              </div>
            )}
          </div>

          {history.length > 0 && (
            <div className="flex gap-1 justify-center flex-wrap" aria-label="Last results">
              {history.slice(0, 14).map((n, i) => (
                <span key={i} className={`grid place-items-center w-6 h-6 rounded-full text-[10px] font-bold ${i === 0 ? '' : 'opacity-70'}`}
                  style={{ background: FILL[colorOf(n)], boxShadow: 'inset 0 0 0 1px rgba(253,230,138,.6)' }}>{n}</span>
              ))}
            </div>
          )}

          {/* The chip rack, in wood. */}
          <div className="space-y-1.5">
            <div className="flex justify-center gap-1 rounded-xl p-1.5 mx-auto w-fit" style={high ? RAIL_LUXE : RAIL_WORN} role="group" aria-label="Chip">
              {chips.map((c) => (
                <button key={c} type="button" onClick={() => { sfx.chip(); setChip(c) }} aria-pressed={chip === c} aria-label={`Chip ${fmt(c)}`}
                  className="rounded-full transition-transform" style={{ transform: chip === c ? 'translateY(-4px)' : 'none', filter: chip === c ? 'drop-shadow(0 0 6px rgba(253,224,71,.9))' : 'none' }}>
                  <Chip value={c} size={38} label={fmt(c)} />
                </button>
              ))}
            </div>
            <div className="text-center text-xs text-white/70">
              Your bets <span className="font-mono text-amber-200">{fmt(mineTotal)}</span> / {fmt(caps.roulette)}
              {mineTotal > 0 && open && <button type="button" onClick={clear} className="ml-2 underline hover:text-white">Take back</button>}
            </div>
          </div>

          {/* The layout stood on end for a phone: 0 at the top, the numbers three across down to 36, the columns' 2:1 at
              the foot; the dozens and the even-money bets down the left. */}
          <div className="grid grid-cols-[2.4rem_2.4rem_repeat(3,minmax(0,1fr))] auto-rows-[2.1rem] gap-[3px] pt-1">
            {cell({ kind: 'number', pick: 0, label: '0', fill: FILL.green, style: { gridColumn: '3 / span 3', gridRow: 1 } })}
            {([['low', '1–18'], ['even', 'Even'], ['red', 'Red'], ['black', 'Black'], ['odd', 'Odd'], ['high', '19–36']] as [BetKind, string][]).map(([k, l], i) => (
              cell({ kind: k, pick: null, label: l, side: true, fill: k === 'red' ? FILL.red : k === 'black' ? FILL.black : undefined,
                style: { gridColumn: 1, gridRow: `${2 + i * 2} / span 2` } })
            ))}
            {[1, 2, 3].map((d) => (
              cell({ kind: 'dozen', pick: d, label: `${['1st', '2nd', '3rd'][d - 1]} 12`, side: true, style: { gridColumn: 2, gridRow: `${2 + (d - 1) * 4} / span 4` } })
            ))}
            {Array.from({ length: 36 }, (_, i) => i + 1).map((n) => (
              cell({ kind: 'number', pick: n, label: String(n), fill: FILL[colorOf(n)], style: { gridRow: 1 + Math.ceil(n / 3), gridColumn: 3 + ((n - 1) % 3) } })
            ))}
            {[1, 2, 3].map((col) => (
              cell({ kind: 'column', pick: col, label: '2:1', style: { gridRow: 14, gridColumn: 2 + col } })
            ))}
          </div>
          <p className="text-[11px] text-white/60 text-center">
            A number pays 35 to 1, a dozen or column 2 to 1, the rest even money. Zero takes every outside bet.
          </p>
          {note && <p className="text-sm text-center text-amber-200">{note}</p>}
          <p className="text-center text-[10px] tracking-[0.35em] font-semibold" style={{ ...GOLD_TEXT, opacity: 0.8 }}>{high ? '★ HIGH LIMIT ★' : '★ GAME CORNER ★'}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-card-border bg-card p-3">
        <h2 className="font-display font-semibold text-sm mb-1.5">At the table this spin</h2>
        {byPlayer.length === 0 ? (
          <p className="text-xs text-muted">No bets yet. Be the first.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {byPlayer.map(([who, bets]) => (
              <li key={who} className="flex gap-2">
                <span className={`font-medium shrink-0 ${who === 'You' ? 'text-signal' : ''}`}>{who}</span>
                <span className="text-muted truncate">{bets.map((b) => `${fmt(b.amount)} on ${betName(b)}`).join(', ')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
