'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { fmt, num } from '../../vending/tokens'

export type GameCornerSettings = {
  is_open: boolean; min_bet: number | string; slots_max_bet: number | string; roulette_max_bet: number | string; blackjack_max_bet: number | string
  // The high-limit room (v117); missing before it.
  high_min_bet?: number | string; high_slots_max_bet?: number | string; high_roulette_max_bet?: number | string; high_blackjack_max_bet?: number | string
  // The background sound's house levels, percent (v119); missing before it.
  music_level?: number; ambience_level?: number
}

/**
 * The Game Corner (v115): open or closed, and its bets in tokens. The
 * smallest bet anywhere, the most on one slot spin, and the most a member can
 * have on one roulette spin, all bets together (set_game_corner_settings).
 * Blackjack's is for its tables (v116). The high-limit room's own limits
 * (v117), and the background sound's levels (v119).
 */
export default function GameCornerSettingsClient({ settings }: { settings: GameCornerSettings }) {
  const toast = useToast()
  const [open, setOpen] = useState(settings.is_open)
  const [min, setMin] = useState(String(fmt(settings.min_bet)))
  const [slots, setSlots] = useState(String(fmt(settings.slots_max_bet)))
  const [roulette, setRoulette] = useState(String(fmt(settings.roulette_max_bet)))
  const [blackjack, setBlackjack] = useState(String(fmt(settings.blackjack_max_bet)))
  const [saving, setSaving] = useState(false)
  const hasHigh = settings.high_min_bet != null
  const [hMin, setHMin] = useState(String(fmt(settings.high_min_bet ?? 1)))
  const [hSlots, setHSlots] = useState(String(fmt(settings.high_slots_max_bet ?? 10)))
  const [hRoulette, setHRoulette] = useState(String(fmt(settings.high_roulette_max_bet ?? 25)))
  const [hBlackjack, setHBlackjack] = useState(String(fmt(settings.high_blackjack_max_bet ?? 20)))

  // The sound levels save themselves half a second after you stop moving a dial; anyone in the Game Corner hears the
  // change within a second of that.
  const hasSound = settings.music_level != null
  const [musicLevel, setMusicLevel] = useState(settings.music_level ?? 100)
  const [ambienceLevel, setAmbienceLevel] = useState(settings.ambience_level ?? 100)
  const [soundNote, setSoundNote] = useState<string | null>(null)
  const soundTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    if (soundTimer.current) clearTimeout(soundTimer.current)
    setSoundNote('…')
    soundTimer.current = setTimeout(async () => {
      const { error } = await createClient().rpc('set_game_corner_sound', { p_music: musicLevel, p_ambience: ambienceLevel })
      setSoundNote(error ? `Couldn't save: ${error.message}` : 'Saved')
    }, 500)
    return () => { if (soundTimer.current) clearTimeout(soundTimer.current) }
  }, [musicLevel, ambienceLevel])

  async function saveHigh() {
    const vals = [hMin, hSlots, hRoulette, hBlackjack].map(num)
    if (vals.some((v) => !(v > 0))) { toast.show('Every amount needs to be more than 0.'); return }
    if (vals.slice(1).some((v) => v < vals[0])) { toast.show('No limit can be under the smallest bet.'); return }
    setSaving(true)
    const { error } = await createClient().rpc('set_game_corner_high_limits', {
      p_min_bet: vals[0], p_slots_max: vals[1], p_roulette_max: vals[2], p_blackjack_max: vals[3],
    })
    setSaving(false)
    toast.show(error ? `Couldn't save: ${error.message}` : 'High-limit room saved.')
  }

  async function save(nextOpen = open) {
    const toggled = nextOpen !== open
    const vals = [min, slots, roulette, blackjack].map(num)
    if (vals.some((v) => !(v > 0))) { toast.show('Every amount needs to be more than 0.'); return }
    if (vals.slice(1).some((v) => v < vals[0])) { toast.show('No limit can be under the smallest bet.'); return }
    setSaving(true)
    const { error } = await createClient().rpc('set_game_corner_settings', {
      p_open: nextOpen, p_min_bet: vals[0], p_slots_max: vals[1], p_roulette_max: vals[2], p_blackjack_max: vals[3],
    })
    setSaving(false)
    if (error) { toast.show(`Couldn't save: ${error.message}`); return }
    setOpen(nextOpen)
    toast.show(!toggled ? 'Game Corner saved.' : nextOpen ? 'The Game Corner is open to members.' : 'The Game Corner is closed: hidden from members.')
  }

  const field = (label: string, value: string, set: (v: string) => void, hint: string) => (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <span className="block text-xs text-muted">{hint}</span>
      <input type="number" inputMode="decimal" min="0.01" step="0.01" value={value} onChange={(e) => set(e.target.value)}
        className="mt-1 w-32 h-10 px-3 rounded-lg border border-card-border bg-card font-mono" />
    </label>
  )

  return (
    <section className="space-y-4 rounded-2xl border border-card-border bg-card p-4 max-w-lg">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-semibold">Game Corner</h2>
          <p className="text-xs text-muted">Slots, blackjack and roulette at real casino odds (slots return 95%, roulette single-zero, blackjack 3 to 2 with the dealer standing on 17). Bets in tokens.</p>
          <p className="text-xs text-muted mt-1">{open ? 'Open: members see it on the VVM page and can play.' : 'Closed: hidden from members. Admins still see it, and can play to try it out.'}</p>
        </div>
        <button type="button" onClick={() => save(!open)} disabled={saving}
          className={`shrink-0 h-9 px-3 rounded-lg text-sm font-medium ${open ? 'bg-emerald-600 text-white' : 'border border-card-border'}`}>
          {open ? 'Open' : 'Closed'}
        </button>
      </div>
      {field('Smallest bet', min, setMin, 'On any game.')}
      {field('Slots: most per spin', slots, setSlots, 'One spin of one machine.')}
      {field('Roulette: most per spin', roulette, setRoulette, "A member's bets on one spin, all together.")}
      {field('Blackjack: most per hand', blackjack, setBlackjack, 'The bet on one hand. Doubling down or splitting can add as much again.')}
      <button type="button" onClick={() => save()} disabled={saving} className="h-10 px-4 rounded-lg bg-ink text-white text-sm font-medium disabled:opacity-50">
        {saving ? 'Saving…' : 'Save'}
      </button>

      {hasHigh && (
        <div className="space-y-4 border-t border-card-border pt-4">
          <div>
            <h3 className="font-display font-semibold">High-limit room</h3>
            <p className="text-xs text-muted">Four slot machines (9 to 12), a second roulette wheel and a fourth blackjack table: the same games and odds, with their own smallest bet and limits.</p>
          </div>
          {field('Smallest bet', hMin, setHMin, 'On any high-limit game. A slot spin needs it in whole cents across five lines (a multiple of 0.05).')}
          {field('Slots: most per spin', hSlots, setHSlots, 'One spin of a high-limit machine.')}
          {field('Roulette: most per spin', hRoulette, setHRoulette, "A member's bets on one spin of the high-limit wheel, all together.")}
          {field('Blackjack: most per hand', hBlackjack, setHBlackjack, 'The bet on one hand at the high-limit table. Doubling down or splitting can add as much again.')}
          <button type="button" onClick={saveHigh} disabled={saving} className="h-10 px-4 rounded-lg bg-ink text-white text-sm font-medium disabled:opacity-50">
            {saving ? 'Saving…' : 'Save high-limit room'}
          </button>
        </div>
      )}

      {hasSound && (
        <div className="space-y-4 border-t border-card-border pt-4">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-display font-semibold">Sound</h3>
            <span className="text-xs text-muted" aria-live="polite">{soundNote}</span>
          </div>
          <p className="text-xs text-muted -mt-3">How loud the background is for everyone in the Game Corner: 100% is the level it plays at now. Players can still switch either off for themselves.</p>
          {([['Music', 'The theme over the PA.', musicLevel, setMusicLevel], ['Casino ambience', 'The slots floor and the crowd.', ambienceLevel, setAmbienceLevel]] as const).map(([label, hint, value, set]) => (
            <label key={label} className="block">
              <span className="flex items-baseline justify-between">
                <span className="text-sm font-medium">{label}</span>
                <span className="font-mono text-sm tabular-nums">{value}%</span>
              </span>
              <span className="block text-xs text-muted">{hint}</span>
              <input type="range" min={0} max={200} step={5} value={value} onChange={(e) => set(Number(e.target.value))}
                aria-label={`${label} level`} className="mt-2 w-full accent-[var(--signal)]" />
              <span className="flex justify-between text-[10px] text-muted"><span>Off</span><span>100%</span><span>200%</span></span>
            </label>
          ))}
        </div>
      )}
    </section>
  )
}
