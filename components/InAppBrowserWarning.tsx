'use client'

import { useEffect, useState } from 'react'

// Markers for embedded in-app browsers where OAuth commonly breaks.
// '; wv)' is the Android System WebView token (Discord, Instagram,
// Messenger, etc. all use it); the rest are app-specific tokens.
const IN_APP_MARKERS = [
  '; wv)',
  'Instagram',
  'FBAN',
  'FBAV',
  'FB_IAB',
  'Messenger',
  'Snapchat',
  'musical_ly',
  'BytedanceWebview',
  ' Line/',
  'Discord',
]

export default function InAppBrowserWarning() {
  const [inApp, setInApp] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent
    if (IN_APP_MARKERS.some((m) => ua.includes(m))) setInApp(true)
  }, [])

  if (!inApp) return null

  return (
    <div className="bg-[#5865F2]/10 border border-[#5865F2]/40 rounded-2xl p-4 text-left space-y-1">
      <p className="text-white font-semibold text-sm">
        Open in your browser to sign in
      </p>
      <p className="text-white/60 text-xs leading-relaxed">
        It looks like you&apos;re viewing this inside another app (like Discord).
        Sign-in usually fails here. Tap the <span className="text-white/90 font-medium">⋯</span> menu
        and choose <span className="text-white/90 font-medium">Open in Browser</span>, or open{' '}
        <span className="text-white/90 font-medium">www.wapc.us</span> in Chrome or Safari.
      </p>
    </div>
  )
}
