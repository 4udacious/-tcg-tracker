'use client'

import { useMemo } from 'react'

/**
 * Celebration layer for a holo or secret rare pull.
 *
 * Built from plain DOM particles and CSS transforms rather than a canvas
 * library: a few dozen absolutely-positioned divs animate on the compositor
 * and cost nothing to ship, where a confetti dependency would be kilobytes
 * for one moment.
 *
 * Everything here is decorative, so it is fully disabled under
 * prefers-reduced-motion - the card keeps a static glow instead, and no
 * particles mount at all.
 */

const PALETTE: Record<'H' | 'S', string[]> = {
  // Holo: gold and warm white, matching the amber ring on the card.
  H: ['#fbbf24', '#f59e0b', '#fde68a', '#ffffff', '#fcd34d'],
  // Secret: the full rainbow, louder because it should be.
  S: ['#e879f9', '#a78bfa', '#22d3ee', '#fbbf24', '#f472b6', '#ffffff', '#34d399'],
}

interface Props {
  rarity: 'H' | 'S'
}

export default function CardCelebration({ rarity }: Props) {
  const isSecret = rarity === 'S'
  const colors = PALETTE[rarity]

  const pieces = useMemo(
    () =>
      Array.from({ length: isSecret ? 64 : 44 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.45,
        duration: 1.9 + Math.random() * 1.5,
        drift: (Math.random() * 2 - 1) * 140,
        spin: (Math.random() * 2 - 1) * 900,
        color: colors[i % colors.length],
        w: 5 + Math.random() * 7,
        h: 7 + Math.random() * 12,
        round: Math.random() > 0.72,
      })),
    [colors, isSecret]
  )

  return (
    <div className="vm-celebrate pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* Entry flash */}
      <div className={`vm-flash absolute inset-0 ${isSecret ? 'bg-fuchsia-300' : 'bg-amber-200'}`} />

      {/* Rotating light rays behind the card. Sized as a halo rather than a
          full-screen layer: at very large sizes only the convergence zone is
          on screen, which averages into a flat wash instead of reading as
          beams. */}
      <div className="vm-rays absolute left-1/2 top-1/2 h-[920px] w-[920px] -translate-x-1/2 -translate-y-1/2" />

      {/* Expanding shockwave ring */}
      <div className={`vm-ring absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 ${
        isSecret ? 'border-fuchsia-300' : 'border-amber-300'
      }`} />

      {/* Confetti */}
      {pieces.map((p) => (
        <span
          key={p.id}
          className="vm-piece absolute top-[-8%] block"
          style={{
            left: `${p.left}%`,
            width: `${p.w}px`,
            height: `${p.h}px`,
            background: p.color,
            borderRadius: p.round ? '9999px' : '2px',
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ['--drift' as string]: `${p.drift}px`,
            ['--spin' as string]: `${p.spin}deg`,
          }}
        />
      ))}

      <style>{`
        @keyframes vmFlash {
          0%   { opacity: 0.55; }
          100% { opacity: 0; }
        }
        @keyframes vmRays {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to   { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes vmRing {
          0%   { transform: translate(-50%, -50%) scale(0.2); opacity: 0.9; }
          100% { transform: translate(-50%, -50%) scale(3.4); opacity: 0; }
        }
        @keyframes vmFall {
          0%   { transform: translate(0, 0) rotate(0deg); opacity: 0; }
          8%   { opacity: 1; }
          100% { transform: translate(var(--drift), 115vh) rotate(var(--spin)); opacity: 0; }
        }

        .vm-flash { animation: vmFlash 700ms ease-out forwards; }
        .vm-ring  { animation: vmRing 900ms cubic-bezier(.2,.7,.3,1) forwards; }
        .vm-piece { animation-name: vmFall; animation-timing-function: cubic-bezier(.25,.6,.4,1); animation-fill-mode: forwards; }
        .vm-rays {
          animation: vmRays ${isSecret ? 14 : 20}s linear infinite;
          background: repeating-conic-gradient(
            from 0deg,
            ${isSecret ? 'rgba(232,121,249,0.55)' : 'rgba(251,191,36,0.5)'} 0deg 3.5deg,
            transparent 3.5deg 15deg
          );
          /* Pixel stops, not percentages: percentage stops resolve against
             the element's own (very large) size, which left no falloff
             anywhere on screen and flattened the rays into a colour wash.
             Hollow centre keeps the card unveiled. */
          -webkit-mask-image: radial-gradient(circle 460px at center,
            transparent 150px, rgba(0,0,0,0.95) 250px, transparent 440px);
          mask-image: radial-gradient(circle 460px at center,
            transparent 150px, rgba(0,0,0,0.95) 250px, transparent 440px);
        }

        /* Decorative only - drop the whole thing when motion is unwelcome. */
        @media (prefers-reduced-motion: reduce) {
          .vm-celebrate .vm-piece,
          .vm-celebrate .vm-ring,
          .vm-celebrate .vm-flash { display: none; }
          .vm-celebrate .vm-rays { animation: none; opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
