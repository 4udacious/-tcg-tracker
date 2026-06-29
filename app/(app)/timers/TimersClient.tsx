'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import LocationSearch, { type LocationItem } from '@/components/LocationSearch'
import FavoritesQuickPick, { type FavoriteMachine } from '@/components/FavoritesQuickPick'
import FavoriteToggle from '@/components/FavoriteToggle'
import ConditionFlags, { type ConditionType } from '@/components/ConditionFlags'
import TimerCard from '@/components/TimerCard'
import TimerAnalytics from './TimerAnalytics'

interface Machine {
  id: string
  machine_code: string
  region: string
  city: string
  neighborhood: string | null
  venue: string
  address: string | null
  nickname: string | null
}

interface FavoriteRow {
  machine_id: string
  machines: { id: string; machine_code: string; venue: string; nickname: string | null } | { id: string; machine_code: string; venue: string; nickname: string | null }[] | null
}

interface TodayReport {
  id: string
  machine_id: string
  user_id: string
  minutes: number
  success: boolean
  reported_at: string
  profiles: { username: string; display_name?: string } | { username: string; display_name?: string }[] | null
}

interface TodayCondition {
  id: string
  machine_id: string
  user_id: string
  note: string | null
  created_at: string
  condition_types: { name: string } | { name: string }[] | null
  profiles: { username: string; display_name?: string } | { username: string; display_name?: string }[] | null
}

interface Props {
  machines: Machine[]
  favorites: FavoriteRow[]
  conditionTypes: ConditionType[]
  todayReports: TodayReport[]
  todayConditions: TodayCondition[]
  userId: string
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? v[0] ?? null : v
}

export default function TimersClient({ machines, favorites, conditionTypes, todayReports, todayConditions, userId }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [tab, setTab] = useState<'log' | 'analytics'>('log')
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null)
  const [minutes, setMinutes] = useState(15)
  const [outcome, setOutcome] = useState<'hit' | 'miss' | null>(null)
  const [selectedConditions, setSelectedConditions] = useState<string[]>([])
  const [conditionNote, setConditionNote] = useState('')
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(
    new Set(favorites.map((f) => f.machine_id))
  )
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const machineItems: LocationItem[] = useMemo(
    () =>
      machines.map((m) => ({
        id: m.id,
        primary: `${m.machine_code} — ${m.venue}${m.nickname ? ` (${m.nickname})` : ''}, ${m.city}`,
        secondary: m.address ?? undefined,
        region: m.region,
        city: m.city,
        searchText: [m.region, m.city, m.neighborhood, m.venue, m.address, m.nickname, m.machine_code].filter(Boolean).join(' '),
      })),
    [machines]
  )

  const favoriteMachines: FavoriteMachine[] = useMemo(
    () =>
      favorites
        .map((f) => one(f.machines))
        .filter((m): m is FavoriteMachine => m !== null),
    [favorites]
  )

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  function resetForm() {
    setSelectedMachineId(null)
    setMinutes(15)
    setOutcome(null)
    setSelectedConditions([])
    setConditionNote('')
  }

  async function handleLogTimer() {
    if (!selectedMachineId || outcome === null) return
    setIsSubmitting(true)
    const supabase = createClient()
    const { error } = await supabase.from('timer_reports').insert({
      user_id: userId,
      machine_id: selectedMachineId,
      minutes,
      success: outcome === 'hit',
    })
    if (error) {
      showToast('Something went wrong.', false)
      setIsSubmitting(false)
      return
    }
    if (selectedConditions.length > 0) {
      await supabase.from('machine_conditions').insert(
        selectedConditions.map((conditionTypeId) => ({
          user_id: userId,
          machine_id: selectedMachineId,
          condition_type_id: conditionTypeId,
          note: conditionNote || null,
        }))
      )
    }
    showToast('Timer logged.', true)
    resetForm()
    setIsSubmitting(false)
    startTransition(() => router.refresh())
  }

  async function handleReportCondition() {
    if (!selectedMachineId || selectedConditions.length === 0) return
    setIsSubmitting(true)
    const supabase = createClient()
    const { error } = await supabase.from('machine_conditions').insert(
      selectedConditions.map((conditionTypeId) => ({
        user_id: userId,
        machine_id: selectedMachineId,
        condition_type_id: conditionTypeId,
        note: conditionNote || null,
      }))
    )
    if (error) {
      showToast('Something went wrong.', false)
      setIsSubmitting(false)
      return
    }
    showToast('Condition reported.', true)
    resetForm()
    setIsSubmitting(false)
    startTransition(() => router.refresh())
  }

  async function handleDeleteReport(id: string) {
    if (!window.confirm('Delete this timer report?')) return
    const supabase = createClient()
    const { error } = await supabase.from('timer_reports').delete().eq('id', id)
    if (error) {
      showToast('Failed to delete.', false)
      return
    }
    showToast('Timer deleted.', true)
    startTransition(() => router.refresh())
  }

  async function handleDeleteCondition(id: string) {
    if (!window.confirm('Delete this status update?')) return
    const supabase = createClient()
    const { error } = await supabase.from('machine_conditions').delete().eq('id', id)
    if (error) {
      showToast('Failed to delete.', false)
      return
    }
    showToast('Status update deleted.', true)
    startTransition(() => router.refresh())
  }

  // Group today's activity by machine
  const todayByMachine = useMemo(() => {
    const map = new Map<
      string,
      {
        machine: Machine | undefined
        reports: { id: string; minute: number; success: boolean; reporter: string; ago: string; reportedAt: number; isOwn: boolean }[]
        conditions: { id: string; name: string; ago: string; isOwn: boolean }[]
      }
    >()

    for (const r of todayReports) {
      if (!map.has(r.machine_id)) {
        map.set(r.machine_id, { machine: machines.find((m) => m.id === r.machine_id), reports: [], conditions: [] })
      }
      const profile = one(r.profiles)
      map.get(r.machine_id)!.reports.push({
        id: r.id,
        minute: r.minutes,
        success: r.success,
        reporter: profile?.display_name ?? profile?.username ?? '?',
        ago: timeAgo(new Date(r.reported_at)),
        reportedAt: new Date(r.reported_at).getTime(),
        isOwn: r.user_id === userId,
      })
    }

    for (const c of todayConditions) {
      if (!map.has(c.machine_id)) {
        map.set(c.machine_id, { machine: machines.find((m) => m.id === c.machine_id), reports: [], conditions: [] })
      }
      const ct = one(c.condition_types)
      map.get(c.machine_id)!.conditions.push({
        id: c.id,
        name: ct?.name ?? 'Condition',
        ago: timeAgo(new Date(c.created_at)),
        isOwn: c.user_id === userId,
      })
    }

    return [...map.entries()]
      .map(([machineId, v]) => ({ machineId, ...v }))
      .sort((a, b) => {
        const aLatest = Math.max(0, ...a.reports.map((r) => r.reportedAt))
        const bLatest = Math.max(0, ...b.reports.map((r) => r.reportedAt))
        return bLatest - aLatest
      })
  }, [todayReports, todayConditions, machines])

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-sm font-medium shadow-lg ${toast.ok ? 'bg-ok text-white' : 'bg-ink text-white'}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex gap-1">
        {(['log', 'analytics'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? 'bg-ink text-white' : 'bg-card border border-card-border text-ink hover:border-ink/20'
            }`}
          >
            {t === 'log' ? 'Log' : 'Analytics'}
          </button>
        ))}
      </div>

      {tab === 'log' ? (
        <>
          <section className="bg-card border border-card-border rounded-2xl p-4 space-y-4">
            <h2 className="font-display font-semibold text-base">Log timer</h2>

            <FavoritesQuickPick
              favorites={favoriteMachines}
              selectedId={selectedMachineId}
              onSelect={setSelectedMachineId}
            />

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <LocationSearch
                  label="Machine"
                  items={machineItems}
                  value={selectedMachineId}
                  onChange={setSelectedMachineId}
                  placeholder="Search by city, venue, address, machine ID…"
                />
              </div>
              {selectedMachineId && (
                <FavoriteToggle
                  userId={userId}
                  machineId={selectedMachineId}
                  initialFavorited={favoriteIds.has(selectedMachineId)}
                  onChange={(fav) => {
                    setFavoriteIds((prev) => {
                      const next = new Set(prev)
                      if (fav) next.add(selectedMachineId)
                      else next.delete(selectedMachineId)
                      return next
                    })
                  }}
                />
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-ink">Minute of attempt</label>
                <span className="font-mono text-sm font-semibold text-signal">:{String(minutes).padStart(2, '0')}</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMinutes(Math.max(0, minutes - 1))}
                  className="w-9 h-9 rounded-full bg-paper border border-card-border flex items-center justify-center text-ink hover:bg-card-border transition-colors font-medium"
                >
                  −
                </button>
                <input
                  type="range"
                  min={0}
                  max={59}
                  step={1}
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value))}
                  className="flex-1 accent-signal"
                />
                <button
                  type="button"
                  onClick={() => setMinutes(Math.min(59, minutes + 1))}
                  className="w-9 h-9 rounded-full bg-paper border border-card-border flex items-center justify-center text-ink hover:bg-card-border transition-colors font-medium"
                >
                  +
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-ink">Outcome</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOutcome('hit')}
                  className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                    outcome === 'hit' ? 'bg-ok text-white border-ok' : 'bg-paper border-card-border text-ink hover:border-ok/40'
                  }`}
                >
                  Got it
                </button>
                <button
                  type="button"
                  onClick={() => setOutcome('miss')}
                  className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                    outcome === 'miss' ? 'bg-ink text-white border-ink' : 'bg-paper border-card-border text-ink hover:border-ink/40'
                  }`}
                >
                  No luck
                </button>
              </div>
            </div>

            <ConditionFlags conditionTypes={conditionTypes} selected={selectedConditions} onChange={setSelectedConditions} />

            {selectedConditions.length > 0 && (
              <input
                type="text"
                value={conditionNote}
                onChange={(e) => setConditionNote(e.target.value)}
                placeholder="Note (optional)"
                maxLength={200}
                className="w-full bg-paper border border-card-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-signal focus:ring-2 focus:ring-signal/20 placeholder:text-muted"
              />
            )}

            <div className="flex gap-2">
              <button
                onClick={handleLogTimer}
                disabled={!selectedMachineId || outcome === null || isSubmitting}
                className="flex-1 bg-signal hover:bg-signal/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-2.5 text-sm transition-colors"
              >
                Log timer
              </button>
              <button
                onClick={handleReportCondition}
                disabled={!selectedMachineId || selectedConditions.length === 0 || isSubmitting}
                className="flex-1 bg-card border border-card-border hover:border-ink/30 disabled:opacity-50 disabled:cursor-not-allowed text-ink font-semibold rounded-xl py-2.5 text-sm transition-colors"
              >
                Report condition
              </button>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-display font-semibold text-base">Today&apos;s Timers</h2>
            {todayByMachine.length === 0 ? (
              <p className="text-sm text-muted">No active timers. Log one when you spot a machine.</p>
            ) : (
              <div className="space-y-4">
                {todayByMachine.map(({ machineId, machine, reports, conditions }) => (
                  <div key={machineId} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm">
                        <span className="font-mono text-muted">{machine?.machine_code}</span> — {machine?.nickname ?? machine?.venue}
                      </p>
                    </div>
                    {conditions.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap">
                        {conditions.map((c) => (
                          <span
                            key={c.id}
                            className="inline-flex items-center gap-1 font-mono text-[10px] font-medium text-signal bg-signal/10 rounded-full px-2 py-0.5"
                          >
                            {c.name} · {c.ago}
                            {c.isOwn && (
                              <button
                                type="button"
                                onClick={() => handleDeleteCondition(c.id)}
                                aria-label="Delete status update"
                                className="text-signal/60 hover:text-signal"
                              >
                                ×
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                    {reports.length > 0 && (
                      <ul className="space-y-1.5">
                        {reports.map((r) => (
                          <TimerCard
                            key={r.id}
                            minute={r.minute}
                            success={r.success}
                            reporter={r.reporter}
                            ago={r.ago}
                            isOwn={r.isOwn}
                            onDelete={() => handleDeleteReport(r.id)}
                          />
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : (
        <TimerAnalytics machineItems={machineItems} favoriteMachines={favoriteMachines} />
      )}
    </div>
  )
}
