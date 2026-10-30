'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { makeVvmApi, type VvmApi } from '@/lib/vending/gameBridge'
import LobbyChat from './LobbyChat'

type GameWindow = Window & { __saveNow?: () => void }

export interface RecentBuy {
  buyer: string
  icon_file: string | null
  packs: number
  sets: string
  bought_at: string
  /** 'buy', or a stuck pack (v66): 'jammed' when one jams on them, 'freed' when one drops for them. */
  kind?: 'buy' | 'jammed' | 'freed'
}

function agoLabel(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

/**
 * The VVM tab: the battle game's vending machine (public/rpg, in a
 * same-origin frame), with the lobby chat and recent buys underneath.
 *
 * The game is the machine: it reaches the real stock, checkout, packs and
 * tokens through `__vvmApi` (lib/vending/gameBridge.ts), set on this window
 * for the frame to call. Each member's WILD / TRAINERS switches on the
 * machine's screen turn battles off, leaving just the machine. The frame
 * fills the screen between the header and the tab bar, so the game's sheets
 * (Party, Bag, Box) open where you can see them.
 *
 * Leaving the tab saves the game and gives up the machine if you held it.
 */
export default function VvmGame({ userId, initialBuys }: { userId: string; initialBuys: RecentBuy[] }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const api = useRef<VvmApi | null>(null)
  const [buys, setBuys] = useState(initialBuys)
  const [watching, setWatching] = useState(0)

  useEffect(() => {
    const w = window as Window & { __vvmApi?: VvmApi }
    api.current = makeVvmApi(userId)
    w.__vvmApi = api.current
    const leave = () => {
      ;(frame.current?.contentWindow as GameWindow | null)?.__saveNow?.()
      api.current?.release()
      createClient().rpc('vending_unwatch')
    }
    window.addEventListener('pagehide', leave)
    return () => { window.removeEventListener('pagehide', leave); leave(); delete w.__vvmApi }
  }, [userId])

  // Presence and recent buys: a plain poll, like the rest of the app.
  const poll = useCallback(async () => {
    const supabase = createClient()
    const [{ data: w }, { data: b }] = await Promise.all([
      supabase.rpc('vending_ping'),
      supabase.rpc('vending_recent_buys', { p_limit: 6 }),
    ])
    setWatching(((w as { watcher_id: string }[] | null) ?? []).filter((x) => x.watcher_id !== userId).length)
    if (b) setBuys(b as RecentBuy[])
  }, [userId])

  useEffect(() => {
    poll()
    const t = setInterval(() => { if (document.visibilityState === 'visible') poll() }, 5000)
    return () => clearInterval(t)
  }, [poll])

  return (
    <div className="space-y-5">
      <div className="-mx-4 -mt-4">
        <iframe
          ref={frame}
          src={`/rpg/index.html?app=1&embed=1&u=${encodeURIComponent(userId)}`}
          title="The VVM"
          allow="autoplay; vibrate"
          className="block w-full border-0 bg-[#eef1f6]"
          style={{ height: 'calc(100dvh - 56px - 64px - env(safe-area-inset-bottom))' }}
        />
      </div>

      <div className="mx-auto w-full max-w-sm">
        <LobbyChat watching={watching} />
      </div>

      <section className="mx-auto w-full max-w-sm space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display font-semibold text-sm">Recent buys</h2>
          <span className="font-mono text-[11px] text-muted">1 token = 1 pack</span>
        </div>
        {buys.length === 0 ? (
          <p className="text-xs text-muted">Nothing bought yet. Be the first.</p>
        ) : (
          <ul className="space-y-1.5">
            {buys.map((b, i) => (
              <li key={`${b.bought_at}-${b.buyer}-${i}`} className="bg-card border border-card-border rounded-xl px-3 py-2 flex items-center gap-2.5">
                {b.icon_file ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/Trainers/${b.icon_file}`} alt="" className="w-6 h-6 rounded-full object-contain bg-paper shrink-0" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-ink/10 flex items-center justify-center text-[11px] font-bold text-muted shrink-0">
                    {b.buyer.charAt(0).toUpperCase()}
                  </div>
                )}
                <p className="text-xs min-w-0 flex-1 truncate">
                  {b.kind === 'jammed' ? (
                    <><span className="text-muted">A {b.sets} pack jammed on </span><span className="font-medium">{b.buyer}</span><span className="text-muted">. It&apos;s still in there.</span></>
                  ) : b.kind === 'freed' ? (
                    <><span className="text-muted">A stuck {b.sets} pack dropped for </span><span className="font-medium">{b.buyer}</span><span className="font-semibold text-signal">. Free!</span></>
                  ) : (
                    <><span className="font-medium">{b.buyer}</span><span className="text-muted"> took </span><span className="font-mono font-semibold text-signal">{b.packs}</span><span className="text-muted"> from {b.sets}</span></>
                  )}
                </p>
                <span className="font-mono text-[11px] text-muted shrink-0">{agoLabel(b.bought_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
