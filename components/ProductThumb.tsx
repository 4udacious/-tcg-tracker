'use client'

import { useState } from 'react'

interface Props {
  src: string | null | undefined
  alt?: string
  /** Tailwind size classes, e.g. "w-10 h-10". */
  className?: string
}

/**
 * Square product photo on a white tile (retail photos are shot on white, so
 * this reads cleanly in both themes). Falls back to a neutral box icon when a
 * product has no image or the image fails to load.
 */
export default function ProductThumb({ src, alt = '', className = 'w-10 h-10' }: Props) {
  const [failed, setFailed] = useState(false)
  const showImage = src && !failed

  return (
    <div
      className={`${className} shrink-0 rounded-lg border border-card-border bg-white overflow-hidden flex items-center justify-center`}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="w-full h-full object-contain"
        />
      ) : (
        <svg className="w-1/2 h-1/2 text-muted/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
        </svg>
      )}
    </div>
  )
}
