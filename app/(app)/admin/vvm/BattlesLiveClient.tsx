'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'

type Kind = 'wild' | 'trainers'

const LABEL: Record<Kind, { title: string; on: string; off: string }> = {
  wild: {
    title: 'Wild Pokémon live for members',
    on: 'On: wild Pokémon can jump out when members tap.',
    off: 'Off: no wild Pokémon for members.',
  },
  trainers: {
    title: 'Trainer battles live for members',
    on: 'On: scalpers, 2v2s, gyms and the Elite Four, with their pack and token rewards.',
    off: 'Off: no trainer battles, and no battle packs or tokens, for members.',
  },
}

/**
 * The battle game's switches (set_battle_mode, v59): wild Pokémon and trainer
 * battles go live for members separately. With both off, members get the game
 * as the vending machine only. Admins always have both, for testing.
 */
export default function BattlesLiveClient({ wild, trainers }: { wild: boolean; trainers: boolean }) {
  const toast = useToast()
  const [live, setLive] = useState<Record<Kind, boolean>>({ wild, trainers })
  const [busy, setBusy] = useState<Kind | null>(null)

  async function flip(kind: Kind, next: boolean) {
    setBusy(kind)
    const { error } = await createClient().rpc('set_battle_mode', { p_kind: kind, p_on: next })
    setBusy(null)
    if (error) { toast.show(`Couldn't change it: ${error.message}`); return }
    setLive((l) => ({ ...l, [kind]: next }))
    toast.show(`${kind === 'wild' ? 'Wild Pokémon' : 'Trainer battles'} ${next ? 'are live' : 'are off'} for members.`)
  }

  return (
    <section className="space-y-2">
      <div className="space-y-1">
        <h2 className="font-display font-semibold text-base">Battle game</h2>
        <p className="text-xs text-muted leading-snug">
          With both off, members who use the game get only the vending machine. Each one on
          lets members meet that kind of battle (and turn it off for themselves in the game).
          Admins always have both, for testing.
        </p>
      </div>
      <ul className="space-y-2">
        {(['wild', 'trainers'] as Kind[]).map((k) => (
          <li key={k} className={`bg-card border rounded-2xl p-4 flex items-center justify-between gap-3 ${live[k] ? 'border-signal/50' : 'border-card-border'}`}>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{LABEL[k].title}</p>
              <p className="text-xs text-muted">{live[k] ? LABEL[k].on : LABEL[k].off}</p>
            </div>
            <label className="shrink-0 flex items-center gap-1.5 text-xs font-medium cursor-pointer select-none">
              <input
                type="checkbox"
                checked={live[k]}
                disabled={busy === k}
                onChange={(e) => flip(k, e.target.checked)}
                className="w-4 h-4 accent-signal"
                aria-label={LABEL[k].title}
              />
              {live[k] ? 'Live' : 'Off'}
            </label>
          </li>
        ))}
      </ul>
    </section>
  )
}
