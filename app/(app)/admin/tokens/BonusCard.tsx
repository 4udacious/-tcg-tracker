'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'

export type BonusMember = { user_id: string; username: string; display_name: string | null; balance: number }

const QUICK = [1, 2, 5, 10, 25]

/**
 * A one-off token bonus, to whoever you choose (or everyone), whenever you
 * like. Each one goes through adjust_tokens, so it's admin-checked in the
 * database, lands in the ledger with your name and the reason, and is kept:
 * bonus tokens go in the earned bucket and don't expire with the monthly
 * allowance.
 */
export default function BonusCard({ members }: { members: BonusMember[] }) {
  const router = useRouter()
  const toast = useToast()
  const [amount, setAmount] = useState('5')
  const [everyone, setEveryone] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  const name = (m: BonusMember) => m.display_name ?? m.username
  const n = Number(amount)
  const amountOk = Number.isInteger(n) && n > 0 && n <= 1000
  const recipients = useMemo(() => (everyone ? members : members.filter((m) => picked.has(m.user_id))), [everyone, members, picked])
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? members.filter((m) => name(m).toLowerCase().includes(q) || m.username.toLowerCase().includes(q)) : members
  }, [members, search])

  function toggle(id: string) {
    setPicked((s) => { const next = new Set(s); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }

  async function give() {
    const list = recipients
    const note = `Bonus${reason.trim() ? ` — ${reason.trim()}` : ''}`
    setProgress({ done: 0, total: list.length })
    const supabase = createClient()
    let ok = 0
    const failed: string[] = []
    // One at a time: each is its own ledger row, and a failure (say, a deleted
    // account) doesn't stop the rest.
    for (const m of list) {
      const { error } = await supabase.rpc('adjust_tokens', { target: m.user_id, amount: n, note })
      if (error) failed.push(name(m)); else ok++
      setProgress({ done: ok + failed.length, total: list.length })
    }
    setProgress(null); setConfirming(false)
    if (ok) toast.ok(`Gave ${n} token${n === 1 ? '' : 's'} to ${ok} ${ok === 1 ? 'member' : 'members'}.`)
    if (failed.length) toast.error(`Couldn't give tokens to ${failed.slice(0, 3).join(', ')}${failed.length > 3 ? ` and ${failed.length - 3} more` : ''}.`)
    if (ok) { setPicked(new Set()); setEveryone(false); setReason(''); router.refresh() }
  }

  const who = everyone ? `everyone (${members.length})` : recipients.length === 1 ? name(recipients[0]) : `${recipients.length} members`

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="font-display font-semibold text-base">Give a bonus</h2>
        <p className="text-xs text-muted">A one-time gift of tokens. They&apos;re kept: they don&apos;t expire with the monthly allowance.</p>
      </div>

      {/* How many */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Tokens each</p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK.map((q) => (
            <button key={q} type="button" onClick={() => setAmount(String(q))} aria-pressed={n === q}
              className={`min-h-10 min-w-12 px-3 rounded-xl text-sm font-semibold transition-colors ${n === q ? 'bg-signal text-white' : 'border border-card-border hover:border-ink/30'}`}>
              +{q}
            </button>
          ))}
          <input type="number" inputMode="numeric" min={1} max={1000} value={amount} onChange={(e) => setAmount(e.target.value)}
            aria-label="Tokens each"
            className="w-20 min-h-10 bg-paper border border-card-border rounded-xl px-3 text-sm font-mono outline-none focus:border-signal" />
        </div>
        {!amountOk && amount !== '' && <p className="text-xs text-red-600">A whole number from 1 to 1,000.</p>}
      </div>

      {/* Who */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Who gets it</p>
        <div role="radiogroup" className="flex gap-1 p-1 rounded-xl bg-paper border border-card-border">
          {([[false, 'Choose members'], [true, `Everyone (${members.length})`]] as const).map(([v, label]) => (
            <button key={label} type="button" role="radio" aria-checked={everyone === v} onClick={() => setEveryone(v)}
              className={`flex-1 min-h-9 rounded-lg text-xs font-semibold transition-colors ${everyone === v ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}>
              {label}
            </button>
          ))}
        </div>
        {!everyone && (
          <>
            <div className="flex items-center gap-2">
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search members"
                className="flex-1 min-h-10 bg-paper border border-card-border rounded-xl px-3 text-sm outline-none focus:border-signal placeholder:text-muted" />
              {picked.size > 0 && (
                <button type="button" onClick={() => setPicked(new Set())} className="shrink-0 min-h-10 px-2 text-xs text-muted hover:text-ink">
                  Clear {picked.size}
                </button>
              )}
            </div>
            <ul className="max-h-60 overflow-y-auto overscroll-contain rounded-xl border border-card-border divide-y divide-card-border">
              {shown.map((m) => {
                const on = picked.has(m.user_id)
                return (
                  <li key={m.user_id}>
                    <label className={`flex items-center gap-3 min-h-11 px-3 cursor-pointer ${on ? 'bg-signal/10' : 'hover:bg-ink/5'}`}>
                      <input type="checkbox" checked={on} onChange={() => toggle(m.user_id)} className="w-4 h-4 accent-[var(--signal)]" />
                      <span className="flex-1 min-w-0 text-sm truncate">{name(m)}</span>
                      <span className="font-mono text-xs text-muted">{m.balance} tk</span>
                    </label>
                  </li>
                )
              })}
              {shown.length === 0 && <li className="px-3 py-4 text-sm text-muted text-center">No one matches.</li>}
            </ul>
          </>
        )}
      </div>

      {/* Why */}
      <div className="space-y-1.5">
        <label htmlFor="bonus-reason" className="text-sm font-medium">Reason <span className="font-normal text-muted">(optional)</span></label>
        <input id="bonus-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={120}
          placeholder="Thanks for the restock reports"
          className="w-full min-h-10 bg-paper border border-card-border rounded-xl px-3 text-sm outline-none focus:border-signal placeholder:text-muted" />
        <p className="text-xs text-muted">Shows in the ledger, next to the bonus.</p>
      </div>

      <Button full disabled={!amountOk || recipients.length === 0} onClick={() => setConfirming(true)}>
        {recipients.length === 0 ? 'Pick who gets it' : `Give ${n} token${n === 1 ? '' : 's'} to ${who}`}
      </Button>

      <Sheet open={confirming} onClose={() => { if (!progress) setConfirming(false) }} title="Give this bonus?"
        footer={(
          <div className="flex gap-2">
            <Button variant="outline" full disabled={!!progress} onClick={() => setConfirming(false)}>Cancel</Button>
            <Button full loading={!!progress} onClick={give}>
              {progress ? `Giving… ${progress.done}/${progress.total}` : 'Give tokens'}
            </Button>
          </div>
        )}>
        <div className="space-y-3 text-sm">
          <p>
            <span className="font-semibold">{n} token{n === 1 ? '' : 's'}</span> each to <span className="font-semibold">{who}</span>
            {recipients.length > 1 && <> — <span className="font-mono">{n * recipients.length}</span> tokens in all</>}.
          </p>
          {!everyone && (
            <p className="text-muted">
              {recipients.slice(0, 8).map(name).join(', ')}{recipients.length > 8 ? ` and ${recipients.length - 8} more` : ''}
            </p>
          )}
          <p className="text-muted">Reason in the ledger: <span className="text-ink">Bonus{reason.trim() ? ` — ${reason.trim()}` : ''}</span></p>
          <p className="text-xs text-muted">Kept tokens. To take some back later, use Adjust on that member below.</p>
        </div>
      </Sheet>
    </Card>
  )
}
