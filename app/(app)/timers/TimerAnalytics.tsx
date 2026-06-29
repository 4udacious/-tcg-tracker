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
    const map = new Map<string, Report[]>()
    for (const r of reports) {
      if (!map.has(r.machine_id)) map.set(r.machine_id, [])
      map.get(r.machine_id)!.push(r)
    }
    return [...map.entries()].map(([machineId, list]) => {
      const machine = machineItems.find((m) => m.id === machineId)
      const tally = new Map<number, { hits: number; misses: number }>()
      for (const r of list) {
        if (!tally.has(r.minutes)) tally.set(r.minutes, { hits: 0, misses: 0 })
        const t = tally.get(r.minutes)!
        if (r.success) t.hits++
        else t.misses++
      }
      const minuteRows = [...tally.entries()].sort((a, b) => a[0] - b[0])
      return { machineId, machine, totalHits: list.filter((r) => r.success).length, totalMisses: list.filter((r) => !r.success).length, minuteRows }
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
          {byMachine.map(({ machineId, machine, totalHits, totalMisses, minuteRows }) => (
            <div key={machineId} className="bg-card border border-card-border rounded-2xl overflow-hidden">
              <div className="px-4 py-2.5 bg-ink flex items-center justify-between">
                <span className="font-medium text-sm text-white truncate">{machine?.primary ?? machineId}</span>
                <span className="font-mono text-xs text-white/60 shrink-0">
                  <span className="text-ok">{totalHits}✓</span> / <span className="text-white/40">{totalMisses}✗</span>
                </span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="px-4 py-2 font-medium">Minute</th>
                    <th className="px-4 py-2 font-medium text-right">Hits</th>
                    <th className="px-4 py-2 font-medium text-right">Misses</th>
                  </tr>
                </thead>
                <tbody>
                  {minuteRows.map(([minute, t]) => (
                    <tr key={minute} className="border-t border-card-border">
                      <td className="px-4 py-2 font-mono">:{String(minute).padStart(2, '0')}</td>
                      <td className="px-4 py-2 text-right font-mono text-ok">{t.hits || ''}</td>
                      <td className="px-4 py-2 text-right font-mono text-muted">{t.misses || ''}</td>
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
