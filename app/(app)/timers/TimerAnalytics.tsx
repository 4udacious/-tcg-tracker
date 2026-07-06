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
}

const WINDOWS = [3, 5, 7] as const

// yyyy-mm-dd in the browser's local timezone. Used as a stable Map key AND as the
// input to dateLabel — matching keys is a plain string compare.
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// "Today" / "Yesterday" for the two most recent days, else "Mon Jun 22"-style short form.
function dateLabel(key: string, today: string, yesterday: string): string {
  if (key === today) return 'Today'
  if (key === yesterday) return 'Yesterday'
  // Parse as local midnight so toLocaleDateString reflects the same day the key means.
  const d = new Date(key + 'T00:00:00')
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function TimerAnalytics({ machineItems, favoriteMachines }: Props) {
  const [scope, setScope] = useState<'favorites' | 'single'>('favorites')
  const [singleMachineId, setSingleMachineId] = useState<string | null>(null)
  const [windowDays, setWindowDays] = useState<3 | 5 | 7>(5)
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(false)

  const machineIds = useMemo(() => {
    if (scope === 'single') return singleMachineId ? [singleMachineId] : []
    return favoriteMachines.map((m) => m.id)
  }, [scope, singleMachineId, favoriteMachines])

  useEffect(() => {
    if (machineIds.length === 0) {
      setReports([])
      return
    }
    let cancelled = false
    setLoading(true)
    const supabase = createClient()
    const since = new Date()
    since.setDate(since.getDate() - windowDays)
    supabase
      .from('timer_reports')
      .select('machine_id, minutes, success, reported_at')
      .in('machine_id', machineIds)
      .gte('reported_at', since.toISOString())
      .order('reported_at', { ascending: false })
      .then(({ data }) => {
        if (!cancelled) {
          setReports(data ?? [])
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [machineIds, windowDays])

  const byMachine = useMemo(() => {
    // yyyy-mm-dd in the browser's local timezone — sortable and unambiguous.
    // Compute today/yesterday once per memo run so all rows share the same
    // "today" reference (no drift if the memo re-runs across midnight).
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
      const tally = new Map<string, { hits: number; misses: number }>()
      for (const r of list) {
        const key = dateKey(new Date(r.reported_at))
        if (!tally.has(key)) tally.set(key, { hits: 0, misses: 0 })
        const t = tally.get(key)!
        if (r.success) t.hits++
        else t.misses++
      }
      // Sort descending (newest first) — matches how users think about history.
      const dateRows = [...tally.entries()]
        .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
        .map(([key, t]) => ({ key, label: dateLabel(key, today, yesterday), ...t }))
      return { machineId, machine, totalHits: list.filter((r) => r.success).length, totalMisses: list.filter((r) => !r.success).length, dateRows }
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
          {WINDOWS.map((d) => (
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
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium text-right">Hits</th>
                    <th className="px-4 py-2 font-medium text-right">Misses</th>
                  </tr>
                </thead>
                <tbody>
                  {dateRows.map((row) => (
                    <tr key={row.key} className="border-t border-card-border">
                      <td className="px-4 py-2 font-mono">{row.label}</td>
                      <td className="px-4 py-2 text-right font-mono text-ok">{row.hits || ''}</td>
                      <td className="px-4 py-2 text-right font-mono text-muted">{row.misses || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
