'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmt, money, num } from '../vending/tokens'
import { refusal, type CornerState, type Reel } from './state'
import { centerOf, Coin, GOLD_TEXT, NOISE, SCRATCHES, SCUFFS, useCelebration, useCountUp } from './fx'
import { sfx } from './sfx'

const FACES: Reel[] = ['SEVEN', 'BAR', 'PIKACHU', 'BALL', 'CHERRY', 'BLANK']
/** What a payline pays, as a multiple of its share of the bet (game_corner_slot_pays, v115). */
const PAYS: [Reel[], string, number][] = [
  [['SEVEN', 'SEVEN', 'SEVEN'], 'Three Sevens', 400],
  [['BAR', 'BAR', 'BAR'], 'Three Bars', 80],
  [['PIKACHU', 'PIKACHU', 'PIKACHU'], 'Three Pikachu', 30],
  [['BALL', 'BALL', 'BALL'], 'Three Poké Balls', 15],
  [['CHERRY', 'CHERRY', 'CHERRY'], 'Three Cherries', 8],
  [['CHERRY', 'BLANK', 'CHERRY'], 'Two Cherries', 4],
]
const LINES = 5
/** Each payline's row on reels 1, 2 and 3 (0 top, 1 middle, 2 bottom), and its name. */
const LINE_ROWS: [number, number, number][] = [[0, 0, 0], [1, 1, 1], [2, 2, 2], [0, 1, 2], [2, 1, 0]]
const LINE_NAME = ['Top row', 'Middle row', 'Bottom row', 'Diagonal ↘', 'Diagonal ↗']
const LINE_COLOR = ['#f59e0b', '#ef4444', '#3b82f6', '#22c55e', '#a855f7']
/** The payline tabs down each side of the reel glass, top to bottom: where each line starts and where it ends. */
const TABS_LEFT = [1, 4, 2, 5, 3], TABS_RIGHT = [1, 5, 2, 4, 3]
/** What blurs past while a reel spins (each reel starts at a different place on it). */
const STRIP: Reel[] = ['SEVEN', 'CHERRY', 'BALL', 'BLANK', 'PIKACHU', 'CHERRY', 'BAR', 'BLANK', 'BALL', 'CHERRY', 'PIKACHU', 'BLANK']
const blankGrid = (): Reel[] => Array(9).fill('BLANK')
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** One reel's face. */
export function Face({ r, size = 40 }: { r: Reel; size?: number }) {
  const s = { width: size, height: size }
  // eslint-disable-next-line @next/next/no-img-element
  if (r === 'PIKACHU') return <img src="/rpg/a/25.gif" alt="Pikachu" style={{ ...s, imageRendering: 'pixelated', objectFit: 'contain' }} />
  return (
    <svg viewBox="0 0 40 40" style={s} role="img" aria-label={r === 'BLANK' ? 'blank' : r.toLowerCase()}>
      {r === 'SEVEN' && <text x="20" y="31" textAnchor="middle" fontSize="30" fontWeight="900" fill="#dc2626" stroke="#7f1d1d" strokeWidth="1.2" fontFamily="system-ui, sans-serif">7</text>}
      {r === 'BAR' && <><rect x="3" y="12" width="34" height="16" rx="3" fill="#111827" /><text x="20" y="24.5" textAnchor="middle" fontSize="11" fontWeight="800" fill="#fde047" fontFamily="system-ui, sans-serif">BAR</text></>}
      {r === 'BALL' && <><circle cx="20" cy="20" r="15" fill="#fff" stroke="#111827" strokeWidth="2.5" /><path d="M5 20a15 15 0 0 1 30 0z" fill="#ef4444" stroke="#111827" strokeWidth="2.5" /><circle cx="20" cy="20" r="4.5" fill="#fff" stroke="#111827" strokeWidth="2.5" /></>}
      {r === 'CHERRY' && <><path d="M20 6c-2 8-8 12-10 16M20 6c2 8 6 12 9 15" stroke="#15803d" strokeWidth="2.2" fill="none" /><circle cx="11" cy="27" r="7" fill="#dc2626" /><circle cx="28" cy="26" r="7" fill="#b91c1c" /><circle cx="9" cy="25" r="1.8" fill="#fecaca" /></>}
    </svg>
  )
}

/** A small flat 3x3 window (the row of machines, the paytable), reel by reel (cells[reel * 3 + row]), paid lines drawn over it. */
function Window({ cells, lines = [], size }: { cells: Reel[]; lines?: number[]; size: number }) {
  const cell = size + Math.round(size * 0.35), gap = Math.max(2, Math.round(size / 12))
  const at = (reel: number, row: number) => [reel * (cell + gap) + cell / 2, row * (cell + gap) + cell / 2]
  const span = 3 * cell + 2 * gap
  return (
    <div className="relative" style={{ width: span, height: span }}>
      <div className="grid grid-cols-3" style={{ gap }}>
        {[0, 1, 2].flatMap((row) => [0, 1, 2].map((reel) => (
          <div key={`${reel}-${row}`} className="grid place-items-center rounded-[3px] bg-white" style={{ width: cell, height: cell }}>
            <Face r={cells[reel * 3 + row] ?? 'BLANK'} size={size} />
          </div>
        )))}
      </div>
      {lines.length > 0 && (
        <svg className="absolute inset-0 pointer-events-none" viewBox={`0 0 ${span} ${span}`} aria-hidden>
          {lines.map((l) => (
            <polyline key={l} points={LINE_ROWS[l - 1].map((row, reel) => at(reel, row).join(',')).join(' ')} fill="none"
              stroke={LINE_COLOR[l - 1]} strokeWidth={Math.max(2, size / 10)} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
          ))}
        </svg>
      )}
    </div>
  )
}

/** The marquee's bulbs, chasing; faster while it's paying out. One has blown. */
function Bulbs({ n, dead = [], party = false, size = 8 }: { n: number; dead?: number[]; party?: boolean; size?: number }) {
  return (
    <div className="flex justify-between" aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="block rounded-full gc-motion" style={{
          width: size, height: size,
          ...(dead.includes(i)
            ? { background: 'radial-gradient(circle at 40% 35%, #a8a29e, #57534e)', boxShadow: 'inset 0 1px 1px rgba(0,0,0,.6)' }
            : {
              background: 'radial-gradient(circle at 40% 35%, #fffbeb, #fde047 45%, #f59e0b)', boxShadow: `0 0 ${size * 0.8}px 1px rgba(253,224,71,.75)`,
              animation: `gc-bulb ${party ? 0.36 : 1.6}s ease-in-out ${(i % (party ? 2 : 4)) * (party ? 0.18 : 0.4)}s infinite`,
            }),
        }} />
      ))}
    </div>
  )
}

/** One reel drum behind the glass: a blur while it spins, then a thunk onto its three faces. */
function Drum({ faces, spinning, size, index }: { faces: Reel[]; spinning: boolean; size: number; index: number }) {
  const cell = size + Math.round(size * 0.3)
  const strip = useMemo(() => [...STRIP.slice(index * 4), ...STRIP.slice(0, index * 4)], [index])
  const row = (f: Reel, i: number) => <div key={i} className="grid place-items-center" style={{ height: cell }}><Face r={f} size={size} /></div>
  return (
    <div className="relative overflow-hidden" style={{ width: cell + 4, height: cell * 3, background: 'linear-gradient(90deg,#d6d3d1,#fafaf9 28%,#fff 50%,#fafaf9 72%,#d6d3d1)' }}>
      {spinning ? (
        <div className="absolute inset-x-0 top-0 gc-motion" style={{ ['--h' as string]: `${-cell * strip.length}px`, animation: `gc-reel ${0.34 + index * 0.03}s linear infinite`, filter: 'blur(1.5px)' }}>
          {[...strip, ...strip].map(row)}
        </div>
      ) : (
        <div className="gc-motion" style={{ animation: 'gc-stop .34s cubic-bezier(.3,1.5,.5,1)' }}>{faces.map(row)}</div>
      )}
      {/* The drum's curve: dark at the top and bottom of the glass. */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,.62), rgba(0,0,0,.1) 20%, transparent 38%, transparent 62%, rgba(0,0,0,.1) 80%, rgba(0,0,0,.62))' }} />
    </div>
  )
}

/** A meter on the cabinet: red-orange LED digits behind smoked glass. */
function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className="relative rounded-md bg-black px-1.5 pt-0.5 pb-1 text-right overflow-hidden" style={{ boxShadow: 'inset 0 0 0 1px #3f3f46, inset 0 2px 6px rgba(0,0,0,.9), 0 1px 0 rgba(255,255,255,.12)' }}>
      <div className="text-[8px] tracking-[0.22em] text-amber-100/50 text-left">{label}</div>
      <div className="font-mono text-[15px] font-bold leading-tight tabular-nums" style={{ color: '#fb923c', textShadow: '0 0 6px rgba(249,115,22,.85)' }}>{fmt(money(value))}</div>
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(160deg, rgba(255,255,255,.1), transparent 40%)' }} />
    </div>
  )
}

/** A fleck of paint gone, the metal showing through. */
function Chip({ style }: { style: React.CSSProperties }) {
  return <span className="absolute pointer-events-none" aria-hidden style={{ background: 'linear-gradient(135deg,#e7e5e4,#78716c)', clipPath: 'polygon(0 35%,35% 0,70% 12%,100% 45%,78% 82%,40% 100%,8% 78%)', opacity: 0.85, ...style }} />
}

/**
 * The slots: a row of eight machines, each a 3x3 window with five paylines (the three rows and the two diagonals),
 * all played every spin, the bet split evenly across them. Sit at a free one (or one nobody has touched for 2
 * minutes), bet, pull the lever. Everyone sees who's at each machine and their last spin, so you're playing beside
 * the others, and hears their big wins down the row.
 */
export default function Slots({ state, onPlayed }: { state: CornerState; onPlayed: () => void }) {
  const mine = state.slots.find((m) => m.mine && m.player)
  // A bet per line, and five lines: the spin costs five times it, within the table's smallest bet and the slots' cap.
  const steps = [0.02, 0.05, 0.1, 0.2, 0.5, 1].filter((b) => money(b * LINES) >= state.caps.min && money(b * LINES) <= state.caps.slots)
  const [lineBet, setLineBet] = useState(steps[0] ?? 0.02)
  const bet = money(lineBet * LINES)
  const [cells, setCells] = useState<Reel[]>(mine?.reels?.length === 9 ? mine.reels : blankGrid())
  const [paid, setPaid] = useState<{ line: number; mult: number; win: number }[]>([])
  const [moving, setMoving] = useState(0)   // reels still spinning, from the right
  const [spinning, setSpinning] = useState(false)
  const [pulled, setPulled] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [win, setWin] = useState<number | null>(null)
  const [party, setParty] = useState(false)
  const [shake, setShake] = useState(false)
  const [showPays, setShowPays] = useState(false)
  const [sitting, setSitting] = useState<number | null>(null)
  const tray = useRef<HTMLDivElement>(null)
  const { party: coins, celebrate } = useCelebration()
  const winShown = useCountUp(win ?? 0, win && win > bet * 10 ? 2200 : 900)

  useEffect(() => { if (!steps.includes(lineBet) && steps.length) setLineBet(steps[0]) }, [steps, lineBet])

  // A neighbour's big win down the row: a faint jingle (not on the first look, and not your own).
  const seen = useRef<Map<number, string | null> | null>(null)
  useEffect(() => {
    const before = seen.current
    seen.current = new Map(state.slots.map((m) => [m.machine, m.at]))
    if (!before) return
    for (const m of state.slots) {
      if (m.mine || !m.at || before.get(m.machine) === m.at) continue
      if (m.win != null && m.bet != null && m.win >= m.bet * 5) { sfx.distantWin(); break }
    }
  }, [state.slots])

  async function sit(machine: number) {
    sfx.click()
    setSitting(machine); setNote(null)
    const { error } = await createClient().rpc('game_corner_slot_sit', { p_machine: machine })
    setSitting(null)
    if (error) setNote(refusal(error)); else { setWin(null); setPaid([]); setCells(blankGrid()); onPlayed() }
  }
  async function leave() {
    sfx.click()
    await createClient().rpc('game_corner_slot_leave')
    onPlayed()
  }

  async function spin(lever: boolean) {
    if (spinning || !state.open || state.balance < bet) return
    if (lever) { setPulled(true); sfx.lever(); setTimeout(() => setPulled(false), 260) } else sfx.click()
    setSpinning(true); setNote(null); setWin(null); setPaid([]); setParty(false); setMoving(3)
    const whir = sfx.reels()
    const started = Date.now()
    const { data, error } = await createClient().rpc('game_corner_slot_spin', { p_bet: bet })
    await wait(Math.max(0, (lever ? 1000 : 850) - (Date.now() - started)))
    if (error || !data) { whir(); setMoving(0); setSpinning(false); setNote(refusal(error)); return }
    const res = data as { reels: Reel[]; win: number; lines: { line: number; mult: number; win: number }[] }
    setCells(res.reels)
    // If the first two reels line up something good on a payline, the last one takes its time.
    const tease = LINE_ROWS.some(([a, b]) => { const x = res.reels[a], y = res.reels[3 + b]; return x === y && (x === 'SEVEN' || x === 'BAR' || x === 'PIKACHU') })
    for (let stop = 1; stop <= 3; stop++) {
      if (stop === 3 && tease) { sfx.tension(1.1); await wait(1100) }
      setMoving(3 - stop)
      sfx.reelStop(stop)
      await wait(stop === 3 ? 180 : 300)
    }
    whir()
    const lines = res.lines.map((l) => ({ ...l, mult: num(l.mult), win: num(l.win) }))
    const w = num(res.win)
    setPaid(lines); setWin(w); setSpinning(false); onPlayed()
    // How it pays out: the bigger, the louder.
    const from = centerOf(tray.current)
    if (w <= 0) return
    if (lines.some((l) => l.mult >= 400)) {
      setShake(true); setTimeout(() => setShake(false), 900)
      sfx.win('jackpot'); sfx.coins(30); celebrate({ tier: 'jackpot', title: 'JACKPOT!', amount: `+${fmt(w)}`, from })
    } else if (w >= bet * 10) {
      sfx.win('big'); sfx.coins(20); celebrate({ tier: 'big', title: 'BIG WIN!', amount: `+${fmt(w)}`, from })
    } else if (w > bet) {
      sfx.win('small'); sfx.coins(Math.min(12, Math.ceil((w / bet) * 3))); celebrate({ tier: 'small', from })
    } else {
      sfx.win('back'); sfx.coins(2); celebrate({ tier: 'back', from })
    }
    if (w > bet) { setParty(true); setTimeout(() => setParty(false), 3200) }
  }

  const result = win == null ? null : win === 0 ? 'No luck this time.' : win > bet ? `You win ${fmt(win)} tokens!` : `${fmt(win)} back.`
  const lit = spinning ? [] : paid.map((p) => p.line)
  const canSpin = !spinning && state.open && state.balance >= bet
  // The reel glass: three drums, the gap between them, and where each payline crosses.
  const size = 44, cell = size + Math.round(size * 0.3), drum = cell + 4, gap = 5
  const span = { w: drum * 3 + gap * 2, h: cell * 3 }
  const pt = (reel: number, row: number) => `${reel * (drum + gap) + drum / 2},${row * cell + cell / 2}`
  const tab = (line: number, side: 'l' | 'r') => (
    <span key={`${side}${line}`} className={`grid place-items-center w-4 h-4 rounded-[3px] text-[9px] font-bold gc-motion ${lit.includes(line) ? 'text-white' : ''}`}
      style={lit.includes(line)
        ? { background: LINE_COLOR[line - 1], boxShadow: `0 0 8px ${LINE_COLOR[line - 1]}`, animation: 'gc-flash .5s ease-in-out infinite' }
        : { background: '#1c1917', color: LINE_COLOR[line - 1], boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.12)' }}>{line}</span>
  )

  return (
    <div className="space-y-4">
      {coins}
      {/* The room: a dim casino, the machine glowing, carpet underfoot. */}
      <section className="relative overflow-hidden rounded-2xl px-3 pt-4" style={{ background: 'radial-gradient(ellipse at 50% 0%, #5b21b6 0%, #24113f 42%, #0c0a14 100%)' }}>
        <div className="absolute left-1/2 top-16 -translate-x-1/2 w-72 h-72 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(244,63,94,.35), transparent 65%)' }} aria-hidden />
        {mine ? (
          <div className="relative mx-auto gc-motion" style={{ maxWidth: 352, paddingRight: 30, animation: shake ? 'gc-shake .45s ease-in-out 2' : undefined }}>
            {/* The cabinet: red enamel gone tired, chrome trim, scratches, a few chips out of the paint. */}
            <div className="relative rounded-t-[26px] rounded-b-[14px] p-2.5 pb-3 text-white" style={{
              backgroundColor: '#7f1d1d',
              backgroundImage: `${SCRATCHES}, ${NOISE}, radial-gradient(ellipse at 15% 100%, rgba(120,53,15,.55), transparent 35%), radial-gradient(ellipse at 90% 96%, rgba(68,64,60,.6), transparent 30%), linear-gradient(180deg, #a3132f 0%, #7f1d1d 32%, #4c0d10 100%)`,
              boxShadow: 'inset 0 0 0 3px #d4d4d8, inset 0 0 0 5px #3f3f46, inset 0 0 0 6px rgba(255,255,255,.15), 0 18px 34px rgba(0,0,0,.6)',
            }}>
              <Chip style={{ left: 4, top: 96, width: 12, height: 9 }} />
              <Chip style={{ right: 3, top: 210, width: 9, height: 14 }} />
              <Chip style={{ left: 30, bottom: 4, width: 16, height: 7 }} />
              <Chip style={{ right: 60, top: 3, width: 10, height: 6 }} />

              {/* Marquee: dim glass, a blown bulb, the name in gold. */}
              <div className="relative rounded-t-[19px] rounded-b-md px-3 pt-2 pb-2 text-center overflow-hidden" style={{ background: 'linear-gradient(180deg,#1c1917,#0c0a09)', boxShadow: 'inset 0 0 0 2px #a16207, inset 0 0 0 3px #451a03, inset 0 0 20px rgba(0,0,0,.85)' }}>
                <Bulbs n={13} dead={[8]} party={party} />
                <div className="my-1 font-display font-black text-[27px] leading-none tracking-wider" style={{ ...GOLD_TEXT, opacity: 0.93, filter: 'drop-shadow(0 0 6px rgba(245,158,11,.45))', animation: party ? 'gc-shine 1.2s linear infinite' : undefined }}>GAME CORNER</div>
                <div className="text-[9px] tracking-[0.35em] text-amber-200/60">★ MACHINE {mine.machine} ★</div>
                <div className="mt-1"><Bulbs n={13} dead={[2]} party={party} /></div>
                <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `${SCRATCHES}, linear-gradient(170deg, rgba(255,255,255,.12), transparent 35%)` }} />
              </div>

              {/* The reel glass in its chrome bezel, payline tabs down each side; cracked once, and taped. */}
              <div className="relative mt-2.5 rounded-xl p-[5px]" style={{ background: 'linear-gradient(180deg,#f4f4f5,#a1a1aa 45%,#e4e4e7 55%,#71717a)', boxShadow: '0 2px 0 rgba(0,0,0,.55), inset 0 1px 0 #fff' }}>
                <div className="relative rounded-lg bg-zinc-950 py-2 flex justify-center items-center gap-1.5" style={{ boxShadow: 'inset 0 0 14px rgba(0,0,0,.9)' }} aria-live="polite">
                  <div className="flex flex-col justify-between self-stretch py-1">{TABS_LEFT.map((l) => tab(l, 'l'))}</div>
                  <div className="relative" style={{ width: span.w, height: span.h }}>
                    <div className="flex" style={{ gap }}>
                      {[0, 1, 2].map((r) => <Drum key={r} index={r} faces={cells.slice(r * 3, r * 3 + 3)} spinning={spinning && r >= 3 - moving} size={size} />)}
                    </div>
                    {lit.length > 0 && (
                      <svg className="absolute inset-0 pointer-events-none" viewBox={`0 0 ${span.w} ${span.h}`} aria-hidden>
                        {lit.map((l) => (
                          <polyline key={l} className="gc-motion" points={LINE_ROWS[l - 1].map((row, reel) => pt(reel, row)).join(' ')} fill="none" stroke={LINE_COLOR[l - 1]}
                            strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 4px ${LINE_COLOR[l - 1]})`, animation: 'gc-flash .6s ease-in-out infinite' }} />
                        ))}
                      </svg>
                    )}
                  </div>
                  <div className="flex flex-col justify-between self-stretch py-1">{TABS_RIGHT.map((l) => tab(l, 'r'))}</div>
                  {/* Glass: a glare, the crack, the tape over it. */}
                  <div className="absolute inset-0 rounded-lg pointer-events-none" style={{ background: 'linear-gradient(118deg, rgba(255,255,255,.2) 0 14%, transparent 26%, transparent 74%, rgba(255,255,255,.06) 84%)' }} />
                  <svg className="absolute right-1 top-1 w-16 h-12 pointer-events-none" viewBox="0 0 64 48" aria-hidden>
                    <path d="M63 2 L44 14 L36 13 L22 26 M44 14 L47 27 L40 40 M36 13 L31 4" stroke="rgba(255,255,255,.55)" strokeWidth=".8" fill="none" />
                  </svg>
                  <span className="absolute right-3 top-3 w-9 h-3.5 rotate-[32deg] pointer-events-none" aria-hidden style={{ background: 'rgba(254,243,199,.5)', boxShadow: '0 0 0 .5px rgba(120,113,108,.4)' }} />
                </div>
                {/* An old sticker, peeling. */}
                <span className="absolute -left-2 -top-3 grid place-items-center w-11 h-11 rounded-full -rotate-12 text-[8px] font-black leading-[1.05] text-red-800 text-center pointer-events-none" aria-hidden
                  style={{ background: `${SCUFFS}, radial-gradient(circle at 70% 30%, #fef9c3, #facc15 70%)`, boxShadow: '1px 2px 3px rgba(0,0,0,.4)', clipPath: 'polygon(0 0,100% 0,100% 72%,72% 100%,0 100%)' }}>5<br />LINES!</span>
              </div>

              <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                <Meter label="CREDIT" value={state.balance} />
                <Meter label="BET" value={bet} />
                <Meter label="WIN" value={winShown} />
              </div>

              {/* The button deck: worn pale where hands rest. */}
              <div className="relative mt-2.5 rounded-lg p-2" style={{ background: 'radial-gradient(ellipse at 50% 90%, rgba(255,255,255,.12), transparent 55%), linear-gradient(180deg,#3f3f46,#18181b)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.15), 0 2px 0 #000' }}>
                <div className="text-[9px] tracking-[0.25em] text-zinc-400 text-center">BET A LINE</div>
                <div className="flex flex-wrap justify-center gap-1.5 mt-1">
                  {steps.map((b) => (
                    <button key={b} type="button" onClick={() => { sfx.click(); setLineBet(b) }} aria-pressed={lineBet === b} disabled={spinning}
                      className="min-w-11 h-8 px-2 rounded-md font-mono text-xs font-bold transition-transform active:translate-y-[2px]"
                      style={lineBet === b
                        ? { background: 'linear-gradient(180deg,#fde68a,#f59e0b)', color: '#1c1917', boxShadow: '0 1px 0 #92400e, 0 0 10px rgba(251,191,36,.7)', transform: 'translateY(2px)' }
                        : { background: 'linear-gradient(180deg,#f4f4f5,#a1a1aa)', color: '#27272a', boxShadow: '0 3px 0 #52525b' }}>
                      {fmt(b)}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => spin(false)} disabled={!canSpin}
                  className="mt-2 w-full h-12 rounded-xl font-display font-black text-xl tracking-wider text-white transition-transform active:translate-y-[3px] disabled:opacity-60"
                  style={{ background: 'radial-gradient(ellipse at 50% 25%, #fca5a5, #dc2626 45%, #991b1b)', boxShadow: canSpin ? '0 4px 0 #7f1d1d, 0 0 14px rgba(239,68,68,.55)' : '0 4px 0 #7f1d1d', textShadow: '0 1px 0 #7f1d1d' }}>
                  {state.balance < bet ? 'NOT ENOUGH TOKENS' : spinning ? 'SPINNING…' : 'SPIN'}
                  <span className="block text-[10px] font-sans font-semibold tracking-normal -mt-1 opacity-80">{LINES} lines × {fmt(lineBet)} = {fmt(bet)}</span>
                </button>
              </div>

              {/* The coin tray, with what's been left in it. */}
              <div ref={tray} className="relative mt-2.5 mx-5 h-8 rounded-b-2xl rounded-t-md" style={{ background: 'linear-gradient(180deg,#09090b,#3f3f46 62%,#a1a1aa)', boxShadow: 'inset 0 6px 8px rgba(0,0,0,.9), 0 1px 0 rgba(255,255,255,.2)' }}>
                <span className="absolute left-[38%] bottom-1"><Coin size={12} /></span>
                <span className="absolute left-[46%] bottom-1.5"><Coin size={11} /></span>
                <span className="absolute left-[58%] bottom-1"><Coin size={12} /></span>
              </div>
            </div>

            {/* The lever on the cabinet's side: pull it to spin. */}
            <button type="button" onClick={() => spin(true)} disabled={!canSpin} aria-label="Pull the lever to spin"
              className="absolute right-[-6px] top-[150px] w-10 h-[170px] disabled:cursor-not-allowed">
              <span className="absolute left-[15px] bottom-[28px] w-[7px] h-[118px] origin-bottom gc-motion"
                style={{ transform: pulled ? 'perspective(260px) rotateX(-150deg)' : 'none', transition: pulled ? 'transform .18s ease-in' : 'transform .55s cubic-bezier(.3,1.7,.5,1)' }}>
                <span className="absolute inset-0 rounded-full" style={{ background: 'linear-gradient(90deg,#52525b,#f4f4f5 40%,#a1a1aa 70%,#3f3f46)' }} />
                <span className="absolute -top-[14px] left-1/2 -translate-x-1/2 w-[26px] h-[26px] rounded-full" style={{ background: 'radial-gradient(circle at 35% 30%, #fecaca 0 12%, #ef4444 38%, #991b1b 82%)', boxShadow: '0 3px 5px rgba(0,0,0,.55)' }} />
              </span>
              <span className="absolute left-0 bottom-[12px] w-[27px] h-[34px] rounded-r-lg" style={{ background: `${SCRATCHES}, linear-gradient(180deg,#e4e4e7,#71717a)`, boxShadow: 'inset 0 1px 0 #fff, 0 2px 4px rgba(0,0,0,.55)' }} />
            </button>

            <div className="flex items-baseline justify-between mt-2 px-1 text-white">
              <p className={`text-sm min-h-5 ${win && win > bet ? 'text-amber-300 font-semibold' : 'text-white/70'}`}>{spinning ? 'Spinning…' : note ?? result ?? 'Pull the lever, or press SPIN.'}</p>
              <button type="button" onClick={leave} className="text-xs text-white/60 hover:text-white underline shrink-0">Leave seat</button>
            </div>
            {!spinning && paid.length > 0 && (
              <ul className="text-xs space-y-0.5 px-1 text-white/85">
                {paid.map((p) => (
                  <li key={p.line} className="flex items-center gap-2">
                    <span className="w-3 h-1 rounded-full" style={{ background: LINE_COLOR[p.line - 1] }} aria-hidden />
                    <span className="flex-1">{LINE_NAME[p.line - 1]}: {p.mult}× the line</span>
                    <span className="font-mono">+{fmt(p.win)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="relative text-sm text-white/80 text-center py-6">Pick a free machine below and sit down. It’s yours while you play; after 2 minutes away, it’s free again.</p>
        )}
        {!mine && note && <p className="relative text-sm text-white/70 text-center pb-3">{note}</p>}
        {/* Carpet. */}
        <div className="relative -mx-3 mt-4 h-10" aria-hidden style={{
          backgroundColor: '#3b0d2e',
          backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,.65), transparent 70%), repeating-linear-gradient(45deg, rgba(250,204,21,.2) 0 2px, transparent 2px 13px), repeating-linear-gradient(-45deg, rgba(56,189,248,.16) 0 2px, transparent 2px 13px)',
        }} />
      </section>

      {mine && (
        <section className="rounded-2xl border border-card-border bg-card p-3">
          <button type="button" onClick={() => setShowPays((v) => !v)} aria-expanded={showPays} className="w-full text-left text-sm font-semibold flex justify-between">
            What pays <span className="text-muted font-normal">{showPays ? 'Hide' : 'Show'}</span>
          </button>
          {showPays && (
            <div className="space-y-3 mt-2">
              <table className="w-full text-sm">
                <tbody>
                  {PAYS.map(([faces, label, x]) => (
                    <tr key={label} className="border-t border-card-border">
                      <td className="py-1"><span className="inline-flex gap-0.5 align-middle">{faces.map((f, i) => <Face key={i} r={f} size={18} />)}</span></td>
                      <td className="py-1">{label}{x === 4 ? ' (any two)' : ''}</td>
                      <td className="py-1 text-right font-mono">{x}×</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-muted">On any of the five lines, each paid on its own, times your line bet:</p>
              <div className="flex justify-center gap-3">
                {LINE_ROWS.map((_, l) => (
                  <div key={l} className="text-center">
                    <Window cells={blankGrid()} lines={[l + 1]} size={8} />
                    <div className="text-[10px] text-muted mt-0.5">{l + 1}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* The row: small cabinets, each with whoever's at it and their last spin. */}
      <section aria-label="The row of machines" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {state.slots.map((m) => {
          const recent = m.at && Date.now() - Date.parse(m.at) < 6000
          const big = !!(recent && m.win != null && m.bet != null && m.win > m.bet)
          return (
            <div key={m.machine} className={`relative rounded-t-xl rounded-b-md p-1.5 text-white ${m.mine && m.player ? 'ring-2 ring-signal' : ''}`}
              style={{ backgroundImage: `${SCRATCHES}, linear-gradient(180deg,#991b1b,#450a0a)`, boxShadow: 'inset 0 0 0 2px #a1a1aa, inset 0 0 0 3px #3f3f46, 0 4px 10px rgba(0,0,0,.3)' }}>
              <div className="rounded-t-lg rounded-b-sm bg-zinc-950 px-1.5 py-1" style={{ boxShadow: 'inset 0 0 0 1px #a16207' }}>
                <Bulbs n={9} dead={m.machine % 3 === 0 ? [m.machine % 9] : []} party={big} size={4} />
                <div className="flex items-center justify-between text-[10px] leading-4 mt-0.5">
                  <span className="text-amber-200/80 font-semibold">#{m.machine}</span>
                  {m.player && m.win != null && recent && <span className={big ? 'text-amber-300 font-bold' : 'text-white/60'}>{m.win > 0 ? `+${fmt(m.win)}` : '–'}</span>}
                </div>
              </div>
              <div className="flex justify-center my-1.5 rounded-md p-1 bg-zinc-900" style={{ boxShadow: 'inset 0 0 0 1px #71717a' }}>
                <Window cells={m.player && m.reels?.length === 9 ? m.reels : blankGrid()} lines={m.player && recent ? m.lines ?? [] : []} size={15} />
              </div>
              {m.player ? (
                <div className="flex items-center gap-1.5 text-xs truncate rounded bg-black/30 px-1 py-0.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {m.avatar ? <img src={m.avatar} alt="" className="w-4 h-4 rounded-full" /> : <span className="w-4 h-4 rounded-full bg-white/20" />}
                  <span className="truncate">{m.mine ? 'You' : m.player}</span>
                </div>
              ) : (
                <button type="button" onClick={() => sit(m.machine)} disabled={sitting != null || !state.open}
                  className="w-full h-7 rounded-md text-xs font-bold text-zinc-900 disabled:opacity-50"
                  style={{ background: 'linear-gradient(180deg,#fde68a,#d97706)', boxShadow: '0 2px 0 #78350f' }}>
                  {sitting === m.machine ? 'Sitting…' : mine ? 'Move here' : 'Sit here'}
                </button>
              )}
            </div>
          )
        })}
      </section>
    </div>
  )
}
