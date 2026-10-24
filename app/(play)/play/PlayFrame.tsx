'use client'

import { useEffect, useRef } from 'react'
import FullScreenShell from '@/components/FullScreenShell'
import { makeVvmApi, type VvmApi } from '@/lib/vending/gameBridge'

type GameWindow = Window & { __saveNow?: () => void }

/**
 * The battle game, full screen. It's a self-contained page (public/rpg) in a
 * same-origin frame: it reads the app's Settings itself and keeps one save
 * per account, keyed by the user id passed here. It is the VVM too: it
 * reaches the real machine (stock, checkout, your packs and tokens) through
 * `__vvmApi`, set on this window for the frame to call. Exiting saves first
 * and gives up the machine if the game was holding it.
 */
export default function PlayFrame({ userId }: { userId: string }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const api = useRef<VvmApi | null>(null)

  useEffect(() => {
    const w = window as Window & { __vvmApi?: VvmApi }
    api.current = makeVvmApi(userId)
    w.__vvmApi = api.current
    const leave = () => { api.current?.release() }
    window.addEventListener('pagehide', leave)
    return () => { window.removeEventListener('pagehide', leave); leave(); delete w.__vvmApi }
  }, [userId])

  return (
    <FullScreenShell title="Battle" exitHref="/vending"
      onLeave={() => (frame.current?.contentWindow as GameWindow | null)?.__saveNow?.()}>
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
