'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'

/**
 * The battle game's master switch (vending_settings.battle_rewards_open,
 * set through set_battles_live). Off, members get the game as the vending
 * machine only: no encounters and no battle rewards. Admins always have
 * battles, so they can be tested before going live.
 */
export default function BattlesLiveClient({ live: initial }: { live: boolean }) {
  const toast = useToast()
  const [live, setLive] = useState(initial)
  const [busy, setBusy] = useState(false)

  async function flip(next: boolean) {
    setBusy(true)
    const { error } = await createClient().rpc('set_battles_live', { p_on: next })
    setBusy(false)
    if (error) { toast.show(`Couldn't change it: ${error.message}`); return }
    setLive(next)
    toast.show(next ? 'Battles are live for members.' : 'Battles are off for members.')
  }

  return (
    <section className="space-y-2">
      <div className="space-y-1">
        <h2 className="font-display font-semibold text-base">Battle game</h2>
        <p className="text-xs text-muted leading-snug">
          While battles are off, members who use the game get only the vending machine: no wild
          Pokémon or trainers, no battle switch, and no packs or tokens from battles. Admins
          always have battles, for testing.
        </p>
      </div>
      <div className={`bg-card border rounded-2xl p-4 flex items-center justify-between gap-3 ${live ? 'border-signal/50' : 'border-card-border'}`}>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Battles live for members</p>
          <p className="text-xs text-muted">{live ? 'On: members can battle and earn battle rewards.' : 'Off: members get the machine only.'}</p>
        </div>
        <label className="shrink-0 flex items-center gap-1.5 text-xs font-medium cursor-pointer select-none">
          <input
            type="checkbox"
            checked={live}
            disabled={busy}
            onChange={(e) => flip(e.target.checked)}
            className="w-4 h-4 accent-signal"
            aria-label="Battles live for members"
          />
          {live ? 'Live' : 'Off'}
        </label>
      </div>
    </section>
  )
}
