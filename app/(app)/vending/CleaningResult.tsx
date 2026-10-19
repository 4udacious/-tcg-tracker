'use client'

import { useEffect, useState } from 'react'
import ConditionedCard, { type Condition } from './ConditionedCard'
import SoundToggle from './SoundToggle'
import { playPackSound } from './packSounds'

/**
 * A card coming back from the cleaners.
 *
 * It shows the card as it went in, then a polishing sweep passes over it and
 * leaves it as it came back - the before and after are the same copy drawn
 * twice, so the difference is the cleaning and nothing else. The numbers
 * behind the wear stay sealed (grading is what reveals those); what is said
 * is how much of the wear came off, or what went wrong.
 */
export default function CleaningResult({
  card, before, after, outcome, improved, pending, error, onDone,
}: {
  card: { name: string; image_url: string; rarity: string }
  before: Condition
  /** null while the result is still on its way. */
  after: Condition | null
  outcome: 'cleaned' | 'damaged' | null
  improved: number
  pending: boolean
  error: string | null
  onDone: () => void
}) {
  // Holds on the old card until the result is in, then gives the sweep a beat.
  const [revealed, setRevealed] = useState(false)
  useEffect(() => {
    if (!after) return
    const t = setTimeout(() => {
      setRevealed(true)
      playPackSound(outcome === 'damaged' ? 'slip' : 'chime')
    }, 700)
    return () => clearTimeout(t)
  }, [after, outcome])

  const creased = outcome === 'damaged' && after && (after.crease ?? 0) > (before.crease ?? 0)

  return (
    <div className="fixed inset-0 z-[70] bg-[#05070d] flex flex-col items-center justify-center p-4 gap-5"
         role="dialog" aria-modal="true" aria-label={`${card.name}, back from the cleaners`}>
      <SoundToggle className="absolute top-3 left-3 z-10" />

      <p className="font-mono text-[10px] tracking-[0.25em] text-sky-200/70 h-4">BACK FROM THE CLEANERS</p>

      <div className="relative w-[min(70vw,300px)] aspect-[245/342]">
        <ConditionedCard
          src={card.image_url} alt={card.name} condition={revealed && after ? after : before}
          rarity={card.rarity} detail="full"
          className="absolute inset-0 w-full h-full rounded-lg shadow-[0_10px_40px_rgba(0,0,0,0.6)]"
        />
        {/* The polish passing over, once, as the result lands. */}
        {after && (
          <div className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none">
            <div className="absolute inset-y-0 w-1/2 cr-sweep"
                 style={{ background: 'linear-gradient(100deg, transparent, rgba(186,230,253,0.55), rgba(255,255,255,0.8), rgba(186,230,253,0.55), transparent)' }} />
          </div>
        )}
      </div>

      <div className="text-center min-h-[6rem] space-y-1.5 max-w-xs" aria-live="polite">
        {error ? (
          <>
            <p className="text-sm text-red-300">{error}</p>
            <button onClick={onDone} className="text-xs text-white/70 underline underline-offset-2">Close</button>
          </>
        ) : !revealed ? (
          <p className="text-sm text-white/50">{pending ? 'Unwrapping it…' : ''}</p>
        ) : outcome === 'cleaned' ? (
          <>
            <p className="font-display font-bold text-lg text-sky-200">Cleaned up</p>
            <p className="text-sm text-white/70">
              About <span className="text-white font-semibold">{improved}%</span> of the wear came off.
            </p>
            <p className="text-[11px] text-white/40">
              Centering, creases, holes and tears are part of the card - no clean touches those.
            </p>
          </>
        ) : (
          <>
            <p className="font-display font-bold text-lg text-red-300">The cleaner slipped</p>
            <p className="text-sm text-white/70">
              It came back with the surface scratched up{creased ? ', and a crease it did not have' : ''}.
            </p>
          </>
        )}
        {revealed && !error && (
          <button
            onClick={onDone}
            className="mt-2 rounded-xl bg-signal text-white text-sm font-semibold px-6 py-2.5 hover:bg-signal/90 transition-colors"
          >
            Back to the binder
          </button>
        )}
      </div>

      <style>{`
        @keyframes crSweep { 0% { transform: translateX(-120%) } 100% { transform: translateX(260%) } }
        .cr-sweep { animation: crSweep 900ms ease-in-out 450ms both; }
        @media (prefers-reduced-motion: reduce) { .cr-sweep { animation: none; opacity: 0; } }
      `}</style>
    </div>
  )
}
