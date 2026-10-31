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
export default function BattlesLiveClient({ wild, trainers, healPrice }: { wild: boolean; trainers: boolean; healPrice: number | string | null }) {
  const toast = useToast()
  const [live, setLive] = useState<Record<Kind, boolean>>({ wild, trainers })
  const [busy, setBusy] = useState<Kind | null>(null)
  // The Pokémon Center's price after the 3 free heals a day (v79; null before it).
  const [price, setPrice] = useState(healPrice == null ? '' : Number(healPrice).toFixed(2))
  const [saved, setSaved] = useState(price)
  const [savingPrice, setSavingPrice] = useState(false)

  async function savePrice() {
    const p = Number(price)
    if (!Number.isFinite(p) || p < 0 || p > 10) { toast.show('The heal price must be between 0 and 10 tokens.'); return }
    setSavingPrice(true)
    const { data, error } = await createClient().rpc('set_battle_heal_price', { p_price: p })
    setSavingPrice(false)
    if (error) { toast.show(`Couldn't change it: ${error.message}`); return }
    const next = Number(data ?? p).toFixed(2)
    setPrice(next); setSaved(next)
    toast.show(`A Pokémon Center heal after the free ones now costs ${next} tokens.`)
  }

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
        {healPrice != null && (
          <li className="bg-card border border-card-border rounded-2xl p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Pokémon Center heal price</p>
              <p className="text-xs text-muted">3 free heals a day per member, then this many tokens a heal.</p>
            </div>
            <form className="shrink-0 flex items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); savePrice() }}>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={10}
                step={0.05}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-20 bg-card border border-card-border rounded-lg px-2 py-1 text-sm text-right font-mono outline-none focus:border-signal"
                aria-label="Pokémon Center heal price in tokens"
              />
              <span className="text-xs text-muted">tokens</span>
              <button
                type="submit"
                disabled={savingPrice || price === saved}
                className="text-xs font-medium text-signal border border-signal/30 rounded-lg px-3 py-1 hover:bg-signal/10 transition-colors disabled:opacity-50"
              >
                Save
              </button>
            </form>
          </li>
        )}
      </ul>
    </section>
  )
}
