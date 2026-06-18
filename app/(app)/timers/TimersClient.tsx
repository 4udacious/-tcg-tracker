'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import SearchableSelect from '@/components/SearchableSelect'
import { Toast, useToast } from '@/components/Toast'
import { useRouter } from 'next/navigation'

interface TimerReport {
  id: string
  minutes: number
  success: boolean
  reported_at: string
  machines: { id: string; machine_code: string; venue: string; nickname: string | null; area: string; address: string } | null
  profiles: { username: string } | null
}

interface Props {
  areas: string[]
  todayReports: TimerReport[]
  userId: string
}

export default function TimersClient({ areas, todayReports, userId }: Props) {
  const router = useRouter()
  const { toast, show, dismiss } = useToast()
  const [isPending, startTransition] = useTransition()

  const [selectedArea, setSelectedArea] = useState('')
  const [selectedMachine, setSelectedMachine] = useState('')
  const [minutes, setMinutes] = useState(0)
  const [success, setSuccess] = useState<boolean | null>(null)
  const [machines, setMachines] = useState<any[]>([])
  const [loadingMachines, setLoadingMachines] = useState(false)

  const areaOptions = areas.map(a => ({ value: a, label: a }))
  const machineOptions = machines.map(m => ({
    value: m.id,
    label: `${m.machine_code} — ${m.venue}${m.nickname ? ` (${m.nickname})` : ''}, ${m.address}`,
  }))

  async function handleAreaChange(area: string) {
    setSelectedArea(area)
    setSelectedMachine('')
    if (!area) { setMachines([]); return }
    setLoadingMachines(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('machines')
      .select('id, machine_code, venue, address, nickname')
      .eq('area', area)
      .eq('is_active', true)
      .order('machine_code')
    setMachines(data ?? [])
    setLoadingMachines(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedMachine || success === null) return

    const supabase = createClient()
    const { error } = await (supabase as any).from('timer_reports').insert({
      user_id: userId,
      machine_id: selectedMachine,
      minutes,
      success,
    })

    if (error) { show('Failed to log. Try again.', 'error'); return }

    show('Timer logged.', 'success')
    setSelectedArea('')
    setSelectedMachine('')
    setMinutes(0)
    setSuccess(null)
    setMachines([])
    startTransition(() => router.refresh())
  }

  // Group today's reports by machine
  const byMachine = todayReports.reduce<Record<string, { machine: TimerReport['machines']; reports: TimerReport[] }>>((acc, r) => {
    const key = r.machines?.id ?? 'unknown'
    if (!acc[key]) acc[key] = { machine: r.machines, reports: [] }
    acc[key].reports.push(r)
    return acc
  }, {})

  const machineIds = Object.keys(byMachine)

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}

      {/* Log form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold text-base" style={{ fontFamily: 'var(--font-display)' }}>
            Log timer
          </h2>
          <SearchableSelect
            options={areaOptions}
            value={selectedArea}
            onChange={handleAreaChange}
            placeholder="Choose an area…"
            label="Area"
          />
          <SearchableSelect
            options={machineOptions}
            value={selectedMachine}
            onChange={setSelectedMachine}
            placeholder={loadingMachines ? 'Loading…' : selectedArea ? 'Choose a machine…' : 'Pick an area first'}
            disabled={!selectedArea || loadingMachines}
            label="Machine"
          />

          {/* Minutes stepper */}
          <div>
            <label className="block text-xs font-medium text-[var(--muted)] mb-1.5 uppercase tracking-wide" style={{ fontFamily: 'var(--font-mono)' }}>
              Minute mark
            </label>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setMinutes(m => Math.max(0, m - 1))}
                className="w-10 h-10 rounded-full border border-[var(--card-border)] text-lg font-bold text-[var(--ink)] hover:border-[var(--signal)] transition-colors flex items-center justify-center"
                aria-label="Decrease minute"
              >
                −
              </button>
              <span
                className="text-3xl font-bold tabular-nums w-20 text-center text-[var(--ink)]"
                style={{ fontFamily: 'var(--font-mono)' }}
                aria-live="polite"
              >
                :{String(minutes).padStart(2, '0')}
              </span>
              <button
                type="button"
                onClick={() => setMinutes(m => Math.min(59, m + 1))}
                className="w-10 h-10 rounded-full border border-[var(--card-border)] text-lg font-bold text-[var(--ink)] hover:border-[var(--signal)] transition-colors flex items-center justify-center"
                aria-label="Increase minute"
              >
                +
              </button>
            </div>
          </div>

          {/* Outcome toggle */}
          <div>
            <label className="block text-xs font-medium text-[var(--muted)] mb-1.5 uppercase tracking-wide" style={{ fontFamily: 'var(--font-mono)' }}>
              Outcome
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSuccess(true)}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold border transition-colors ${
                  success === true
                    ? 'bg-[var(--ok)] border-[var(--ok)] text-white'
                    : 'border-[var(--card-border)] text-[var(--muted)] hover:border-[var(--ok)] hover:text-[var(--ok)]'
                }`}
              >
                ✓ Got it
              </button>
              <button
                type="button"
                onClick={() => setSuccess(false)}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold border transition-colors ${
                  success === false
                    ? 'bg-[var(--danger)] border-[var(--danger)] text-white'
                    : 'border-[var(--card-border)] text-[var(--muted)] hover:border-[var(--danger)] hover:text-[var(--danger)]'
                }`}
              >
                ✗ No luck
              </button>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={!selectedMachine || success === null || isPending}
          className="w-full bg-[var(--signal)] text-[var(--ink)] font-bold rounded-xl py-3.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:opacity-80 transition-opacity"
        >
          Log timer
        </button>
      </form>

      {/* Today's data */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--muted)] mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
          Today&apos;s Timers
        </h2>

        {machineIds.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm text-[var(--muted)]">No active timers.</p>
            <p className="text-xs text-[var(--muted)] mt-1">Log one when you spot a machine.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {machineIds.map(machineId => {
              const { machine, reports } = byMachine[machineId]
              if (!machine) return null
              const hits = reports.filter(r => r.success)
              const misses = reports.filter(r => !r.success)
              const machineLabel = `${machine.machine_code} — ${machine.venue}${machine.nickname ? ` (${machine.nickname})` : ''}`

              return (
                <div key={machineId} className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
                  {/* Machine header with ring */}
                  <div className="p-4 flex items-center gap-4 border-b border-[var(--card-border)]">
                    <TimerRing total={reports.length} hits={hits.length} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--ink)] truncate" style={{ fontFamily: 'var(--font-display)' }}>
                        {machineLabel}
                      </p>
                      <p className="text-xs text-[var(--muted)] mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>
                        {machine.address}
                      </p>
                      <p className="text-xs mt-1" style={{ fontFamily: 'var(--font-mono)' }}>
                        <span className="text-[var(--ok)] font-semibold">{hits.length} hit{hits.length !== 1 ? 's' : ''}</span>
                        <span className="text-[var(--muted)] mx-1">·</span>
                        <span className="text-[var(--muted)]">{misses.length} miss{misses.length !== 1 ? 'es' : ''}</span>
                      </p>
                    </div>
                  </div>

                  {/* Reports list */}
                  <ul>
                    {reports.map(r => {
                      const isRecent = Date.now() - new Date(r.reported_at).getTime() < 60 * 60 * 1000
                      return (
                        <li
                          key={r.id}
                          className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--card-border)] last:border-0"
                        >
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                              r.success
                                ? 'bg-[var(--ok)]/10 text-[var(--ok)]'
                                : 'bg-[var(--danger)]/10 text-[var(--danger)]'
                            }`}
                          >
                            {r.success ? '✓' : '✗'}
                          </span>
                          <span
                            className="font-semibold tabular-nums text-sm text-[var(--ink)] w-10"
                            style={{ fontFamily: 'var(--font-mono)' }}
                          >
                            :{String(r.minutes).padStart(2, '0')}
                          </span>
                          <span className="text-xs text-[var(--muted)] flex-1 truncate" style={{ fontFamily: 'var(--font-mono)' }}>
                            {r.profiles?.username} · {timeAgo(r.reported_at)}
                          </span>
                          {isRecent && (
                            <span className="w-2 h-2 rounded-full bg-[var(--signal)] amber-pulse shrink-0" aria-hidden />
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function TimerRing({ total, hits }: { total: number; hits: number }) {
  const size = 52
  const strokeWidth = 4
  const r = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  const hitFraction = total > 0 ? hits / total : 0
  const dashOffset = circumference * (1 - hitFraction)

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0 -rotate-90"
      aria-hidden
    >
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--card-border)"
        strokeWidth={strokeWidth}
      />
      {/* Progress — holo gradient only when active */}
      {total > 0 && (
        <>
          <defs>
            <linearGradient id={`holo-${total}-${hits}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="50%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={hits > 0 ? `url(#holo-${total}-${hits})` : 'var(--muted)'}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={hits > 0 ? dashOffset : circumference * 0.15}
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </>
      )}
      {/* Center text */}
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="11"
        fontWeight="600"
        fill="var(--ink)"
        className="rotate-90"
        transform={`rotate(90, ${size / 2}, ${size / 2})`}
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {total}
      </text>
    </svg>
  )
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
