'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmt } from '../vending/tokens'
import { normalize, type CornerState } from './state'
import Slots from './Slots'
import Blackjack from './Blackjack'
import Roulette from './Roulette'
import { CORNER_CSS } from './fx'
import { isMusicOn, isMuted, onMusic, onMuted, setHidden, setMusicOn, setMuted, sfx, unlock, wantMusic } from './sfx'

type Game = 'slots' | 'blackjack' | 'roulette'
const GAMES: [Game, string][] = [['slots', 'Slots'], ['blackjack', 'Blackjack'], ['roulette', 'Roulette']]

/**
 * The Game Corner. Read once a second while the page is in view
 * (game_corner_state): the row of slot machines and who's at them, the
 * blackjack tables, and the roulette table's clock and everyone's bets. The
 * rest of the app advances on reads too, so there's no live channel to keep
 * up; a round of roulette is settled, and a blackjack table moves on, with
 * whichever read comes first once the clock says so.
 */
export default function GameCorner({ admin = false }: { admin?: boolean }) {
  const router = useRouter()
  const [state, setState] = useState<CornerState | null>(null)
  const [failed, setFailed] = useState(false)
  const [game, setGame] = useState<Game>('slots')
  // Server time minus this device's: the roulette countdown runs on the server's clock.
  const [skew, setSkew] = useState(0)
  const busy = useRef(false)

  const read = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    try {
      const { data, error } = await createClient().rpc('game_corner_state')
      if (error || !data) { setFailed(true); return }
      const s = normalize(data as CornerState)
      setSkew(Date.parse(s.now) - Date.now())
      setState(s); setFailed(false)
    } finally { busy.current = false }
  }, [])

  useEffect(() => {
    read()
    const t = setInterval(() => { if (document.visibilityState === 'visible') read() }, 1000)
    return () => clearInterval(t)
  }, [read])

  // The header's token count is the server's; refreshed a moment after you play, not on every spin.
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const played = useCallback(() => {
    read()
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    refreshTimer.current = setTimeout(() => router.refresh(), 2500)
  }, [read, router])

  // Sound: off or on is remembered on this device; any tap wakes the audio (browsers allow it only then).
  const [muted, setMutedState] = useState(false)
  useEffect(() => { setMutedState(isMuted()); return onMuted(setMutedState) }, [])
  // The music: on while the Game Corner is on screen (from the first tap), paused while the page is out of sight.
  const [music, setMusicState] = useState(true)
  useEffect(() => {
    setMusicState(isMusicOn())
    const off = onMusic(setMusicState)
    wantMusic(true)
    const vis = () => setHidden(document.visibilityState !== 'visible')
    document.addEventListener('visibilitychange', vis)
    return () => { off(); wantMusic(false); document.removeEventListener('visibilitychange', vis) }
  }, [])

  return (
    <div className="space-y-4" onPointerDown={unlock}>
      <style>{CORNER_CSS}</style>
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Game Corner</h1>
          <p className="text-xs text-muted">Slots, blackjack and roulette, for tokens. Real casino odds: over time, the house wins.</p>
        </div>
        <div className="flex items-end gap-2 shrink-0">
          <button type="button" onClick={() => { unlock(); setMusicOn(!music) }}
            aria-pressed={music} aria-label={music ? 'Music on. Turn it off' : 'Music off. Turn it on'}
            className="grid place-items-center w-9 h-9 rounded-full border border-card-border bg-card text-muted hover:text-ink">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 18V5l11-2v13" />
              <circle cx="6.5" cy="18" r="2.5" fill="currentColor" stroke="none" />
              <circle cx="17.5" cy="16" r="2.5" fill="currentColor" stroke="none" />
              {!music && <path d="M3 3l18 18" />}
            </svg>
          </button>
          <button type="button" onClick={() => { unlock(); setMuted(!muted); if (muted) setTimeout(() => sfx.chip(), 30) }}
            aria-pressed={!muted} aria-label={muted ? 'Sound off. Turn it on' : 'Sound on. Turn it off'}
            className="grid place-items-center w-9 h-9 rounded-full border border-card-border bg-card text-muted hover:text-ink">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none" />
              {muted ? <path d="M17 9l5 6M22 9l-5 6" /> : <><path d="M16.5 8.5a5 5 0 0 1 0 7" /><path d="M19 6a8.5 8.5 0 0 1 0 12" /></>}
            </svg>
          </button>
          <div className="text-right pl-1">
            <div className="font-mono text-lg font-semibold tabular-nums">{state ? fmt(state.balance) : '…'}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted">tokens</div>
          </div>
        </div>
      </header>

      {failed && !state && <p className="text-sm text-muted">The Game Corner couldn’t be reached. It will try again in a moment.</p>}
      {state && !state.open && (admin ? (
        <p className="rounded-xl border border-signal bg-card px-3 py-2 text-sm">
          <b>Closed to members.</b> Only admins can see and play it for now. Open it in Admin → VVM → Game Corner.
        </p>
      ) : (
        <p className="rounded-xl border border-card-border bg-card px-3 py-2 text-sm">The Game Corner is closed for now. Bets are off until it opens again.</p>
      ))}

      <nav aria-label="Games" className="flex gap-1 p-1 rounded-xl bg-card border border-card-border">
        {GAMES.map(([g, label]) => (
          <button key={g} type="button" onClick={() => { if (g !== game) sfx.click(); setGame(g) }} aria-pressed={game === g}
            className={`flex-1 min-h-10 rounded-lg text-sm font-medium transition-colors ${game === g ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </nav>

      {!state ? (
        <div className="h-64 rounded-2xl bg-card border border-card-border animate-pulse" aria-hidden />
      ) : game === 'slots' ? (
        <Slots state={admin ? { ...state, open: true } : state} onPlayed={played} />
      ) : game === 'blackjack' ? (
        <Blackjack state={admin ? { ...state, open: true } : state} skew={skew} onPlayed={played} />
      ) : (
        <Roulette state={admin ? { ...state, open: true } : state} skew={skew} onPlayed={played} />
      )}
    </div>
  )
}
