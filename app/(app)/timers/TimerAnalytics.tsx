'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import LocationSearch, { type LocationItem } from '@/components/LocationSearch'
import type { FavoriteMachine } from '@/components/FavoritesQuickPick'

interface Report {
  machine_id: string
  minutes: number
  success: boolean
  reported_at: string
}

interface Props {
  machineItems: LocationItem[]
  favoriteMachines: FavoriteMachine[]
  maxDays?: number
}

const CONTRIBUTOR_WINDOWS = [1, 3, 5] as const
const MEMBER_WINDOWS = [3, 7, 14, 21] as const

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dateLabel(key: string, today: string, yesterday: string): string {
  if (key === today) return 'Today'
  if (key === yesterday) return 'Yesterday'
  const d = new Date(key + 'T00:00:00')
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function TimerAnalytics({ machineItems, favoriteMachines, maxDays }: Props) {
  const windows = maxDays != null ? CONTRIBUTOR_WINDOWS : MEMBER_WINDOWS
  const defaultDays = maxDays != null ? 1 : 7

  const [scope, setScope] = useState<'favorites' | 'single'>('favorites')
  const [singleMachineId, setSingleMachineId] = useState<string | null>(null)
  const [windowDays, setWindowDays] = useState(defaultDays)
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedKeys, setExpandedKeys] = useState<globalThis.Set<string>>(new globalThis.Set())

  function toggleKey(key: string) {
    setExpandedKeys((prev) => {
      const next = new globalThis.Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const machineIds = useMemo(() => {
    if (scope === 'single') return singleMachineId ? [singleMachineId] : []
    return favoriteMachines.map((m) => m.id)
  }, [scope, singleMachineId, favoriteMachines])

  useEffect(() => {
    if (machineIds.length === 0) { setReports([]); return }
    let cancelled = false
    setLoading(true)
    const supabase = createClient()
    const since = new Date()
    const effectiveDays = maxDays != null ? Math.min(windowDays, maxDays) : windowDays
    since.setDate(since.getDate() - effectiveDays)
    supabase
      .from('timer_reports')
      .select('machine_id, minutes, success, reported_at')
      .in('machine_id', machineIds)
      .gte('reported_at', since.toISOString())
      .order('reported_at', { ascending: false })
      .then(({ data }) => {
        if (!cancelled) { setReports(data ?? []); setLoading(false) }
      })
    return () => { cancelled = true }
  }, [machineIds, windowDays])

  const byMachine = useMemo(() => {
    const now = new Date()
    const today = dateKey(now)
    const y = new Date(now)
    y.setDate(y.getDate() - 1)
    const yesterday = dateKey(y)

    const map = new Map<string, Report[]>()
    for (const r of reports) {
      if (!map.has(r.machine_id)) map.set(r.machine_id, [])
      map.get(r.machine_id)!.push(r)
    }

    return [...map.entries()].map(([machineId, list]) => {
      const machine = machineItems.find((m) => m.id === machineId)
      const dateMap = new Map<string, { hits: Report[]; misses: Report[] }>()
      for (const r of list) {
        const key = dateKey(new Date(r.reported_at))
        if (!dateMap.has(key)) dateMap.set(key, { hits: [], misses: [] })
        const bucket = dateMap.get(key)!
        if (r.success) bucket.hits.push(r)
        else bucket.misses.push(r)
      }
      const dateRows = [...dateMap.entries()]
        .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
        .map(([key, { hits, misses }]) => ({
          key,
          label: dateLabel(key, today, yesterday),
          hits,
          misses,
        }))
      return {
        machineId,
        machine,
        totalHits: list.filter((r) => r.success).length,
        totalMisses: list.filter((r) => !r.success).length,
        dateRows,
      }
    })
  }, [reports, machineItems])

  return (
    <div className="space-y-4">
      <section className="bg-card border border-card-border rounded-2xl p-4 space-y-4">
        <div className="flex gap-2">
          <button
            onClick={() => setScope('favorites')}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              scope === 'favorites' ? 'bg-ink text-white' : 'bg-paper border border-card-border text-ink'
            }`}
          >
            My Favorites
          </button>
          <button
            onClick={() => setScope('single')}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              scope === 'single' ? 'bg-ink text-white' : 'bg-paper border border-card-border text-ink'
            }`}
          >
            Single Machine
          </button>
        </div>

        {scope === 'single' && (
          <LocationSearch
            items={machineItems}
            value={singleMachineId}
            onChange={setSingleMachineId}
            placeholder="Search for a machine…"
          />
        )}

        <div className="flex gap-2">
          {windows.map((d) => (
            <button
              key={d}
              onClick={() => setWindowDays(d)}
              className={`flex-1 rounded-lg py-1.5 text-sm font-mono font-medium transition-colors ${
                windowDays === d ? 'bg-signal text-white' : 'bg-paper border border-card-border text-ink'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : machineIds.length === 0 ? (
        <p className="text-sm text-muted">
          {scope === 'favorites' ? 'No favorited machines yet. Star one from the Log tab.' : 'Pick a machine to see its history.'}
        </p>
      ) : byMachine.length === 0 ? (
        <p className="text-sm text-muted">No attempts logged in this window.</p>
      ) : (
        <div className="space-y-4">
          {byMachine.map(({ machineId, machine, totalHits, totalMisses, dateRows }) => (
            <div key={machineId} className="bg-card border border-card-border rounded-2xl overflow-hidden">
              <div className="px-4 py-2.5 bg-ink flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm text-white truncate">{machine?.primary ?? machineId}</p>
                  {machine?.secondary && (
                    <p className="font-mono text-[10px] text-white/50 truncate">{machine.secondary}</p>
                  )}
                </div>
                <span className="font-mono text-xs text-white/60 shrink-0">
                  <span className="text-ok">{totalHits}✓</span> / <span className="text-white/40">{totalMisses}✗</span>
                </span>
              </div>

              <div className="divide-y divide-card-border">
                {dateRows.map((row) => {
                  const rowKey = `${machineId}:${row.key}`
                  const isOpen = expandedKeys.has(rowKey)
                  const allEntries = [
                    ...row.hits.map((r) => ({ ...r, success: true })),
                    ...row.misses.map((r) => ({ ...r, success: false })),
                  ].sort((a, b) => a.minutes - b.minutes)

                  return (
                    <div key={row.key}>
                      <button
                        onClick={() => toggleKey(rowKey)}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-paper transition-colors text-left"
                      >
                        <span className="font-mono text-sm">{row.label}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs">
                            <span className="text-ok">{row.hits.length}✓</span>
                            {' '}
                            <span className="text-muted">{row.misses.length}✗</span>
                          </span>
                          <svg
                            className={`w-4 h-4 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                          </svg>
                        </div>
                      </button>

                      {isOpen && (
                        <div className="bg-paper border-t border-card-border px-4 py-2 space-y-1">
                          {allEntries.length === 0 ? (
                            <p className="text-xs text-muted py-1">No entries.</p>
                          ) : (
                            allEntries.map((entry, i) => (
                              <div key={i} className="flex items-center gap-2 py-1">
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                  entry.success ? 'bg-ok/10 text-ok' : 'bg-ink/10 text-muted'
                                }`}>
                                  {entry.success ? '✓' : '✗'}
                                </span>
                                <span className="font-mono text-sm font-semibold">
                                  :{String(entry.minutes).padStart(2, '0')}
                                </span>
                                <span className={`text-xs font-medium ${entry.success ? 'text-ok' : 'text-muted'}`}>
                                  {entry.success ? 'Hit' : 'Miss'}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
