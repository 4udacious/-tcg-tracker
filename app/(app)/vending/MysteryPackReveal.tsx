'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Slab, { gradeInk, GRADE_LABEL } from './Slab'
import CardCelebration from './CardCelebration'
import SoundToggle from './SoundToggle'
import { playPackSound } from './packSounds'
import type { Condition } from './ConditionedCard'

/**
 * A grade comes back sealed in a foil mystery pack, and you rip it open.
 *
 * The grade is already decided by the time this mounts - collect_grade froze
 * it - so everything here is theatre, and it is built to hold its nerve: the
 * slab comes out with a "?" where the number goes, sits there for a beat, and
 * only then does the grade land. If the server is slower than the rip, the
 * "?" simply waits longer; the sequence never shows a number it does not have.
 *
 * Rip by swiping across the top of the pack, or by tapping it.
 */

type Phase = 'sealed' | 'tearing' | 'rising' | 'suspense' | 'stamped' | 'done'

interface Props {
  card: { name: string; number: string; set_code: string; image_url: string }
  condition: Condition
  /** null while collect_grade is still in flight. */
  grade: number | null
  error: string | null
  setName: string
  onDone: () => void
  onClose: () => void
}

/** Where the pack tears: just under the top crimp, with a ragged edge. */
const TEAR_Y = 13
const TEETH = 14

/** The zigzag along the tear, left to right, as polygon points. */
function tearEdge(): string[] {
  const pts: string[] = []
  for (let i = 0; i <= TEETH; i++) {
    const x = (i / TEETH) * 100
    const y = TEAR_Y + (i % 2 === 0 ? -1.4 : 1.4)
    pts.push(`${x}% ${y}%`)
  }
  return pts
}

const EDGE = tearEdge()
// Body keeps everything below the tear; the strip keeps everything above it.
// Two copies of the same face clipped along one edge read as a single pack
// until the strip moves.
const BODY_CLIP = `polygon(${[...EDGE, '100% 100%', '0% 100%'].join(', ')})`
const STRIP_CLIP = `polygon(${['0% 0%', '100% 0%', ...[...EDGE].reverse()].join(', ')})`

/** The wrapper's printed face. Rendered twice, so it must be stateless. */
function PackFace() {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-[5%]"
         style={{ background: 'linear-gradient(160deg, #1a1033 0%, #0b1020 55%, #071a24 100%)' }}>
      {/* Iridescent foil, drifting. Streaks with dark gaps between them rather
          than a continuous rainbow: a full wash screened over the body turned
          the whole pack a flat pastel lavender. */}
      <div className="absolute inset-0 mp-foil opacity-50 mix-blend-screen" />
      {/* Fine diagonal emboss. */}
      <div className="absolute inset-0"
           style={{ background: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.05) 0 5px, transparent 5px 11px)' }} />
      {/* Crimps. */}
      {(['top-0', 'bottom-0'] as const).map((pos) => (
        <div key={pos} className={`absolute inset-x-0 ${pos} h-[7%]`}
             style={{
               background:
                 'repeating-linear-gradient(90deg, #f8fafc 0 2px, #94a3b8 2px 4px, #e2e8f0 4px 6px)',
               boxShadow: pos === 'top-0'
                 ? 'inset 0 -2px 3px rgba(15,23,42,0.4)' : 'inset 0 2px 3px rgba(15,23,42,0.4)',
             }} />
      ))}

      {/* Dotted tear guide, so the swipe is discoverable. */}
      <div className="absolute inset-x-[6%] border-t border-dashed border-white/30"
           style={{ top: `${TEAR_Y}%` }} />

      <div className="absolute inset-x-0 top-[20%] bottom-[12%] flex flex-col items-center justify-between text-center">
        <p className="font-mono tracking-[0.3em] text-white/70" style={{ fontSize: '4.2cqw' }}>
          WAPC
        </p>
        <p className="font-display font-black leading-none mp-q"
           style={{ fontSize: '52cqw' }}>
          ?
        </p>
        <div>
          <p className="font-display font-bold text-white tracking-wide" style={{ fontSize: '7cqw' }}>
            MYSTERY SLAB
          </p>
          <p className="font-mono text-white/55 tracking-[0.18em] mt-[2%]" style={{ fontSize: '3.6cqw' }}>
            GRADED · SEALED
          </p>
        </div>
      </div>
    </div>
  )
}

export default function MysteryPackReveal({
  card, condition, grade, error, setName, onDone, onClose,
}: Props) {
  const [phase, setPhase] = useState<Phase>('sealed')
  const [drag, setDrag] = useState(0)
  const start = useRef<{ x: number; y: number; w: number } | null>(null)
  const reduce = useMemo(
    () => typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  )

  // The sequence. Each phase schedules the next; suspense waits for both a
  // minimum beat and the grade itself.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined
    if (phase === 'tearing') t = setTimeout(() => setPhase('rising'), reduce ? 0 : 520)
    if (phase === 'rising') t = setTimeout(() => setPhase('suspense'), reduce ? 0 : 1050)
    if (phase === 'suspense' && grade != null) {
      t = setTimeout(() => setPhase('stamped'), reduce ? 150 : 1500)
    }
    if (phase === 'stamped') t = setTimeout(() => setPhase('done'), reduce ? 0 : 1150)
    return () => { if (t) clearTimeout(t) }
  }, [phase, grade, reduce])

  // The slab whooshes up out of the pack; the grade thuds onto the label,
  // with sparkle on top for a 9 and the full works for a 10.
  useEffect(() => {
    if (phase === 'rising') playPackSound('rise')
    if (phase === 'stamped' && grade != null) {
      playPackSound('stamp')
      if (grade >= 9) playPackSound(grade === 10 ? 'secret' : 'holo', { delayMs: 120 })
    }
  }, [phase, grade])

  // Called from the tap, key or swipe itself, which is what lets the
  // browser start audio.
  function rip() {
    if (phase === 'sealed') { playPackSound('rip'); setDrag(0); setPhase('tearing') }
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (phase !== 'sealed') return
    const r = e.currentTarget.getBoundingClientRect()
    start.current = { x: e.clientX, y: e.clientY, w: r.width }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!start.current || phase !== 'sealed') return
    const p = Math.min(1, Math.abs(e.clientX - start.current.x) / start.current.w)
    setDrag(p)
    if (p > 0.55) { start.current = null; rip() }
  }
  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!start.current) return
    const moved = Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y)
    start.current = null
    // A tap rips it too; a half-hearted swipe springs back.
    if (moved < 8) rip(); else setDrag(0)
  }

  const shown = grade ?? 0
  const ink = grade != null ? gradeInk(grade) : '#e2e8f0'
  const torn = phase !== 'sealed'
  const out = phase === 'suspense' || phase === 'stamped' || phase === 'done'
  const landed = phase === 'stamped' || phase === 'done'

  // The slab starts tucked inside the pack, rises through the torn mouth,
  // then takes centre once the wrapper has fallen away.
  const slabTransform =
    phase === 'sealed' || phase === 'tearing' ? 'translateY(8%) scale(0.92)'
    : phase === 'rising' ? 'translateY(-62%) scale(0.92)'
    : 'translateY(0) scale(1.18)'

  return (
    <div
      className="fixed inset-0 z-[70] overflow-hidden flex flex-col items-center justify-center p-4 gap-5"
      // The tint sits on an opaque base. A tint-only gradient made the centre
      // - right where the slab is - mostly transparent, and the collection
      // underneath showed straight through the reveal.
      style={{
        background: landed
          ? `radial-gradient(circle at 50% 45%, ${ink}40 0%, transparent 62%), #020617`
          : 'radial-gradient(circle at 50% 45%, rgba(51,65,85,0.6) 0%, transparent 65%), #020617',
      }}
      role="dialog" aria-modal="true" aria-label={`Grade reveal for ${card.name}`}
    >
      {landed && shown >= 9 && <CardCelebration rarity={shown === 10 ? 'S' : 'H'} />}

      {/* The flash as the grade lands, in that grade's colour. */}
      {landed && !reduce && (
        <div className="absolute inset-0 pointer-events-none mp-flash" style={{ background: ink }} />
      )}

      <SoundToggle className="absolute top-3 left-3 z-10" />

      {phase !== 'done' && phase !== 'stamped' && !error && (
        <button
          onClick={() => { if (grade != null) setPhase('done'); else if (phase === 'sealed') rip() }}
          className="absolute top-4 right-4 text-xs text-white/45 hover:text-white/80"
        >
          Skip
        </button>
      )}

      <p className="relative text-white/80 font-display font-semibold text-sm h-5">
        {phase === 'sealed' ? 'Your grade is back from WAPC'
          : phase === 'tearing' || phase === 'rising' ? ''
          : phase === 'suspense' ? (grade == null ? 'Checking the label…' : 'And the grade is…')
          : ''}
      </p>

      <div
        className={`relative ${landed && !reduce ? 'mp-shake' : ''}`}
        style={{ width: 'min(62vw, 240px)', aspectRatio: '0.58', containerType: 'inline-size' }}
      >
        {/* Light pouring out of the mouth once it is open, and the rays
            behind the slab while it waits. */}
        {torn && (
          <>
            {/* Centred with a negative margin rather than a translate class:
                Tailwind 4's translate utilities use the separate `translate`
                property, which would stack on top of the keyframes' transform
                and push this off-centre. */}
            <div className="absolute pointer-events-none mp-rays"
                 style={{
                   left: '50%', marginLeft: '-85%',
                   top: out ? '-8%' : '-30%', width: '170%', aspectRatio: '1',
                   background: `conic-gradient(from 0deg, transparent 0deg, ${landed ? ink : '#fde68a'}44 12deg, transparent 24deg, transparent 45deg, ${landed ? ink : '#fde68a'}33 57deg, transparent 69deg, transparent 90deg, ${landed ? ink : '#fde68a'}44 102deg, transparent 114deg, transparent 135deg, ${landed ? ink : '#fde68a'}33 147deg, transparent 159deg, transparent 180deg, ${landed ? ink : '#fde68a'}44 192deg, transparent 204deg, transparent 225deg, ${landed ? ink : '#fde68a'}33 237deg, transparent 249deg, transparent 270deg, ${landed ? ink : '#fde68a'}44 282deg, transparent 294deg, transparent 315deg, ${landed ? ink : '#fde68a'}33 327deg, transparent 339deg)`,
                   maskImage: 'radial-gradient(circle, black 20%, transparent 68%)',
                   WebkitMaskImage: 'radial-gradient(circle, black 20%, transparent 68%)',
                   transition: 'top 900ms ease',
                 }} />
            {!out && (
              <div className="absolute pointer-events-none mp-burst"
                   style={{
                     left: '50%', marginLeft: '-60%',
                     top: `${TEAR_Y - 14}%`, width: '120%', height: '30%',
                     background: 'radial-gradient(ellipse at 50% 60%, rgba(255,251,235,0.95) 0%, rgba(253,230,138,0.55) 30%, transparent 70%)',
                   }} />
            )}
          </>
        )}

        {/* The slab. Behind the pack's front until it rises out of it. */}
        <div
          className="absolute left-[11%] right-[11%] top-[10%]"
          style={{
            transform: slabTransform,
            transition: reduce ? 'none' : phase === 'rising'
              ? 'transform 1000ms cubic-bezier(.2,.75,.25,1)'
              : 'transform 700ms cubic-bezier(.3,.8,.3,1.1)',
            zIndex: out ? 3 : 1,
          }}
        >
          <Slab
            condition={condition} grade={shown} src={card.image_url} alt={card.name}
            name={card.name} number={card.number} setCode={card.set_code} setName={setName}
            concealGrade={!landed}
            stamp={landed}
          />
        </div>

        {/* The pack: body and tear strip, the same face clipped along one
            ragged edge. */}
        <div
          className={`absolute inset-0 select-none touch-none ${phase === 'sealed' && !reduce ? 'mp-bob' : ''} ${
            phase === 'sealed' ? 'cursor-grab active:cursor-grabbing' : ''}`}
          style={{
            zIndex: 2,
            transform: out ? 'translateY(115%) rotate(8deg)' : undefined,
            opacity: out ? 0 : 1,
            transition: reduce ? 'none' : 'transform 700ms cubic-bezier(.5,0,.8,.4), opacity 600ms ease 150ms',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => { start.current = null; setDrag(0) }}
          role="button"
          tabIndex={phase === 'sealed' ? 0 : -1}
          aria-label="Rip the pack open"
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); rip() } }}
        >
          <div className="absolute inset-0 drop-shadow-[0_14px_24px_rgba(0,0,0,0.6)]"
               style={{ clipPath: torn ? BODY_CLIP : undefined }}>
            <PackFace />
          </div>

          {/* The strip that comes off. While sealed it covers the mouth and
              lifts a little as the swipe crosses it. */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              clipPath: STRIP_CLIP,
              transformOrigin: drag > 0 ? '0% 13%' : '50% 0%',
              transform: phase === 'sealed'
                ? `rotate(${-drag * 7}deg) translateY(${-drag * 3}%)`
                : 'translate(38%, -130%) rotate(-38deg)',
              opacity: phase === 'sealed' ? 1 : 0,
              transition: phase === 'sealed'
                ? (drag === 0 ? 'transform 220ms ease-out' : 'none')
                : reduce ? 'none' : 'transform 560ms cubic-bezier(.3,.6,.4,1), opacity 300ms ease 300ms',
              display: torn && phase !== 'tearing' && reduce ? 'none' : undefined,
            }}
          >
            <PackFace />
          </div>

          {/* The tear itself, racing along the edge under the swipe. */}
          {phase === 'sealed' && drag > 0 && (
            <div className="absolute left-0 h-[2px] pointer-events-none"
                 style={{
                   top: `${TEAR_Y}%`, width: `${drag * 100}%`,
                   background: 'linear-gradient(90deg, rgba(255,255,255,0), #fff)',
                   boxShadow: '0 0 8px 2px rgba(253,230,138,0.9)',
                 }} />
          )}
        </div>
      </div>

      {/* Instruction while sealed; the grade, spelled out, once it lands. */}
      <div className="relative text-center min-h-[5.5rem] flex flex-col items-center gap-2">
        {error ? (
          <>
            <p className="text-sm text-red-300">{error}</p>
            <button onClick={onClose} className="text-white/70 text-xs underline underline-offset-2">
              Close
            </button>
          </>
        ) : phase === 'sealed' ? (
          <>
            <p className="text-white/60 text-xs">Swipe across the top to rip it open</p>
            <button
              onClick={rip}
              className="rounded-xl border border-white/25 text-white/85 text-sm font-medium px-5 py-2 hover:bg-white/10 transition-colors"
            >
              Rip it open
            </button>
          </>
        ) : phase === 'done' && grade != null ? (
          <>
            <p className="font-display font-black tracking-wide mp-rise"
               style={{ color: ink, fontSize: '1.6rem', lineHeight: 1 }}>
              {GRADE_LABEL[grade] ?? 'GRADED'} {grade}
            </p>
            <p className="text-white/55 text-xs mp-rise" style={{ animationDelay: '80ms' }}>
              {card.name} · {setName}
            </p>
            <button
              onClick={onDone}
              className="mt-1 bg-signal text-white font-semibold rounded-xl px-6 py-2.5 text-sm mp-rise"
              style={{ animationDelay: '160ms' }}
            >
              Put it in the vault
            </button>
          </>
        ) : null}
      </div>

      <style>{`
        @keyframes mpFoil { 0% { background-position: 0% 50% } 100% { background-position: 200% 50% } }
        .mp-foil {
          background: linear-gradient(115deg,
            transparent 0%, #ff6ad5 8%, transparent 17%,
            transparent 24%, #94d0ff 32%, transparent 41%,
            transparent 50%, #7af0c8 58%, transparent 67%,
            transparent 74%, #ffe27a 82%, transparent 91%, transparent 100%);
          background-size: 300% 300%;
          animation: mpFoil 6s linear infinite;
        }
        .mp-q {
          background: linear-gradient(180deg, #fff7d6 0%, #fde68a 40%, #f59e0b 100%);
          -webkit-background-clip: text; background-clip: text; color: transparent;
          filter: drop-shadow(0 2px 10px rgba(253,230,138,0.45));
        }
        @keyframes mpBob { 0%,100% { transform: translateY(0) rotate(-1deg) } 50% { transform: translateY(-3%) rotate(1deg) } }
        .mp-bob { animation: mpBob 2.6s ease-in-out infinite; }
        @keyframes mpRays { to { transform: rotate(360deg) } }
        .mp-rays { animation: mpRays 14s linear infinite; }
        @keyframes mpBurst { 0% { opacity: 0; transform: scale(0.3) } 40% { opacity: 1 } 100% { opacity: 0.85; transform: scale(1.15) } }
        .mp-burst { animation: mpBurst 700ms ease-out both; }
        @keyframes mpFlash { 0% { opacity: 0.55 } 100% { opacity: 0 } }
        .mp-flash { animation: mpFlash 700ms ease-out both; }
        @keyframes mpShake {
          0%,100% { transform: translate(0,0) }
          15% { transform: translate(-6px, 3px) } 30% { transform: translate(5px,-4px) }
          45% { transform: translate(-4px,-2px) } 60% { transform: translate(3px, 3px) }
          80% { transform: translate(-1px, 1px) }
        }
        .mp-shake { animation: mpShake 420ms ease-out both; }
        @keyframes mpRise { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
        .mp-rise { animation: mpRise 380ms ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .mp-foil, .mp-bob, .mp-rays, .mp-burst, .mp-flash, .mp-shake, .mp-rise { animation: none !important; }
        }
      `}</style>
    </div>
  )
}
