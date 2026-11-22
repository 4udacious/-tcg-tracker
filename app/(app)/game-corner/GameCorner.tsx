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
import { isMusicOn, isMuted, onMusic, onMuted, setHidden, setMusicOn, setMuted, sfx, unlock, wantSound } from './sfx'
import { isAmbienceOn, onAmbience, setAmbienceOn } from './ambience'

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

  // Sound, in three parts each with its own switch (remembered on this device): your game's sounds, the music over
  // the PA, and the casino around you. The music and the casino play while the Game Corner is on screen (from the
  // first tap: browsers allow sound only then), and pause while the page is out of sight.
  const [muted, setMutedState] = useState(false)
  const [music, setMusicState] = useState(true)
  const [ambience, setAmbienceState] = useState(true)
  const [soundMenu, setSoundMenu] = useState(false)
  useEffect(() => {
    setMutedState(isMuted()); setMusicState(isMusicOn()); setAmbienceState(isAmbienceOn())
    const offs = [onMuted(setMutedState), onMusic(setMusicState), onAmbience(setAmbienceState)]
    wantSound(true)
    const vis = () => setHidden(document.visibilityState !== 'visible')
    document.addEventListener('visibilitychange', vis)
    return () => { offs.forEach((f) => f()); wantSound(false); document.removeEventListener('visibilitychange', vis) }
  }, [])
  const switches: [string, string, boolean, () => void][] = [
    ['Game sounds', 'Your spins, cards and wins', !muted, () => { setMuted(!muted); if (muted) setTimeout(() => sfx.chip(), 30) }],
    ['Music', 'The theme, over the PA', music, () => setMusicOn(!music)],
    ['Casino ambience', 'The crowd and the floor', ambience, () => setAmbienceOn(!ambience)],
  ]
  const silent = muted && !music && !ambience

  return (
    <div className="space-y-4" onPointerDown={unlock}>
      <style>{CORNER_CSS}</style>
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Game Corner</h1>
          <p className="text-xs text-muted">Slots, blackjack and roulette, for tokens. Real casino odds: over time, the house wins.</p>
        </div>
        <div className="flex items-end gap-2 shrink-0">
          <div className="relative">
            <button type="button" onClick={() => { unlock(); setSoundMenu((v) => !v) }} aria-expanded={soundMenu} aria-haspopup="dialog" aria-label="Sound"
              className={`grid place-items-center w-9 h-9 rounded-full border bg-card hover:text-ink ${soundMenu ? 'border-ink text-ink' : 'border-card-border text-muted'}`}>
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none" />
                {silent ? <path d="M17 9l5 6M22 9l-5 6" /> : <><path d="M16.5 8.5a5 5 0 0 1 0 7" /><path d="M19 6a8.5 8.5 0 0 1 0 12" /></>}
              </svg>
            </button>
            {soundMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setSoundMenu(false)} aria-hidden />
                <div role="dialog" aria-label="Sound" className="absolute right-0 top-11 z-40 w-64 rounded-xl border border-card-border bg-card p-1.5 shadow-xl">
                  {switches.map(([label, hint, on, flip]) => (
                    <button key={label} type="button" role="switch" aria-checked={on} onClick={flip}
                      className="w-full flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-paper">
                      <span>
                        <span className="block text-sm font-medium">{label}</span>
                        <span className="block text-[11px] text-muted">{hint}</span>
                      </span>
                      <span className={`relative shrink-0 w-9 h-5 rounded-full transition-colors ${on ? 'bg-signal' : 'bg-card-border'}`} aria-hidden>
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
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
