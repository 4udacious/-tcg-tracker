'use client'

import { setPackSoundsMuted, usePackSoundsMuted } from './packSounds'

/** The speaker in the corner of a reveal. Remembered per browser. */
export default function SoundToggle({ className = '' }: { className?: string }) {
  const muted = usePackSoundsMuted()
  return (
    <button
      onClick={(e) => { e.stopPropagation(); setPackSoundsMuted(!muted) }}
      className={`p-2 rounded-full text-white/50 hover:text-white/90 hover:bg-white/10 transition-colors ${className}`}
      aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
      aria-pressed={!muted}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5L6 9H3v6h3l5 4V5z" />
        {muted ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 9l5 6M21 9l-5 6" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" />
        )}
      </svg>
    </button>
  )
}
