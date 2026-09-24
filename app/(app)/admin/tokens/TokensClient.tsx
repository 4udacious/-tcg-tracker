'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Settings {
  monthly_allowance: number
  tokens_expire_monthly: boolean
  per_cycle_pack_cap: number | null
  cooldown_hours: number
  tokens_per_timer_report: number
  max_earned_tokens_per_month: number
}

/** Presets for the post-purchase cooldown, in hours. */
const COOLDOWN_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'None' },
  { value: 0.25, label: '15 min' },
  { value: 0.5, label: '30 min' },
  { value: 1, label: '1 hour' },
  { value: 2, label: '2 hours' },
  { value: 3, label: '3 hours' },
  { value: 6, label: '6 hours' },
  { value: 12, label: '12 hours' },
  { value: 24, label: '24 hours' },
]

interface BalanceRow {
  user_id: string
  username: string
  display_name: string | null
  role: string
  effective_allowance: number
  balance: number
}

interface LedgerRow {
  id: number
  user_id: string
  delta: number
  reason: string
  note: string | null
  created_at: string
  profiles: { username: string; display_name: string | null } | { username: string; display_name: string | null }[] | null
}

interface Props {
  settings: Settings
  balances: BalanceRow[]
  period: string
  recent: LedgerRow[]
}

const REASON_LABEL: Record<string, string> = {
  monthly_grant: 'Monthly grant',
  admin_adjustment: 'Adjustment',
  purchase: 'Purchase',
  refund: 'Refund',
  timer_reward: 'Timer report',
  timer_revoked: 'Timer report deleted',
}

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? v[0] ?? null : v
}

function periodLabel(period: string): string {
  if (!period) return 'this month'
  const d = new Date(period + 'T00:00:00')
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export default function TokensClient({ settings, balances, period, recent }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [busy, setBusy] = useState(false)

  const [allowance, setAllowance] = useState(String(settings.monthly_allowance))
  const [cap, setCap] = useState(settings.per_cycle_pack_cap == null ? '' : String(settings.per_cycle_pack_cap))
  const [expire, setExpire] = useState(settings.tokens_expire_monthly)
  const [cooldown, setCooldown] = useState(Number(settings.cooldown_hours ?? 3))
  const [perReport, setPerReport] = useState(String(settings.tokens_per_timer_report ?? 1))
  const [earnCap, setEarnCap] = useState(String(settings.max_earned_tokens_per_month ?? 15))

  const [search, setSearch] = useState('')
  const [adjusting, setAdjusting] = useState<string | null>(null)
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustNote, setAdjustNote] = useState('')

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return balances
    return balances.filter((b) => (b.display_name ?? b.username).toLowerCase().includes(q))
  }, [balances, search])

  const totals = useMemo(
    () => ({
      users: balances.length,
      outstanding: balances.reduce((sum, b) => sum + b.balance, 0),
    }),
    [balances]
  )

  async function saveSettings() {
    const n = Number(allowance)
    if (!Number.isInteger(n) || n < 0) { showToast('Allowance must be a whole number, 0 or more.', false); return }
    const c = cap.trim() === '' ? null : Number(cap)
    if (c !== null && (!Number.isInteger(c) || c < 1)) { showToast('Cap must be a whole number of 1 or more, or blank.', false); return }
    const pr = Number(perReport)
    const ec = Number(earnCap)
    if (!Number.isInteger(pr) || pr < 0) { showToast('Tokens per report must be a whole number, 0 or more.', false); return }
    if (!Number.isInteger(ec) || ec < 0) { showToast('Monthly earning cap must be a whole number, 0 or more.', false); return }
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.rpc('update_vending_settings', {
      p_monthly_allowance: n,
      p_per_cycle_pack_cap: c,
      p_tokens_expire_monthly: expire,
      p_cooldown_hours: cooldown,
      p_tokens_per_timer_report: pr,
      p_max_earned_tokens_per_month: ec,
    })
    setBusy(false)
    if (error) { showToast('Failed to save settings.', false); return }
    showToast('Settings saved.', true)
    startTransition(() => router.refresh())
  }

  async function runGrant() {
    if (!window.confirm(`Grant the monthly allowance to everyone for ${periodLabel(period)}?\n\nAnyone already granted this month is skipped, so this is safe to run more than once.`)) return
    setBusy(true)
    const supabase = createClient()
    const { data, error } = await supabase.rpc('grant_monthly_tokens')
    setBusy(false)
    if (error) { showToast('Grant failed.', false); return }
    const row = Array.isArray(data) ? data[0] : data
    const granted = row?.granted ?? 0
    const skipped = row?.skipped ?? 0
    showToast(
      granted === 0
        ? `Nobody new to grant — all ${skipped} already have ${periodLabel(period)}'s tokens.`
        : `Granted ${granted} ${granted === 1 ? 'user' : 'users'}${skipped > 0 ? `, skipped ${skipped} already granted` : ''}.`,
      true
    )
    startTransition(() => router.refresh())
  }

  async function submitAdjust(userId: string, label: string) {
    const amt = Number(adjustAmount)
    if (!Number.isInteger(amt) || amt === 0) { showToast('Enter a whole number, positive or negative.', false); return }
    setBusy(true)
    const supabase = createClient()
    const { data, error } = await supabase.rpc('adjust_tokens', {
      target: userId,
      amount: amt,
      note: adjustNote.trim() || null,
    })
    setBusy(false)
    if (error) {
      showToast(error.message.includes('negative') ? 'That would put them below zero.' : 'Adjustment failed.', false)
      return
    }
    showToast(`${label} now has ${data} ${data === 1 ? 'token' : 'tokens'}.`, true)
    setAdjusting(null); setAdjustAmount(''); setAdjustNote('')
    startTransition(() => router.refresh())
  }

  async function saveOverride(userId: string, raw: string, label: string) {
    const value = raw.trim() === '' ? null : Number(raw)
    if (value !== null && (!Number.isInteger(value) || value < 0)) { showToast('Override must be a whole number, 0 or more.', false); return }
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({ monthly_token_allowance: value }).eq('id', userId)
    setBusy(false)
    if (error) { showToast('Failed to save override.', false); return }
    showToast(value === null ? `${label} back to the default allowance.` : `${label} will get ${value}/month.`, true)
    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-sm font-medium shadow-lg max-w-[90vw] text-center ${toast.ok ? 'bg-ok text-white' : 'bg-ink text-white'}`}>
          {toast.msg}
        </div>
      )}

      {/* ── Settings ── */}
      <section className="bg-card border border-card-border rounded-2xl p-4 space-y-3">
        <h2 className="font-display font-semibold text-base">Vending settings</h2>

        <div className="space-y-1">
          <label className="text-sm font-medium text-ink">Monthly allowance</label>
          <p className="text-xs text-muted">Tokens each approved user receives. 1 token = 1 pack.</p>
          <input
            type="number" min={0} value={allowance}
            onChange={(e) => setAllowance(e.target.value)}
            className="w-full bg-paper border border-card-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-signal"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-ink">Packs per restock, per user</label>
          <p className="text-xs text-muted">Blank means no limit — one person can clear the whole machine.</p>
          <input
            type="number" min={1} value={cap} placeholder="No limit"
            onChange={(e) => setCap(e.target.value)}
            className="w-full bg-paper border border-card-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-signal placeholder:text-muted"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-ink">Earn by reporting timers</label>
          <p className="text-xs text-muted">
            Tokens awarded for each timer logged, hit or miss, and the most a member can earn this
            way per month. Set tokens per report to 0 to turn earning off.
          </p>
          <div className="flex gap-2 pt-0.5">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-muted">Per report</label>
              <input
                type="number" min={0} value={perReport}
                onChange={(e) => setPerReport(e.target.value)}
                className="w-full bg-paper border border-card-border rounded-xl px-3 py-2 text-sm outline-none focus:border-signal"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-muted">Monthly cap</label>
              <input
                type="number" min={0} value={earnCap}
                onChange={(e) => setEarnCap(e.target.value)}
                className="w-full bg-paper border border-card-border rounded-xl px-3 py-2 text-sm outline-none focus:border-signal"
              />
            </div>
          </div>
          {Number(perReport) > 0 && Number(earnCap) > 0 && (
            <p className="text-xs text-muted">
              That is {Math.ceil(Number(earnCap) / Number(perReport))} report
              {Math.ceil(Number(earnCap) / Number(perReport)) === 1 ? '' : 's'} to reach the cap.
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-ink">Cooldown after buying</label>
          <p className="text-xs text-muted">
            How long a member waits before they can use the machine again. This is the main brake on one
            person clearing every restock.
          </p>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {COOLDOWN_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setCooldown(o.value)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  cooldown === o.value
                    ? 'bg-signal text-white border-signal'
                    : 'bg-paper border-card-border text-ink hover:border-ink/30'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          {cooldown === 0 && (
            <p className="text-xs text-[#f97316]">
              With no cooldown and no pack cap, the fastest member can take every restock.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setExpire((v) => !v)}
          className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 transition-colors ${expire ? 'border-signal/40 bg-signal/5' : 'border-card-border bg-paper'}`}
        >
          <div className="text-left">
            <p className="text-sm font-medium text-ink">Tokens expire monthly</p>
            <p className="text-xs text-muted">
              {expire ? 'Unused tokens are wiped when the month turns over' : 'Unused tokens roll over and accumulate'}
            </p>
          </div>
          <div className={`w-10 h-6 rounded-full flex items-center transition-colors shrink-0 ${expire ? 'bg-signal' : 'bg-card-border'}`}>
            <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform mx-1 ${expire ? 'translate-x-4' : 'translate-x-0'}`} />
          </div>
        </button>

        <button onClick={saveSettings} disabled={busy} className="w-full bg-signal hover:bg-signal/90 disabled:opacity-50 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors">
          Save settings
        </button>
      </section>

      {/* ── Grant ── */}
      <section className="bg-card border border-card-border rounded-2xl p-4 space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display font-semibold text-base">{periodLabel(period)}</h2>
          <span className="font-mono text-[10px] text-muted">auto-grants 1st at ~1am PT</span>
        </div>
        <div className="flex gap-3 text-sm">
          <div className="flex-1 bg-paper border border-card-border rounded-xl px-3 py-2">
            <p className="font-mono text-lg font-semibold text-ink">{totals.users}</p>
            <p className="text-xs text-muted">users</p>
          </div>
          <div className="flex-1 bg-paper border border-card-border rounded-xl px-3 py-2">
            <p className="font-mono text-lg font-semibold text-signal">{totals.outstanding}</p>
            <p className="text-xs text-muted">tokens held</p>
          </div>
        </div>
        <button onClick={runGrant} disabled={busy} className="w-full border border-signal/40 bg-signal/5 hover:bg-signal/10 disabled:opacity-50 text-signal font-semibold rounded-xl py-2.5 text-sm transition-colors">
          Grant {periodLabel(period)} allowance
        </button>
        <p className="text-xs text-muted">
          Runs automatically on the 1st. Use this if the schedule missed, or after approving someone mid-month. Anyone already
          granted is skipped, so running it twice never double-pays.
        </p>
      </section>

      {/* ── Balances ── */}
      <section className="space-y-3">
        <h2 className="font-display font-semibold text-base">Balances</h2>
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search member…"
          className="w-full bg-card border border-card-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-signal placeholder:text-muted"
        />
        {filtered.length === 0 ? (
          <p className="text-sm text-muted">No matches.</p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((b) => {
              const label = b.display_name ?? b.username
              const isAdjusting = adjusting === b.user_id
              return (
                <li key={b.user_id} className="bg-card border border-card-border rounded-xl px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{label}</p>
                      <p className="font-mono text-xs text-muted">
                        {b.effective_allowance}/mo{b.role !== 'member' ? ` · ${b.role}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`font-mono text-base font-semibold ${b.balance > 0 ? 'text-signal' : 'text-muted'}`}>
                        {b.balance}
                      </span>
                      <button
                        onClick={() => { setAdjusting(isAdjusting ? null : b.user_id); setAdjustAmount(''); setAdjustNote('') }}
                        className="text-xs font-medium px-2.5 py-1 rounded-lg border border-card-border hover:border-ink/30 transition-colors"
                      >
                        {isAdjusting ? 'Cancel' : 'Adjust'}
                      </button>
                    </div>
                  </div>

                  {isAdjusting && (
                    <div className="space-y-2 pt-1 border-t border-card-border">
                      <div className="flex gap-2 pt-2">
                        <input
                          type="number" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)}
                          placeholder="+5 or -2" autoFocus
                          className="flex-1 bg-paper border border-card-border rounded-lg px-3 py-2 text-sm outline-none focus:border-signal placeholder:text-muted"
                        />
                        <button
                          onClick={() => submitAdjust(b.user_id, label)} disabled={busy}
                          className="px-4 bg-signal hover:bg-signal/90 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
                        >
                          Apply
                        </button>
                      </div>
                      <input
                        type="text" value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)}
                        placeholder="Reason (optional) — shows in history" maxLength={200}
                        className="w-full bg-paper border border-card-border rounded-lg px-3 py-2 text-xs outline-none focus:border-signal placeholder:text-muted"
                      />
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-muted shrink-0">Monthly override</label>
                        <input
                          type="number" min={0} defaultValue={b.effective_allowance}
                          onBlur={(e) => {
                            if (Number(e.target.value) !== b.effective_allowance) saveOverride(b.user_id, e.target.value, label)
                          }}
                          className="w-20 bg-paper border border-card-border rounded-lg px-2 py-1 text-xs text-center outline-none focus:border-signal"
                        />
                        <button
                          onClick={() => saveOverride(b.user_id, '', label)}
                          className="text-xs text-muted hover:text-ink underline underline-offset-2"
                        >
                          Use default
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* ── History ── */}
      <section className="space-y-3">
        <h2 className="font-display font-semibold text-base">Recent activity</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted">Nothing yet. Grant an allowance to get started.</p>
        ) : (
          <ul className="space-y-1.5">
            {recent.map((r) => {
              const who = one(r.profiles)
              return (
                <li key={r.id} className="bg-card border border-card-border rounded-xl px-3 py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm truncate">{who?.display_name ?? who?.username ?? 'Unknown'}</p>
                    <p className="font-mono text-[10px] text-muted truncate">
                      {REASON_LABEL[r.reason] ?? r.reason}
                      {r.note ? ` · ${r.note}` : ''}
                    </p>
                  </div>
                  <span className={`font-mono text-sm font-semibold shrink-0 ${r.delta > 0 ? 'text-ok' : 'text-muted'}`}>
                    {r.delta > 0 ? `+${r.delta}` : r.delta}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
