'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmt, money, num } from '../vending/tokens'
import { refusal, type CornerState, type Reel } from './state'

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
const blankGrid = (): Reel[] => Array(9).fill('BLANK')
const randomGrid = (): Reel[] => Array.from({ length: 9 }, () => FACES[Math.floor(Math.random() * FACES.length)])

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

/**
 * A machine's 3x3 window, reel by reel (cells[reel * 3 + row]), with the paylines that paid drawn over it. `moving`:
 * how many reels are still spinning, from the right.
 */
function Window({ cells, lines = [], size, moving = 0 }: { cells: Reel[]; lines?: number[]; size: number; moving?: number }) {
  const cell = size + Math.round(size * 0.35), gap = Math.max(2, Math.round(size / 12))
  const at = (reel: number, row: number) => [reel * (cell + gap) + cell / 2, row * (cell + gap) + cell / 2]
  const span = 3 * cell + 2 * gap
  return (
    <div className="relative" style={{ width: span, height: span }}>
      <div className="grid grid-cols-3" style={{ gap }}>
        {[0, 1, 2].flatMap((row) => [0, 1, 2].map((reel) => (
          <div key={`${reel}-${row}`} className={`grid place-items-center rounded-md bg-white ${size > 30 ? 'shadow-inner' : 'border border-card-border'} ${reel >= 3 - moving ? 'blur-[1px]' : ''}`}
            style={{ width: cell, height: cell }}>
            <Face r={cells[reel * 3 + row] ?? 'BLANK'} size={size} />
          </div>
        )))}
      </div>
      {lines.length > 0 && (
        <svg className="absolute inset-0 pointer-events-none" viewBox={`0 0 ${span} ${span}`} aria-hidden>
          {lines.map((l) => {
            const pts = LINE_ROWS[l - 1].map((row, reel) => at(reel, row).join(',')).join(' ')
            return <polyline key={l} points={pts} fill="none" stroke={LINE_COLOR[l - 1]} strokeWidth={Math.max(2, size / 10)} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
          })}
        </svg>
      )}
    </div>
  )
}

/**
 * The slots: a row of eight machines, each a 3x3 window with five paylines (the three rows and the two diagonals),
 * all played every spin, the bet split evenly across them. Sit at a free one (or one nobody has touched for 2
 * minutes), bet, spin. Everyone sees who's at each machine and their last spin, so you're playing beside the others.
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
  const [note, setNote] = useState<string | null>(null)
  const [win, setWin] = useState<number | null>(null)
  const [showPays, setShowPays] = useState(false)
  const [sitting, setSitting] = useState<number | null>(null)
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => { if (ticker.current) clearInterval(ticker.current) }, [])
  useEffect(() => { if (!steps.includes(lineBet) && steps.length) setLineBet(steps[0]) }, [steps, lineBet])

  async function sit(machine: number) {
    setSitting(machine); setNote(null)
    const { error } = await createClient().rpc('game_corner_slot_sit', { p_machine: machine })
    setSitting(null)
    if (error) setNote(refusal(error)); else { setWin(null); setPaid([]); setCells(blankGrid()); onPlayed() }
  }
  async function leave() {
    await createClient().rpc('game_corner_slot_leave')
    onPlayed()
  }

  async function spin() {
    if (spinning) return
    setSpinning(true); setNote(null); setWin(null); setPaid([]); setMoving(3)
    // The reels blur through faces until the machine answers, then stop one by one, left to right.
    ticker.current = setInterval(() => setCells(randomGrid()), 70)
    const started = Date.now()
    const { data, error } = await createClient().rpc('game_corner_slot_spin', { p_bet: bet })
    await new Promise((r) => setTimeout(r, Math.max(0, 700 - (Date.now() - started))))
    if (ticker.current) clearInterval(ticker.current)
    if (error || !data) {
      setMoving(0); setSpinning(false); setNote(refusal(error)); return
    }
    const res = data as { reels: Reel[]; win: number; lines: { line: number; mult: number; win: number }[] }
    for (let stop = 1; stop <= 3; stop++) {
      // Reels that have stopped show the result; the rest keep blurring.
      setCells(() => { const rnd = randomGrid(); return res.reels.map((r, i) => (Math.floor(i / 3) < stop ? r : rnd[i])) })
      setMoving(3 - stop)
      await new Promise((r) => setTimeout(r, 260))
    }
    setPaid(res.lines.map((l) => ({ ...l, mult: num(l.mult), win: num(l.win) })))
    setWin(num(res.win)); setSpinning(false); onPlayed()
  }

  const result = win == null ? null : win === 0 ? 'No luck this time.' : win > bet ? `You win ${fmt(win)} tokens!` : `${fmt(win)} back.`

  return (
    <div className="space-y-4">
      {mine ? (
        <section className="rounded-2xl border border-card-border bg-card p-4 space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display font-semibold">Machine {mine.machine}</h2>
            <button type="button" onClick={leave} className="text-xs text-muted hover:text-ink underline">Leave seat</button>
          </div>
          <div className="flex justify-center rounded-xl bg-gradient-to-b from-zinc-900 to-zinc-700 p-3" aria-live="polite">
            <Window cells={cells} lines={spinning ? [] : paid.map((p) => p.line)} size={52} moving={spinning ? moving : 0} />
          </div>
          <p className={`text-center text-sm min-h-5 ${win && win > bet ? 'text-signal font-semibold' : 'text-muted'}`}>{spinning ? 'Spinning…' : note ?? result ?? 'Five lines, every spin. Pick a bet and spin.'}</p>
          {!spinning && paid.length > 0 && (
            <ul className="text-xs space-y-0.5">
              {paid.map((p) => (
                <li key={p.line} className="flex items-center gap-2">
                  <span className="w-3 h-1 rounded-full" style={{ background: LINE_COLOR[p.line - 1] }} aria-hidden />
                  <span className="flex-1">{LINE_NAME[p.line - 1]}: {p.mult}× the line</span>
                  <span className="font-mono">+{fmt(p.win)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-1">
            <p className="text-center text-[11px] text-muted">Bet a line</p>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {steps.map((b) => (
                <button key={b} type="button" onClick={() => setLineBet(b)} aria-pressed={lineBet === b} disabled={spinning}
                  className={`min-w-12 h-9 px-2 rounded-full border text-sm font-mono ${lineBet === b ? 'bg-ink text-white border-ink' : 'border-card-border'}`}>{fmt(b)}</button>
              ))}
            </div>
          </div>
          <button type="button" onClick={spin} disabled={spinning || !state.open || state.balance < bet}
            className="w-full h-12 rounded-xl bg-signal text-ink font-display font-bold text-lg disabled:opacity-50">
            {state.balance < bet ? 'Not enough tokens' : `SPIN · ${fmt(bet)}`}
            <span className="block text-[11px] font-sans font-medium -mt-1">{LINES} lines × {fmt(lineBet)}</span>
          </button>
          <button type="button" onClick={() => setShowPays((v) => !v)} className="w-full text-xs text-muted underline">{showPays ? 'Hide' : 'Show'} what pays</button>
          {showPays && (
            <div className="space-y-3">
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
      ) : (
        <p className="text-sm text-muted">Pick a free machine to sit down. You keep it while you play; after 2 minutes away, it’s free again.</p>
      )}
      {!mine && note && <p className="text-sm text-muted">{note}</p>}

      <section aria-label="The row of machines" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {state.slots.map((m) => {
          const recent = m.at && Date.now() - Date.parse(m.at) < 6000
          const big = recent && m.win != null && m.bet != null && m.win > m.bet
          return (
            <div key={m.machine} className={`rounded-xl border p-2 bg-card ${m.mine && m.player ? 'border-signal' : 'border-card-border'} ${big ? 'ring-2 ring-signal' : ''}`}>
              <div className="flex items-center justify-between text-[11px] text-muted">
                <span>#{m.machine}</span>
                {m.player && m.win != null && m.at && recent && <span className={big ? 'text-signal font-semibold' : ''}>{m.win > 0 ? `+${fmt(m.win)}` : '–'}</span>}
              </div>
              <div className="flex justify-center my-1.5">
                <Window cells={m.player && m.reels?.length === 9 ? m.reels : blankGrid()} lines={m.player && recent ? m.lines ?? [] : []} size={16} />
              </div>
              {m.player ? (
                <div className="flex items-center gap-1.5 text-xs truncate">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {m.avatar ? <img src={m.avatar} alt="" className="w-4 h-4 rounded-full" /> : <span className="w-4 h-4 rounded-full bg-card-border" />}
                  <span className="truncate">{m.mine ? 'You' : m.player}</span>
                </div>
              ) : (
                <button type="button" onClick={() => sit(m.machine)} disabled={sitting != null || !state.open}
                  className="w-full h-7 rounded-lg border border-card-border text-xs font-medium hover:bg-ink hover:text-white disabled:opacity-50">
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
