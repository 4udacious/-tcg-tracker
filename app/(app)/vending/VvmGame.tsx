'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { makeVvmApi, type VvmApi } from '@/lib/vending/gameBridge'
import LobbyChat from './LobbyChat'
import GameCornerBanner from '../game-corner/GameCornerBanner'

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
 * What shows while the machine loads: the game's own background, then (if it's taking a moment, so a quick load
 * doesn't flash it) the machine with its Poké Ball turning and packs shimmering on its screen. Fades away when done.
 */
function VvmLoading({ done }: { done: boolean }) {
  return (
    <div role="status" aria-live="polite" aria-label={done ? 'The VVM is ready' : 'Loading the VVM'}
      className={`absolute inset-0 grid place-items-center bg-[#eef1f6] transition-opacity duration-300 ${done ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      <style>{`
        @keyframes vvm-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @keyframes vvm-spin{to{transform:rotate(360deg)}}
        @keyframes vvm-shimmer{0%{background-position:-160px 0}100%{background-position:160px 0}}
        @keyframes vvm-bar{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}
        @media (prefers-reduced-motion: reduce){.vvm-motion{animation:none!important}}
      `}</style>
      <div className="flex flex-col items-center gap-4 vvm-motion" style={{ animation: 'vvm-in .35s ease-out .6s both' }}>
        {/* The machine: red, its screen of packs shimmering, the Poké Ball on top turning. */}
        <div className="relative pt-5">
          <svg viewBox="0 0 40 40" className="absolute left-1/2 top-0 -ml-5 w-10 h-10 vvm-motion" style={{ animation: 'vvm-spin 1.4s linear infinite' }} aria-hidden>
            <circle cx="20" cy="20" r="17" fill="#fff" stroke="#111827" strokeWidth="3" />
            <path d="M3 20a17 17 0 0 1 34 0z" fill="#ef4444" stroke="#111827" strokeWidth="3" />
            <line x1="3" y1="20" x2="37" y2="20" stroke="#111827" strokeWidth="3" />
            <circle cx="20" cy="20" r="5" fill="#fff" stroke="#111827" strokeWidth="3" />
          </svg>
          <div className="w-28 h-36 rounded-2xl p-2 shadow-lg" style={{ background: 'linear-gradient(180deg,#ef4444,#b91c1c)', boxShadow: '0 0 0 3px #fecaca, 0 10px 24px rgba(185,28,28,.35)' }}>
            <div className="h-24 rounded-lg bg-[#1f2937] p-1.5 grid grid-cols-3 gap-1">
              {Array.from({ length: 9 }, (_, i) => (
                <span key={i} className="rounded-[3px] vvm-motion" style={{
                  background: 'linear-gradient(90deg, #374151 0%, #6b7280 50%, #374151 100%)', backgroundSize: '160px 100%',
                  animation: `vvm-shimmer 1.3s linear ${(i % 3) * 0.12}s infinite`,
                }} />
              ))}
            </div>
            <div className="mt-1.5 h-4 rounded bg-yellow-400" />
          </div>
        </div>
        <div className="text-center">
          <p className="font-display font-semibold text-sm text-[#0E1726]">Stocking the VVM…</p>
          <div className="mt-2 h-1 w-40 overflow-hidden rounded-full bg-[#d6dbe4]" aria-hidden>
            <div className="h-full w-2/5 rounded-full bg-[#ef4444] vvm-motion" style={{ animation: 'vvm-bar 1.1s ease-in-out infinite' }} />
          </div>
        </div>
      </div>
    </div>
  )
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
export default function VvmGame({ userId, initialBuys, gameCorner = null, attract = [] }: {
  userId: string; initialBuys: RecentBuy[]; gameCorner?: 'open' | 'admins' | null
  attract?: string[]   // the idle screen's packs: the art of the sets stocked most recently (vending_attract_packs)
}) {
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

  // The machine loading: the frame's page (its code, then the pack art on the machine's screen) arrives in pieces, and
  // before its code runs it's the game's bare layout. A cover hides all that until the page has loaded, or 12 s at most.
  const [ready, setReady] = useState(false)
  const [covered, setCovered] = useState(true)
  const loaded = useCallback(() => {
    // (The frame's first, blank page loads too: only the game's counts.)
    try { if (frame.current?.contentWindow?.location.pathname.startsWith('/rpg/') && frame.current.contentDocument?.readyState === 'complete') setReady(true) } catch { setReady(true) }
  }, [])
  useEffect(() => {
    loaded()   // already loaded before this page came to life
    const t = setTimeout(() => setReady(true), 12000)
    return () => clearTimeout(t)
  }, [loaded])
  useEffect(() => { if (ready) { const t = setTimeout(() => setCovered(false), 350); return () => clearTimeout(t) } }, [ready])

  return (
    <div className="space-y-5">
      <div className="relative -mx-4 -mt-4">
        <iframe
          ref={frame}
          src={`/rpg/index.html?app=1&embed=1&u=${encodeURIComponent(userId)}${attract.length ? `&attract=${attract.join(',')}` : ''}`}
          title="The VVM"
          allow="autoplay; vibrate"
          onLoad={loaded}
          className="block w-full border-0 bg-[#eef1f6]"
          style={{ height: 'calc(100dvh - 56px - 64px - env(safe-area-inset-bottom))', touchAction: 'manipulation' }}
        />
        {covered && <VvmLoading done={ready} />}
      </div>

      {/* The Game Corner (v115, v116): slots, blackjack and roulette for tokens, beside the other members. Once it's open, or to admins. */}
      {gameCorner && <div className="mx-auto w-full max-w-sm"><GameCornerBanner adminsOnly={gameCorner === 'admins'} /></div>}

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
