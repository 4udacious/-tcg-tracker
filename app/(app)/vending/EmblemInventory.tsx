'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ButtonLink } from '@/components/ui/Button'
import BattleEmblem, { type BattleEmblemData } from './BattleEmblem'

/**
 * The Champion's Emblem in your Collection: where it lives once earned, until
 * you choose to stand it on a shelf of your Showcase (and where it goes back to
 * when you take it down).
 */
export default function EmblemInventory({ emblem: initial }: { emblem: BattleEmblemData }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [emblem, setEmblem] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const shown = emblem.showcase_slot != null

  async function takeDown() {
    setBusy(true); setNote(null)
    const { error } = await createClient().rpc('clear_showcase_emblem')
    setBusy(false)
    if (error) { setNote('Could not take it down. Try again.'); return }
    setEmblem({ ...emblem, showcase_slot: null })
    startTransition(() => router.refresh())
  }

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display font-semibold text-base">Champion&apos;s Emblem</h2>
        <span className="font-mono text-[10px] text-muted">{shown ? `on display · shelf slot ${emblem.showcase_slot! + 1}` : 'in your collection'}</span>
      </div>
      <div className="bg-card border border-amber-400/40 rounded-2xl p-3 flex items-center gap-3">
        <BattleEmblem emblem={emblem} className="!w-24 shrink-0" />
        <div className="min-w-0 space-y-2">
          <p className="text-xs text-muted leading-snug">
            For beating the Kanto Elite Four, Red and Alex, with your Hall of Fame team.{' '}
            {shown ? 'Everyone who visits your profile can see it on your shelf.' : 'It stays here until you put it on a shelf of your Showcase.'}
          </p>
          {note && <p className="text-xs text-red-500">{note}</p>}
          {shown ? (
            <button
              onClick={takeDown}
              disabled={busy}
              className="text-xs font-medium border border-card-border rounded-lg px-3 py-1.5 hover:bg-paper transition-colors disabled:opacity-40"
            >
              {busy ? 'Taking it down…' : 'Take it off the shelf'}
            </button>
          ) : (
            <ButtonLink href="/showcase" size="sm">Put it in your Showcase</ButtonLink>
          )}
        </div>
      </div>
    </section>
  )
}
