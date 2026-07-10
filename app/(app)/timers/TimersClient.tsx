'use client'

import { useMemo, useRef, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import LocationSearch, { type LocationItem } from '@/components/LocationSearch'
import FavoritesQuickPick, { type FavoriteMachine } from '@/components/FavoritesQuickPick'
import FavoriteToggle from '@/components/FavoriteToggle'
import ConditionFlags, { type ConditionType } from '@/components/ConditionFlags'
import TimerCard from '@/components/TimerCard'
import MachineComments from '@/components/MachineComments'
import TimerAnalytics from './TimerAnalytics'
import { checkAchievements } from '@/lib/checkAchievements'

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
  machines: { id: string; machine_code: string; venue: string; nickname: string | null; address: string | null; city: string } | { id: string; machine_code: string; venue: string; nickname: string | null; address: string | null; city: string }[] | null
}

interface TodayReport {
  id: string
  machine_id: string
  user_id: string
  minutes: number
  success: boolean
  note: string | null
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
  role: string
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

export default function TimersClient({ machines, favorites, conditionTypes, todayReports, todayConditions, userId, role }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const canSeeAnalytics = role !== 'contributor'
  const visibleTabs = canSeeAnalytics ? (['log', 'activity', 'analytics'] as const) : (['log', 'activity'] as const)

  const [tab, setTab] = useState<'log' | 'activity' | 'analytics'>('log')

  useEffect(() => {
    if (!canSeeAnalytics && tab === 'analytics') setTab('log')
  }, [canSeeAnalytics, tab])
  const [logTab, setLogTab] = useState<'favorites' | 'search'>('favorites')
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null)
  const [minutes, setMinutes] = useState(() => new Date().getMinutes())
  const [outcome, setOutcome] = useState<'hit' | 'miss' | null>(null)
  const [selectedConditions, setSelectedConditions] = useState<string[]>([])
  const [conditionNote, setConditionNote] = useState('')
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(
    new Set(favorites.map((f) => f.machine_id))
  )
  const [collapsedCities, setCollapsedCities] = useState<Set<string>>(new Set())
  const [favDropdownOpen, setFavDropdownOpen] = useState(false)
  const favDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (favDropdownRef.current && !favDropdownRef.current.contains(e.target as Node)) {
        setFavDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
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

  // Group favorites by city for the dropdown
  const favoritesByCity = useMemo(() => {
    const map = new Map<string, FavoriteMachine[]>()
    for (const m of favoriteMachines) {
      const city = m.city ?? 'Other'
      if (!map.has(city)) map.set(city, [])
      map.get(city)!.push(m)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [favoriteMachines])

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  function resetForm() {
    setSelectedMachineId(null)
    setMinutes(new Date().getMinutes())
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
    checkAchievements(userId).then((earned) => {
      if (earned.length > 0) {
        const msg = earned.length === 1 ? `🏅 Badge earned: ${earned[0]}!` : `🏅 ${earned.length} new badges earned!`
        setTimeout(() => showToast(msg, true), 2000)
      }
    })
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
    if (error) { showToast('Failed to delete.', false); return }
    showToast('Timer deleted.', true)
    startTransition(() => router.refresh())
  }

  async function handleDeleteCondition(id: string) {
    if (!window.confirm('Delete this status update?')) return
    const supabase = createClient()
    const { error } = await supabase.from('machine_conditions').delete().eq('id', id)
    if (error) { showToast('Failed to delete.', false); return }
    showToast('Status update deleted.', true)
    startTransition(() => router.refresh())
  }

  const todayByMachine = useMemo(() => {
    const map = new Map<
      string,
      {
        machine: Machine | undefined
        reports: { id: string; minute: number; success: boolean; note: string | null; reporter: string; ago: string; reportedAt: number; isOwn: boolean }[]
        conditions: { id: string; name: string; note: string | null; reporter: string; ago: string; isOwn: boolean }[]
      }
    >()

    for (const r of todayReports) {
      if (!map.has(r.machine_id))
        map.set(r.machine_id, { machine: machines.find((m) => m.id === r.machine_id), reports: [], conditions: [] })
      const profile = one(r.profiles)
      map.get(r.machine_id)!.reports.push({
        id: r.id, minute: r.minutes, success: r.success, note: r.note,
        reporter: profile?.display_name ?? profile?.username ?? '?',
        ago: timeAgo(new Date(r.reported_at)),
        reportedAt: new Date(r.reported_at).getTime(),
        isOwn: r.user_id === userId,
      })
    }

    for (const c of todayConditions) {
      if (!map.has(c.machine_id))
        map.set(c.machine_id, { machine: machines.find((m) => m.id === c.machine_id), reports: [], conditions: [] })
      const ct = one(c.condition_types)
      const cp = one(c.profiles)
      map.get(c.machine_id)!.conditions.push({
        id: c.id,
        name: ct?.name ?? 'Condition',
        note: c.note ?? null,
        reporter: cp?.display_name ?? cp?.username ?? '?',
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

  // Group activity by city for collapsible sections
  const activityByCity = useMemo(() => {
    const map = new Map<string, typeof todayByMachine>()
    for (const entry of todayByMachine) {
      const city = entry.machine?.city ?? 'Unknown'
      if (!map.has(city)) map.set(city, [])
      map.get(city)!.push(entry)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [todayByMachine])

  function toggleCity(city: string) {
    setCollapsedCities((prev) => {
      const next = new Set(prev)
      if (next.has(city)) next.delete(city)
      else next.add(city)
      return next
    })
  }

  const selectedMachineName = useMemo(() => {
    if (!selectedMachineId) return null
    const m = machines.find((m) => m.id === selectedMachineId)
    if (!m) return null
    return `${m.machine_code} — ${m.nickname ?? m.venue}`
  }, [selectedMachineId, machines])

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-sm font-medium shadow-lg ${toast.ok ? 'bg-ok text-white' : 'bg-ink text-white'}`}>
          {toast.msg}
        </div>
      )}

      {/* Main tabs */}
      <div className="flex gap-1">
        {visibleTabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t as 'log' | 'activity' | 'analytics')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
              tab === t ? 'bg-ink text-white' : 'bg-card border border-card-border text-ink hover:border-ink/20'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'log' && (
        <section className="bg-card border border-card-border rounded-2xl p-4 space-y-4">
          <h2 className="font-display font-semibold text-base">Log timer</h2>

          {/* Inner machine-picker tabs */}
          <div className="flex gap-1 bg-paper rounded-xl p-1">
            <button
              onClick={() => { setLogTab('favorites'); setSelectedMachineId(null) }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                logTab === 'favorites' ? 'bg-ink text-white' : 'text-ink'
              }`}
            >
              Favorites
            </button>
            <button
              onClick={() => { setLogTab('search'); setSelectedMachineId(null) }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                logTab === 'search' ? 'bg-ink text-white' : 'text-ink'
              }`}
            >
              Search
            </button>
          </div>

          {logTab === 'favorites' ? (
            favoriteMachines.length === 0 ? (
              <p className="text-sm text-muted">No favorites yet. Switch to Search and star a machine first.</p>
            ) : (
              <div className="relative" ref={favDropdownRef}>
                <button
                  type="button"
                  onClick={() => setFavDropdownOpen((v) => !v)}
                  className={`w-full flex items-center justify-between gap-2 bg-card border rounded-xl px-3 py-2.5 text-sm text-left transition-colors ${
                    favDropdownOpen ? 'border-signal ring-2 ring-signal/20' : 'border-card-border hover:border-ink/30'
                  }`}
                >
                  <span className={selectedMachineId ? 'text-ink' : 'text-muted'}>
                    {selectedMachineId
                      ? (() => {
                          const m = favoriteMachines.find((m) => m.id === selectedMachineId)
                          return m ? `${m.machine_code} — ${m.nickname ?? m.venue}` : 'Select a favorite…'
                        })()
                      : 'Select a favorite…'}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {selectedMachineId && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); setSelectedMachineId(null) }}
                        onKeyDown={(e) => e.key === 'Enter' && setSelectedMachineId(null)}
                        className="w-4 h-4 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-paper transition-colors"
                        aria-label="Clear selection"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </span>
                    )}
                    <svg className={`w-4 h-4 text-muted transition-transform ${favDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>
                </button>

                {favDropdownOpen && (
                  <div className="absolute z-50 mt-1 w-full bg-card border border-card-border rounded-xl shadow-lg overflow-hidden">
                    <div className="max-h-72 overflow-y-auto">
                      {favoritesByCity.map(([city, cityMachines]) => (
                        <div key={city}>
                          <div className="sticky top-0 bg-paper px-3 py-1 border-b border-card-border">
                            <p className="text-xs font-semibold text-ink">{city}</p>
                          </div>
                          <ul>
                            {cityMachines.map((m) => (
                              <li
                                key={m.id}
                                onClick={() => { setSelectedMachineId(m.id); setFavDropdownOpen(false) }}
                                className={`px-3 py-2 cursor-pointer transition-colors ${
                                  m.id === selectedMachineId ? 'bg-signal/10' : 'hover:bg-paper'
                                }`}
                              >
                                <p className={`text-sm ${m.id === selectedMachineId ? 'text-signal font-medium' : 'text-ink'}`}>
                                  {m.machine_code} — {m.nickname ?? m.venue}
                                </p>
                                {m.address && <p className="font-mono text-xs text-muted">{m.address}</p>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          ) : (
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
          )}

          {selectedMachineId && (() => {
            const entry = todayByMachine.find((e) => e.machineId === selectedMachineId)
            if (!entry || entry.conditions.length === 0) return null
            return (
              <div className="bg-signal/5 border border-signal/20 rounded-xl p-3 space-y-2">
                <p className="text-xs font-semibold text-signal uppercase tracking-wide">Machine status</p>
                <div className="flex flex-wrap gap-1.5">
                  {entry.conditions.map((c) => (
                    <span key={c.id} className="inline-flex items-center gap-1 font-mono text-[10px] font-medium text-signal bg-signal/10 rounded-full px-2 py-0.5">
                      {c.name} · {c.ago}
                      {c.isOwn && (
                        <button type="button" onClick={() => handleDeleteCondition(c.id)} aria-label="Delete" className="text-signal/60 hover:text-signal">×</button>
                      )}
                    </span>
                  ))}
                </div>
                {entry.conditions.filter((c) => c.note).map((c) => (
                  <div key={`n-${c.id}`} className="flex items-start justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <span className="font-mono text-muted">{c.reporter}: </span>
                      <span className="text-ink">{c.note}</span>
                    </div>
                    {c.isOwn && (
                      <button type="button" onClick={() => handleDeleteCondition(c.id)} className="shrink-0 text-muted hover:text-red-500 transition-colors">Delete</button>
                    )}
                  </div>
                ))}
              </div>
            )
          })()}

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
                type="range" min={0} max={59} step={1} value={minutes}
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

          {selectedMachineId && (
            <div className="border-t border-card-border pt-4">
              <MachineComments machineId={selectedMachineId} userId={userId} />
            </div>
          )}
        </section>
      )}

      {tab === 'activity' && (
        <section className="space-y-3">
          <h2 className="font-display font-semibold text-base">Activity <span className="font-normal text-xs text-muted font-sans">(last 24h)</span></h2>
          {activityByCity.length === 0 ? (
            <p className="text-sm text-muted">No activity logged today.</p>
          ) : (
            <div className="space-y-3">
              {activityByCity.map(([city, entries]) => {
                const collapsed = collapsedCities.has(city)
                return (
                  <div key={city} className="bg-card border border-card-border rounded-2xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleCity(city)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left"
                    >
                      <span className="font-semibold text-sm">{city}</span>
                      <span className="flex items-center gap-2 text-xs text-muted">
                        <span>{entries.length} machine{entries.length !== 1 ? 's' : ''}</span>
                        <svg
                          className={`w-4 h-4 transition-transform ${collapsed ? '' : 'rotate-180'}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </span>
                    </button>

                    {!collapsed && (
                      <div className="border-t border-card-border divide-y divide-card-border max-h-80 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:theme(colors.card-border)_transparent]">
                        {entries.map(({ machineId, machine, reports, conditions }) => (
                          <div key={machineId} className="px-4 py-3 space-y-2">
                            <p className="font-semibold text-sm">
                              <span className="font-mono text-muted">{machine?.machine_code}</span>
                              {' — '}{machine?.nickname ?? machine?.venue}
                            </p>
                            {machine?.address && (
                              <p className="font-mono text-[10px] text-muted -mt-1">{machine.address}</p>
                            )}
                            {conditions.length > 0 && (
                              <div className="space-y-1.5">
                                <div className="flex gap-1.5 flex-wrap">
                                  {conditions.map((c) => (
                                    <span key={c.id} className="inline-flex items-center gap-1 font-mono text-[10px] font-medium text-signal bg-signal/10 rounded-full px-2 py-0.5">
                                      {c.name} · {c.ago}
                                      {c.isOwn && (
                                        <button type="button" onClick={() => handleDeleteCondition(c.id)} aria-label="Delete status update" className="text-signal/60 hover:text-signal">×</button>
                                      )}
                                    </span>
                                  ))}
                                </div>
                                {conditions.filter((c) => c.note).map((c) => (
                                  <div key={`note-${c.id}`} className="flex items-start justify-between gap-2 text-xs pl-1">
                                    <div className="min-w-0">
                                      <span className="font-mono text-muted">{c.reporter}: </span>
                                      <span className="text-ink">{c.note}</span>
                                    </div>
                                    {c.isOwn && (
                                      <button type="button" onClick={() => handleDeleteCondition(c.id)} className="shrink-0 text-muted hover:text-red-500 transition-colors text-[10px]">Delete</button>
                                    )}
                                  </div>
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
                                    note={r.note}
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
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      {tab === 'analytics' && canSeeAnalytics && (
        <TimerAnalytics machineItems={machineItems} favoriteMachines={favoriteMachines} />
      )}
    </div>
  )
}
