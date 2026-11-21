'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { fmt, num } from '../../vending/tokens'

export type GameCornerSettings = { is_open: boolean; min_bet: number | string; slots_max_bet: number | string; roulette_max_bet: number | string; blackjack_max_bet: number | string }

/**
 * The Game Corner (v115): open or closed, and its bets in tokens. The
 * smallest bet anywhere, the most on one slot spin, and the most a member can
 * have on one roulette spin, all bets together (set_game_corner_settings).
 * Blackjack's is for its tables (part 2).
 */
export default function GameCornerSettingsClient({ settings }: { settings: GameCornerSettings }) {
  const toast = useToast()
  const [open, setOpen] = useState(settings.is_open)
  const [min, setMin] = useState(String(fmt(settings.min_bet)))
  const [slots, setSlots] = useState(String(fmt(settings.slots_max_bet)))
  const [roulette, setRoulette] = useState(String(fmt(settings.roulette_max_bet)))
  const [blackjack, setBlackjack] = useState(String(fmt(settings.blackjack_max_bet)))
  const [saving, setSaving] = useState(false)

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
          <p className="text-xs text-muted">Slots and roulette at real casino odds (slots return 95%, roulette single-zero). Bets in tokens.</p>
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
      {field('Blackjack: most per hand', blackjack, setBlackjack, 'For the blackjack tables, when they open.')}
      <button type="button" onClick={() => save()} disabled={saving} className="h-10 px-4 rounded-lg bg-ink text-white text-sm font-medium disabled:opacity-50">
        {saving ? 'Saving…' : 'Save'}
      </button>
    </section>
  )
}
