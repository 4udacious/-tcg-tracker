'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmt, num } from '../vending/tokens'
import { refusal, type CornerState, type Reel } from './state'

const FACES: Reel[] = ['SEVEN', 'BAR', 'PIKACHU', 'BALL', 'CHERRY', 'BLANK']
const PAYS: [Reel[], string, number][] = [
  [['SEVEN', 'SEVEN', 'SEVEN'], 'Three Sevens', 250],
  [['BAR', 'BAR', 'BAR'], 'Three Bars', 50],
  [['PIKACHU', 'PIKACHU', 'PIKACHU'], 'Three Pikachu', 20],
  [['BALL', 'BALL', 'BALL'], 'Three Poké Balls', 10],
  [['CHERRY', 'CHERRY', 'CHERRY'], 'Three Cherries', 5],
  [['CHERRY', 'CHERRY', 'BLANK'], 'Two Cherries', 2],
  [['CHERRY', 'BLANK', 'BLANK'], 'One Cherry', 1],
]

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
 * The slots: a row of eight machines. Sit at a free one (or one nobody has
 * touched for 2 minutes), bet, spin. Everyone sees who's at each machine and
 * their last spin, so you're playing beside the others.
 */
export default function Slots({ state, onPlayed }: { state: CornerState; onPlayed: () => void }) {
  const mine = state.slots.find((m) => m.mine && m.player)
  const steps = [0.1, 0.25, 0.5, 1, 2, 5].filter((b) => b >= state.caps.min && b <= state.caps.slots)
  const [bet, setBet] = useState(steps[0] ?? state.caps.min)
  const [reels, setReels] = useState<Reel[]>(mine?.reels ?? ['SEVEN', 'SEVEN', 'SEVEN'])
  const [stopped, setStopped] = useState(3)   // how many reels have stopped (3: all)
  const [spinning, setSpinning] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [win, setWin] = useState<number | null>(null)
  const [showPays, setShowPays] = useState(false)
  const [sitting, setSitting] = useState<number | null>(null)
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => { if (ticker.current) clearInterval(ticker.current) }, [])
  useEffect(() => { if (!steps.includes(bet) && steps.length) setBet(steps[0]) }, [steps, bet])

  async function sit(machine: number) {
    setSitting(machine); setNote(null)
    const { error } = await createClient().rpc('game_corner_slot_sit', { p_machine: machine })
    setSitting(null)
    if (error) setNote(refusal(error)); else { setWin(null); onPlayed() }
  }
  async function leave() {
    await createClient().rpc('game_corner_slot_leave')
    onPlayed()
  }

  async function spin() {
    if (spinning) return
    setSpinning(true); setNote(null); setWin(null); setStopped(0)
    // The reels blur through faces until the machine answers, then stop one by one.
    ticker.current = setInterval(() => setReels(() => [0, 1, 2].map(() => FACES[Math.floor(Math.random() * 5)])), 70)
    const started = Date.now()
    const { data, error } = await createClient().rpc('game_corner_slot_spin', { p_bet: bet })
    await new Promise((r) => setTimeout(r, Math.max(0, 700 - (Date.now() - started))))
    if (ticker.current) clearInterval(ticker.current)
    if (error || !data) {
      setStopped(3); setSpinning(false); setNote(refusal(error)); return
    }
    const res = data as { reels: Reel[]; win: number; mult: number }
    for (let i = 0; i < 3; i++) {
      setReels((prev) => prev.map((x, k) => (k <= i ? res.reels[k] : FACES[Math.floor(Math.random() * 5)])))
      setStopped(i + 1)
      await new Promise((r) => setTimeout(r, 260))
    }
    setWin(num(res.win)); setSpinning(false); onPlayed()
  }

  const result = win == null ? null : win === 0 ? 'No luck this time.' : win === bet ? `A Cherry: your ${fmt(bet)} back.` : `You win ${fmt(win)} tokens!`

  return (
    <div className="space-y-4">
      {mine ? (
        <section className="rounded-2xl border border-card-border bg-card p-4 space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display font-semibold">Machine {mine.machine}</h2>
            <button type="button" onClick={leave} className="text-xs text-muted hover:text-ink underline">Leave seat</button>
          </div>
          <div className="flex justify-center gap-2 rounded-xl bg-gradient-to-b from-zinc-900 to-zinc-700 p-3" aria-live="polite">
            {reels.map((r, i) => (
              <div key={i} className={`grid place-items-center w-20 h-24 rounded-lg bg-white shadow-inner ${spinning && i >= stopped ? 'blur-[1px]' : ''}`}>
                <Face r={r} size={56} />
              </div>
            ))}
          </div>
          <p className={`text-center text-sm min-h-5 ${win && win > bet ? 'text-signal font-semibold' : 'text-muted'}`}>{spinning ? 'Spinning…' : note ?? result ?? 'Pick a bet and spin.'}</p>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {steps.map((b) => (
              <button key={b} type="button" onClick={() => setBet(b)} aria-pressed={bet === b} disabled={spinning}
                className={`min-w-12 h-9 px-2 rounded-full border text-sm font-mono ${bet === b ? 'bg-ink text-white border-ink' : 'border-card-border'}`}>{fmt(b)}</button>
            ))}
          </div>
          <button type="button" onClick={spin} disabled={spinning || !state.open || state.balance < bet}
            className="w-full h-12 rounded-xl bg-signal text-ink font-display font-bold text-lg disabled:opacity-50">
            {state.balance < bet ? 'Not enough tokens' : `SPIN · ${fmt(bet)}`}
          </button>
          <button type="button" onClick={() => setShowPays((v) => !v)} className="w-full text-xs text-muted underline">{showPays ? 'Hide' : 'Show'} what pays</button>
          {showPays && (
            <table className="w-full text-sm">
              <tbody>
                {PAYS.map(([faces, label, x]) => (
                  <tr key={label} className="border-t border-card-border">
                    <td className="py-1"><span className="inline-flex gap-0.5 align-middle">{faces.map((f, i) => <Face key={i} r={f} size={18} />)}</span></td>
                    <td className="py-1">{label}{x === 1 ? ' (anywhere)' : ''}</td>
                    <td className="py-1 text-right font-mono">{x === 1 ? 'bet back' : `${x}×`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              <div className="flex justify-center gap-0.5 my-1.5">
                {(m.player && m.reels ? m.reels : (['BLANK', 'BLANK', 'BLANK'] as Reel[])).map((r, i) => (
                  <div key={i} className="grid place-items-center w-8 h-9 rounded bg-white border border-card-border"><Face r={r} size={22} /></div>
                ))}
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
