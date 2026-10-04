'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmt } from '../vending/tokens'

export interface RewardStatus {
  amount: number
  period_start: string
  period_ends: string
  updated: boolean
  claimed: boolean
}

/** "3 days", "today" - how long is left to qualify. */
function daysLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now()
  const days = Math.ceil(ms / 86400000)
  if (days <= 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `in ${days} days`
}

/**
 * The fortnightly nudge to keep an interest check current.
 *
 * Claimed rather than granted: there is no cron here, and a member seeing
 * "you earned 15" is worth more than tokens appearing silently.
 */
export default function InterestReward({ status }: { status: RewardStatus }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [claimed, setClaimed] = useState(status.claimed)

  if (Number(status.amount) <= 0) return null

  async function claim() {
    setBusy(true); setNote(null)
    const supabase = createClient()
    const { data, error } = await supabase.rpc('claim_interest_reward')
    setBusy(false)
    const row = (Array.isArray(data) ? data[0] : data) as
      { ok: boolean; reason: string; amount: number } | null
    if (error || !row?.ok) {
      setNote(
        row?.reason === 'not_updated' ? 'Add or refresh something on your list first.'
        : row?.reason === 'already_claimed' ? 'Already collected this fortnight.'
        : 'Could not collect that just now.'
      )
      if (row?.reason === 'already_claimed') setClaimed(true)
      return
    }
    setClaimed(true)
    startTransition(() => router.refresh())
  }

  const amount = fmt(status.amount)

  return (
    <div className={`rounded-2xl border p-4 space-y-2 ${
      claimed ? 'bg-card border-card-border'
        : status.updated ? 'bg-signal/10 border-signal/40'
        : 'bg-card border-card-border'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display font-semibold text-sm">
            {claimed ? 'Collected this fortnight'
              : status.updated ? `${amount} tokens waiting`
              : `Earn ${amount} tokens`}
          </p>
          <p className="text-xs text-muted leading-snug mt-0.5">
            {claimed
              ? `Next one opens ${daysLeft(status.period_ends)}.`
              : status.updated
                ? 'Your check is up to date for this fortnight.'
                : `Add or refresh anything on your list, then collect. Resets ${daysLeft(status.period_ends)}.`}
          </p>
        </div>
        {!claimed && (
          <button
            onClick={claim}
            disabled={busy || !status.updated}
            className="shrink-0 rounded-xl bg-signal text-white text-sm font-semibold px-4 py-2 hover:bg-signal/90 transition-colors disabled:opacity-40"
          >
            {busy ? 'Collecting…' : 'Collect'}
          </button>
        )}
      </div>
      {note && <p className="text-xs text-amber-600">{note}</p>}
    </div>
  )
}
