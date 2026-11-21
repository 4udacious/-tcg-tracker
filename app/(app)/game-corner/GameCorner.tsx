'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmt } from '../vending/tokens'
import { normalize, type CornerState } from './state'
import Slots from './Slots'
import Blackjack from './Blackjack'
import Roulette from './Roulette'

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

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Game Corner</h1>
          <p className="text-xs text-muted">Slots, blackjack and roulette, for tokens. Real casino odds: over time, the house wins.</p>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono text-lg font-semibold tabular-nums">{state ? fmt(state.balance) : '…'}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted">tokens</div>
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
          <button key={g} type="button" onClick={() => setGame(g)} aria-pressed={game === g}
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
