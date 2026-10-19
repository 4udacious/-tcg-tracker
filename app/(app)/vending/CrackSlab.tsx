'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Slab from './Slab'
import ConditionedCard, { type Condition, RIP_CORNERS } from './ConditionedCard'
import SoundToggle from './SoundToggle'
import { playPackSound } from './packSounds'

/**
 * Cracking a slab open, one corner at a time.
 *
 * Each corner is a pry: a needle sweeps a gauge, and the tap has to land it
 * in the green. The zone narrows and the needle quickens corner by corner,
 * so the last one is the hard one. A slip still opens the corner - the
 * server then decides whether the slip cost the card anything.
 *
 * The needle is moved by writing to the element on each frame rather than
 * through state, so where it is at the moment of the tap is exactly where it
 * was drawn.
 */

/** What came of each corner, clockwise from the top left. */
export type CornerResult = 'clean' | 'lucky' | 'ding' | 'rip' | 'hole'

export interface CrackOutcome {
  results: CornerResult[]
  corners: number
  edges: number
  surface: number
  border_wear: number
  crease: number
  holes: number
  rips: number
}

const ZONE = [0.24, 0.21, 0.18, 0.15]
/** Seconds for the needle to cross the gauge once. */
const SWEEP = [1.05, 0.9, 0.78, 0.66]

/** Where each corner sits on the slab, as fractions of its box. */
const CORNER_AT: [number, number][] = [[0.08, 0.05], [0.92, 0.05], [0.92, 0.95], [0.08, 0.95]]

const RESULT_TEXT: Record<CornerResult, string> = {
  clean: 'Popped clean',
  lucky: 'Slipped, but got away with it',
  ding: 'Slipped and dinged the corner',
  rip: 'Slipped and tore the corner off',
  hole: 'Slipped and went through the card',
}

export default function CrackSlab({
  card, condition, grade, setName, onCrack, onDone, onClose,
}: {
  card: { name: string; number: string; set_code: string; image_url: string; rarity: string }
  condition: Condition
  grade: number
  setName: string
  /** Sends the slips; resolves with the result, or an error message. */
  onCrack: (slips: boolean[]) => Promise<CrackOutcome | string>
  onDone: (outcome: CrackOutcome) => void
  onClose: () => void
}) {
  const [corner, setCorner] = useState(0)
  const [slips, setSlips] = useState<boolean[]>([])
  const [feedback, setFeedback] = useState<{ hit: boolean } | null>(null)
  const [phase, setPhase] = useState<'prying' | 'sending' | 'freed' | 'error'>('prying')
  const [outcome, setOutcome] = useState<CrackOutcome | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(0)

  const needle = useRef<HTMLDivElement>(null)
  const pos = useRef(0)
  const [zoneStart, setZoneStart] = useState(() => 0.15 + Math.random() * (0.85 - 0.15 - ZONE[0]))
  const reduce = typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // The sweep. Restarts for each corner, at that corner's speed.
  useEffect(() => {
    if (phase !== 'prying' || feedback) return
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = (now - start) / 1000 / SWEEP[corner]
      const p = 1 - Math.abs((t % 2) - 1) // 0 → 1 → 0, at a steady speed
      pos.current = p
      if (needle.current) needle.current.style.left = `${(p * 100).toFixed(2)}%`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [corner, phase, feedback])

  const send = useCallback(async (all: boolean[]) => {
    setPhase('sending')
    const res = await onCrack(all)
    if (typeof res === 'string') { setError(res); setPhase('error'); return }
    setOutcome(res)
    setPhase('freed')
    if (res.results.some((r) => r === 'rip' || r === 'hole')) playPackSound('slip', { delayMs: 200 })
    else playPackSound('chime', { delayMs: 150 })
  }, [onCrack])

  const pry = useCallback(() => {
    if (phase !== 'prying' || feedback) return
    const p = pos.current
    const hit = p >= zoneStart && p <= zoneStart + ZONE[corner]
    playPackSound(hit ? 'crack' : 'slip')
    if (!hit) setShake((n) => n + 1)
    const next = [...slips, !hit]
    setSlips(next)
    setFeedback({ hit })
    setTimeout(() => {
      setFeedback(null)
      if (next.length === 4) { send(next); return }
      const c = corner + 1
      setZoneStart(0.12 + Math.random() * (0.88 - 0.12 - ZONE[c]))
      setCorner(c)
    }, reduce ? 300 : 650)
  }, [phase, feedback, zoneStart, corner, slips, send, reduce])

  // Space or Enter pries, as well as the button.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); pry() }
      if (e.key === 'Escape' && phase === 'prying' && slips.length === 0) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pry, phase, slips.length, onClose])

  const opened = slips.length
  const freed = phase === 'freed' && outcome

  return (
    <div className="fixed inset-0 z-[70] bg-[#05070d] flex flex-col items-center justify-center p-4 gap-4 overflow-hidden"
         role="dialog" aria-modal="true" aria-label={`Cracking the slab on ${card.name}`}>
      <SoundToggle className="absolute top-3 left-3 z-10" />
      {phase === 'prying' && opened === 0 && (
        <button onClick={onClose} className="absolute top-4 right-4 text-xs text-white/45 hover:text-white/80">
          Cancel
        </button>
      )}

      <p className="font-mono text-[10px] tracking-[0.25em] text-white/50 h-4">
        {freed ? 'FREE' : phase === 'sending' ? 'OPENING THE CASE…'
          : `CORNER ${Math.min(opened + 1, 4)} OF 4 · ${RIP_CORNERS[Math.min(corner, 3)].toUpperCase()}`}
      </p>

      {/* The slab, cracking as it goes - or the card, once it is out. */}
      <div className="relative w-[min(70vw,300px)]">
        {freed ? (
          <div className="cs-free">
            <ConditionedCard
              src={card.image_url} alt={card.name} condition={{ ...condition, ...outcome }}
              rarity={card.rarity} detail="full"
              className="w-full aspect-[245/342] rounded-lg shadow-[0_10px_40px_rgba(0,0,0,0.6)]"
            />
          </div>
        ) : (
          <div key={shake} className={shake > 0 && !reduce ? 'cs-shake' : undefined}>
            <Slab condition={condition} grade={grade} src={card.image_url} alt={card.name}
                  name={card.name} number={card.number} setCode={card.set_code} setName={setName} />
            {/* Cracks at the corners already opened: white for a clean pop,
                red where the tool slipped. */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 161"
                 preserveAspectRatio="none" aria-hidden="true">
              {slips.map((slipped, i) => {
                const [fx, fy] = CORNER_AT[i]
                const x = fx * 100, y = fy * 161
                const sx = fx < 0.5 ? 1 : -1, sy = fy < 0.5 ? 1 : -1
                const d = `M${x - sx * 6} ${y} L${x + sx * 3} ${y + sy * 4} L${x + sx * 9} ${y + sy * 3} ` +
                          `L${x + sx * 14} ${y + sy * 9} M${x + sx * 3} ${y + sy * 4} L${x + sx * 2} ${y + sy * 12}`
                return (
                  <path key={i} d={d} fill="none" strokeLinecap="round" strokeLinejoin="round"
                        stroke={slipped ? '#f87171' : '#ffffff'} strokeWidth={0.9} opacity={0.9} />
                )
              })}
            </svg>
            {/* The corner being worked on. */}
            {phase === 'prying' && (
              <span
                className="absolute w-9 h-9 -ml-[18px] -mt-[18px] rounded-full border-2 border-amber-300 cs-target pointer-events-none"
                style={{ left: `${CORNER_AT[corner][0] * 100}%`, top: `${CORNER_AT[corner][1] * 100}%` }}
              />
            )}
          </div>
        )}
      </div>

      {/* The gauge, the pry, and how it went. */}
      <div className="w-[min(80vw,340px)] space-y-3 min-h-[8.5rem]">
        {phase === 'prying' && (
          <>
            <div className="relative h-6 rounded-full bg-white/10 overflow-hidden" aria-hidden="true">
              <div className="absolute inset-y-0 bg-emerald-400/70 rounded-full"
                   style={{ left: `${zoneStart * 100}%`, width: `${ZONE[corner] * 100}%` }} />
              <div ref={needle} className="absolute inset-y-[-2px] w-1 -ml-0.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
            </div>
            <button
              onClick={pry}
              disabled={!!feedback}
              className="w-full rounded-xl bg-amber-400 text-ink font-display font-black tracking-wide py-3 text-base hover:bg-amber-300 transition-colors disabled:opacity-60"
            >
              PRY
            </button>
            <p className="text-center text-xs h-4" aria-live="polite">
              {feedback ? (
                <span className={feedback.hit ? 'text-emerald-300 font-semibold' : 'text-red-300 font-semibold'}>
                  {feedback.hit ? 'Clean pop!' : 'Slipped!'}
                </span>
              ) : (
                <span className="text-white/40">Tap when the needle is in the green</span>
              )}
            </p>
          </>
        )}

        {phase === 'sending' && (
          <p className="text-center text-sm text-white/60">Easing it out of the case…</p>
        )}

        {phase === 'error' && (
          <div className="text-center space-y-2">
            <p className="text-sm text-red-300">{error}</p>
            <button onClick={onClose} className="text-xs text-white/70 underline underline-offset-2">Close</button>
          </div>
        )}

        {freed && (
          <div className="space-y-2.5">
            <ul className="space-y-1">
              {outcome.results.map((r, i) => (
                <li key={i} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-white/45 capitalize">{RIP_CORNERS[i]}</span>
                  <span className={
                    r === 'clean' ? 'text-emerald-300'
                    : r === 'lucky' ? 'text-white/70'
                    : r === 'ding' ? 'text-amber-300'
                    : 'text-red-300 font-semibold'
                  }>
                    {RESULT_TEXT[r]}
                  </span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => onDone(outcome)}
              className="w-full rounded-xl bg-signal text-white text-sm font-semibold py-2.5 hover:bg-signal/90 transition-colors"
            >
              Put it in the binder
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes csTarget { 0%,100% { transform: scale(1); opacity: 0.9 } 50% { transform: scale(1.25); opacity: 0.45 } }
        .cs-target { animation: csTarget 0.9s ease-in-out infinite; }
        @keyframes csShake {
          0%,100% { transform: translate(0,0) rotate(0) }
          20% { transform: translate(-6px,2px) rotate(-1.5deg) } 40% { transform: translate(5px,-3px) rotate(1deg) }
          60% { transform: translate(-3px,1px) rotate(-0.5deg) } 80% { transform: translate(2px,0) }
        }
        .cs-shake { animation: csShake 360ms ease-out both; }
        @keyframes csFree {
          0%   { transform: scale(0.82) rotate(-4deg); opacity: 0; filter: blur(2px) }
          60%  { transform: scale(1.04) rotate(1deg); opacity: 1; filter: blur(0) }
          100% { transform: none; opacity: 1 }
        }
        .cs-free { animation: csFree 620ms cubic-bezier(.2,.8,.3,1.1) both; }
        @media (prefers-reduced-motion: reduce) { .cs-target, .cs-shake, .cs-free { animation: none; } }
      `}</style>
    </div>
  )
}
