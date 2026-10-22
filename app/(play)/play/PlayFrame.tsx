'use client'

import { useRef } from 'react'
import FullScreenShell from '@/components/FullScreenShell'

/**
 * The battle game, full screen. It's a self-contained page (public/rpg,
 * built from the battle mockup by its build-web.mjs) in a same-origin frame:
 * it reads the app's Settings itself and keeps one save per account, keyed by
 * the user id passed here. Exiting saves first.
 */
export default function PlayFrame({ userId }: { userId: string }) {
  const frame = useRef<HTMLIFrameElement>(null)
  return (
    <FullScreenShell title="Battle" exitHref="/vending"
      onLeave={() => (frame.current?.contentWindow as (Window & { __saveNow?: () => void }) | null)?.__saveNow?.()}>
      <iframe
        ref={frame}
        src={`/rpg/index.html?app=1&u=${encodeURIComponent(userId)}`}
        title="Battle"
        allow="autoplay; vibrate"
        className="w-full h-full border-0 bg-[#eef1f6]"
      />
    </FullScreenShell>
  )
}
