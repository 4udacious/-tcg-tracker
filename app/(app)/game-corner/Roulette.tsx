'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmt, money } from '../vending/tokens'
import { colorOf, refusal, WHEEL, type BetKind, type CornerState, type RouletteBet } from './state'

const CELL_BG = { red: 'bg-red-600 text-white', black: 'bg-zinc-900 text-white', green: 'bg-emerald-600 text-white' } as const
const key = (kind: BetKind, pick: number | null) => `${kind}:${pick ?? ''}`
const LABEL: Record<string, string> = { red: 'Red', black: 'Black', odd: 'Odd', even: 'Even', low: '1–18', high: '19–36' }
const betName = (b: { kind: BetKind; pick: number | null }) =>
  b.kind === 'number' ? String(b.pick) : b.kind === 'dozen' ? `${['1st', '2nd', '3rd'][(b.pick ?? 1) - 1]} 12` : b.kind === 'column' ? `Column ${b.pick}` : LABEL[b.kind]

/** The wheel: 37 pockets round it, turned so the result sits under the pointer. */
function Wheel({ turn }: { turn: number }) {
  const R = 100, r = 70, step = 360 / 37
  const pt = (a: number, rad: number) => [R + rad * Math.sin((a * Math.PI) / 180), R - rad * Math.cos((a * Math.PI) / 180)]
  return (
    <div className="relative w-52 h-52 mx-auto">
      <svg viewBox="0 0 200 200" className="w-full h-full" style={{ transform: `rotate(${turn}deg)`, transition: 'transform 5s cubic-bezier(.15,.85,.25,1)' }} aria-hidden>
        <circle cx={R} cy={R} r={R} fill="#78350f" />
        {WHEEL.map((n, i) => {
          const a0 = i * step - step / 2, a1 = a0 + step
          const [x0, y0] = pt(a0, R - 6), [x1, y1] = pt(a1, R - 6), [x2, y2] = pt(a1, r), [x3, y3] = pt(a0, r)
          const fill = colorOf(n) === 'red' ? '#dc2626' : colorOf(n) === 'black' ? '#18181b' : '#059669'
          const [tx, ty] = pt(i * step, R - 17)
          return (
            <g key={n}>
              <path d={`M${x0} ${y0} A${R - 6} ${R - 6} 0 0 1 ${x1} ${y1} L${x2} ${y2} A${r} ${r} 0 0 0 ${x3} ${y3} Z`} fill={fill} stroke="#fbbf24" strokeWidth="0.4" />
              <text x={tx} y={ty} fill="#fff" fontSize="8" fontWeight="700" textAnchor="middle" dominantBaseline="middle" transform={`rotate(${i * step} ${tx} ${ty})`}>{n}</text>
            </g>
          )
        })}
        <circle cx={R} cy={R} r={r} fill="#92400e" stroke="#fbbf24" strokeWidth="1.5" />
        <circle cx={R} cy={R} r={22} fill="#fbbf24" />
      </svg>
      <div className="absolute left-1/2 -top-1 -translate-x-1/2 w-0 h-0 border-x-8 border-x-transparent border-t-[14px] border-t-signal drop-shadow" aria-hidden />
    </div>
  )
}

/**
 * The roulette table: one single-zero wheel everyone shares. A round every 30
 * seconds: 20 to bet, then the spin. Everyone's chips are on the board, by
 * name, and everyone sees the same result.
 */
export default function Roulette({ state, skew, onPlayed }: { state: CornerState; skew: number; onPlayed: () => void }) {
  const rt = state.roulette
  const chips = [0.1, 0.25, 0.5, 1, 2, 5].filter((c) => c >= state.caps.min && c <= state.caps.roulette)
  const [chip, setChip] = useState(chips[0] ?? state.caps.min)
  const [note, setNote] = useState<string | null>(null)
  const [placing, setPlacing] = useState(false)
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 250); return () => clearInterval(t) }, [])

  // The wheel turns to each new result (always forwards, five turns and then some); it rests between rounds.
  const [turn, setTurn] = useState(0)
  const shown = useRef<number | null>(null)
  useEffect(() => {
    if (rt.result == null || shown.current === rt.round) return
    shown.current = rt.round
    const at = WHEEL.indexOf(rt.result) * (360 / 37)
    setTurn((t) => { const base = t - (t % 360); return base + 360 * 5 + (360 - at) })
  }, [rt.result, rt.round])

  const now = Date.now() + skew
  const closesIn = Math.max(0, Math.ceil((Date.parse(rt.bets_close_at) - now) / 1000))
  const nextIn = Math.max(0, Math.ceil((Date.parse(rt.round_ends_at) - now) / 1000))
  const open = rt.betting && closesIn > 0

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
    const { error } = await createClient().rpc('game_corner_roulette_bet', { p_kind: kind, p_pick: pick, p_amount: chip })
    setPlacing(false)
    if (error) setNote(refusal(error)); else onPlayed()
  }
  async function clear() {
    const { error } = await createClient().rpc('game_corner_roulette_clear')
    if (error) setNote(refusal(error)); else onPlayed()
  }

  const Cell = ({ kind, pick, label, cls = '' }: { kind: BetKind; pick: number | null; label: string; cls?: string }) => {
    const e = onCell.get(key(kind, pick))
    const hit = rt.result != null && !rt.betting && (kind === 'number' ? pick === rt.result : false)
    return (
      <button type="button" onClick={() => place(kind, pick)} disabled={!open}
        title={e ? `${e.who.join(', ')}: ${fmt(e.total)}` : `Bet ${fmt(chip)} on ${label}`}
        className={`relative min-h-9 rounded-md text-xs font-bold disabled:cursor-default ${cls} ${hit ? 'ring-2 ring-signal z-10' : ''}`}>
        {label}
        {e && (
          <span className={`absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full text-[10px] leading-5 font-mono shadow ${e.mine ? 'bg-signal text-ink' : 'bg-white text-ink border border-card-border'}`}>
            {fmt(e.total)}
          </span>
        )}
      </button>
    )
  }

  const result = rt.result != null && !rt.betting ? rt.result : null
  const myLast = rt.last && rt.last.round === rt.round ? rt.last : null

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-card-border bg-card p-4 space-y-3">
        <Wheel turn={turn} />
        <div className="text-center" aria-live="polite">
          {open ? (
            <p className="font-display font-semibold">Place your bets · <span className="font-mono tabular-nums">{closesIn}s</span></p>
          ) : result == null ? (
            <p className="font-display font-semibold">No more bets…</p>
          ) : (
            <p className="font-display font-semibold">
              <span className={`inline-grid place-items-center w-8 h-8 rounded-full mr-1.5 ${CELL_BG[colorOf(result)]}`}>{result}</span>
              {result === 0 ? 'Zero' : `${colorOf(result) === 'red' ? 'Red' : 'Black'}`}
              {myLast && <span className={`ml-2 text-sm ${myLast.payout > 0 ? 'text-signal' : 'text-muted'}`}>{myLast.payout > 0 ? `You win ${fmt(myLast.payout)}!` : `You lost ${fmt(myLast.stake)}.`}</span>}
              <span className="block text-xs text-muted font-normal">Next round in {nextIn}s</span>
            </p>
          )}
        </div>
        {rt.history.length > 0 && (
          <div className="flex gap-1 justify-center flex-wrap" aria-label="Last results">
            {rt.history.slice(0, 14).map((n, i) => (
              <span key={i} className={`grid place-items-center w-6 h-6 rounded-full text-[10px] font-bold ${CELL_BG[colorOf(n)]} ${i === 0 ? '' : 'opacity-70'}`}>{n}</span>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-card-border bg-card p-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Chip">
            {chips.map((c) => (
              <button key={c} type="button" onClick={() => setChip(c)} aria-pressed={chip === c}
                className={`w-11 h-11 rounded-full border-2 border-dashed text-xs font-mono font-bold ${chip === c ? 'bg-signal border-ink text-ink' : 'border-card-border'}`}>{fmt(c)}</button>
            ))}
          </div>
          <div className="text-right text-xs text-muted shrink-0">
            <div>Your bets <span className="font-mono text-ink">{fmt(mineTotal)}</span> / {fmt(state.caps.roulette)}</div>
            {mineTotal > 0 && open && <button type="button" onClick={clear} className="underline hover:text-ink">Take back</button>}
          </div>
        </div>

        <div className="grid grid-cols-[2.25rem_1fr_2.75rem] gap-1">
          <Cell kind="number" pick={0} label="0" cls={`${CELL_BG.green} row-span-3 h-full`} />
          <div className="grid grid-cols-12 grid-rows-3 gap-1 row-span-3">
            {[3, 2, 1].flatMap((row) => Array.from({ length: 12 }, (_, c) => c * 3 + row)).map((n) => (
              <Cell key={n} kind="number" pick={n} label={String(n)} cls={CELL_BG[colorOf(n)]} />
            ))}
          </div>
          {[3, 2, 1].map((col) => <Cell key={col} kind="column" pick={col} label="2:1" cls="border border-card-border" />)}
        </div>
        <div className="grid grid-cols-3 gap-1 pl-[2.5rem] pr-[3rem]">
          {[1, 2, 3].map((d) => <Cell key={d} kind="dozen" pick={d} label={`${['1st', '2nd', '3rd'][d - 1]} 12`} cls="border border-card-border" />)}
        </div>
        <div className="grid grid-cols-6 gap-1 pl-[2.5rem] pr-[3rem]">
          <Cell kind="low" pick={null} label="1–18" cls="border border-card-border" />
          <Cell kind="even" pick={null} label="Even" cls="border border-card-border" />
          <Cell kind="red" pick={null} label="Red" cls={CELL_BG.red} />
          <Cell kind="black" pick={null} label="Black" cls={CELL_BG.black} />
          <Cell kind="odd" pick={null} label="Odd" cls="border border-card-border" />
          <Cell kind="high" pick={null} label="19–36" cls="border border-card-border" />
        </div>
        <p className="text-[11px] text-muted text-center">
          A number pays 35 to 1, a dozen or column 2 to 1, the rest even money. Zero takes every outside bet.
        </p>
        {note && <p className="text-sm text-center text-muted">{note}</p>}
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
