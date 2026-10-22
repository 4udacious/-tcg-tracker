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
import { useToast } from '@/components/ui/Toast'

interface Machine {
  id: string
  machine_code: string
  region: string
  city: string
  neighborhood: string | null
  venue: string
  address: string | null
  nickname: string | null
  latitude: number | null
  longitude: number | null
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

export interface RewardStatus {
  earned: number
  cap: number
  per_report: number
  balance: number
}

interface Props {
  machines: Machine[]
  favorites: FavoriteRow[]
  conditionTypes: ConditionType[]
  todayReports: TodayReport[]
  todayConditions: TodayCondition[]
  userId: string
  role: string
  reward: RewardStatus | null
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

// Straight-line distance in miles between two lat/long points (haversine).
function milesBetween(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLon = (lon2 - lon1) * rad
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2
  return 3958.8 * 2 * Math.asin(Math.sqrt(a))
}

function formatMiles(mi: number): string {
  if (mi < 0.1) return `${Math.max(10, Math.round((mi * 5280) / 10) * 10)} ft`
  return `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi`
}

// Past this, the closest mapped machine probably isn't the one they're at.
const NEAR_ENOUGH_MILES = 0.5

export default function TimersClient({ machines, favorites, conditionTypes, todayReports, todayConditions, userId, role, reward }: Props) {
  const [rewardState, setRewardState] = useState<RewardStatus | null>(reward)
  const router = useRouter()
  const [, startTransition] = useTransition()

  const isContributor = role === 'contributor'
  const visibleTabs = ['log', 'activity', 'analytics'] as const

  const [tab, setTab] = useState<'log' | 'activity' | 'analytics'>('log')
  const [logTab, setLogTab] = useState<'favorites' | 'search'>('favorites')
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null)

  // Restore last selected machine from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`tcg_last_machine_${userId}`)
      if (!stored) return
      if (!machines.some((m) => m.id === stored)) return
      setSelectedMachineId(stored)
      if (!favorites.some((f) => f.machine_id === stored)) setLogTab('search')
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist to localStorage whenever the selected machine changes
  useEffect(() => {
    if (!selectedMachineId) return
    try {
      localStorage.setItem(`tcg_last_machine_${userId}`, selectedMachineId)
    } catch {}
  }, [selectedMachineId, userId])
  const [minutes, setMinutes] = useState(() => new Date().getMinutes())
  const [outcome, setOutcome] = useState<'hit' | 'miss' | null>(null)
  const [selectedConditions, setSelectedConditions] = useState<string[]>([])
  const [conditionNote, setConditionNote] = useState('')
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(
    new Set(favorites.map((f) => f.machine_id))
  )
  const [collapsedCities, setCollapsedCities] = useState<Set<string>>(new Set())
  const [removedFavIds, setRemovedFavIds] = useState<Set<string>>(new Set())
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
  const toast = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // "Near me": the closest machines that have a map location, nearest first.
  const [locating, setLocating] = useState(false)
  const [nearby, setNearby] = useState<{ machine: Machine; miles: number }[] | null>(null)
  const [locateError, setLocateError] = useState<string | null>(null)
  // Where the user is, once known: every list then shows (and sorts by) distance.
  const [here, setHere] = useState<{ lat: number; lon: number } | null>(null)
  const mapped = useMemo(() => machines.filter((m) => m.latitude != null && m.longitude != null), [machines])
  const milesTo = useMemo(() => {
    const byId = new Map<string, number>()
    if (here) for (const m of mapped) byId.set(m.id, milesBetween(here.lat, here.lon, Number(m.latitude), Number(m.longitude)))
    return (id: string | undefined) => (id ? byId.get(id) : undefined)
  }, [here, mapped])

  // Shows a machine in whichever picker holds it: favorites if it's starred, else search.
  function pickMachine(id: string) {
    setLogTab(favoriteIds.has(id) && !removedFavIds.has(id) ? 'favorites' : 'search')
    setSelectedMachineId(id)
  }

  /**
   * Finds the user and lists the 3 closest machines. Tapped, it selects the
   * nearest. On opening the page (`auto`), it only selects one they're
   * standing at (within NEAR_ENOUGH_MILES), keeps quiet about failures, and
   * otherwise leaves their last machine selected.
   */
  function findNearMe(auto = false) {
    setLocateError(null)
    if (!('geolocation' in navigator)) {
      if (!auto) setLocateError("This browser can't share your location. Use Search instead.")
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false)
        setHere({ lat: coords.latitude, lon: coords.longitude })
        const ranked = mapped
          .map((m) => ({ machine: m, miles: milesBetween(coords.latitude, coords.longitude, Number(m.latitude), Number(m.longitude)) }))
          .sort((a, b) => a.miles - b.miles)
          .slice(0, 3)
        if (ranked.length === 0) { if (!auto) setLocateError('No machines have a map location yet. Use Search instead.'); return }
        setNearby(ranked)
        if (!auto || ranked[0].miles <= NEAR_ENOUGH_MILES) pickMachine(ranked[0].machine.id)
      },
      (err) => {
        setLocating(false)
        if (auto) return
        setLocateError(err.code === err.PERMISSION_DENIED
          ? 'Location is blocked for this site. Allow it in your browser settings, or use Search.'
          : "Couldn't find your location. Try again, or use Search.")
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    )
  }

  // On opening Timers: find the user straight away, unless they've blocked location for the site.
  useEffect(() => {
    let cancelled = false
    const go = () => { if (!cancelled) findNearMe(true) }
    const perms = (navigator as Navigator & { permissions?: Permissions }).permissions
    if (perms?.query) perms.query({ name: 'geolocation' as PermissionName }).then((p) => { if (p.state !== 'denied') go() }, go)
    else go()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const machineItems: LocationItem[] = useMemo(
    () =>
      machines.map((m) => ({
        id: m.id,
        primary: `${m.machine_code} — ${m.venue}${m.nickname ? ` (${m.nickname})` : ''}, ${m.city}`,
        secondary: m.address ?? undefined,
        region: m.region,
        city: m.city,
        searchText: [m.region, m.city, m.neighborhood, m.venue, m.address, m.nickname, m.machine_code].filter(Boolean).join(' '),
        miles: milesTo(m.id),
        distance: milesTo(m.id) != null ? formatMiles(milesTo(m.id)!) : undefined,
      })),
    [machines, milesTo]
  )

  // Favorites removed in this session drop out immediately, without waiting
  // for the server data to come back around.
  const favoriteMachines: FavoriteMachine[] = useMemo(
    () =>
      favorites
        .map((f) => one(f.machines))
        .filter((m): m is FavoriteMachine => m !== null)
        .filter((m) => !removedFavIds.has(m.id)),
    [favorites, removedFavIds]
  )

  // Group favorites by city for the dropdown: alphabetical, or nearest first once the user's location is known.
  const favoritesByCity = useMemo(() => {
    const map = new Map<string, FavoriteMachine[]>()
    for (const m of favoriteMachines) {
      const city = m.city ?? 'Other'
      if (!map.has(city)) map.set(city, [])
      map.get(city)!.push(m)
    }
    const groups = [...map.entries()]
    if (!here) return groups.sort((a, b) => a[0].localeCompare(b[0]))
    const mi = (m: FavoriteMachine) => milesTo(m.id) ?? Infinity
    for (const [, list] of groups) list.sort((a, b) => mi(a) - mi(b))
    return groups.sort((a, b) => mi(a[1][0]) - mi(b[1][0]) || a[0].localeCompare(b[0]))
  }, [favoriteMachines, here, milesTo])

  const showToast = (msg: string, ok: boolean) => toast.show(msg, ok ? 'ok' : 'info')

  async function handleRemoveFavorite(machineId: string, label: string) {
    const supabase = createClient()
    const { error } = await supabase
      .from('machine_favorites')
      .delete()
      .eq('user_id', userId)
      .eq('machine_id', machineId)
    if (error) {
      showToast('Failed to remove favorite.', false)
      return
    }
    setRemovedFavIds((prev) => new Set(prev).add(machineId))
    setFavoriteIds((prev) => {
      const next = new Set(prev)
      next.delete(machineId)
      return next
    })
    // The machine is no longer in this list, so a stale selection would show
    // as "Select a favorite…" with the form still armed. Clear it instead.
    if (selectedMachineId === machineId) setSelectedMachineId(null)
    showToast(`Removed ${label} from favorites.`, true)
    startTransition(() => router.refresh())
  }

  function resetForm() {
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
    // The token is awarded by a trigger on the insert, so read the status
    // back rather than assuming - it may have been capped.
    const { data: rw } = await supabase.rpc('timer_reward_status')
    const next = (Array.isArray(rw) ? rw[0] : rw) as RewardStatus | null
    const gained = next && rewardState ? next.earned - rewardState.earned : 0
    if (next) setRewardState(next)

    if (gained > 0) {
      showToast(`Timer logged. +${gained} token${gained === 1 ? '' : 's'}.`, true)
    } else if (next && next.per_report > 0 && next.earned >= next.cap) {
      showToast(`Timer logged. Monthly token cap reached (${next.cap}).`, true)
    } else {
      showToast('Timer logged.', true)
    }

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
    const earning = !!rewardState && rewardState.per_report > 0
    if (!window.confirm(
      earning
        ? 'Delete this timer report?\n\nThe token it earned will be taken back, and your balance can go negative.'
        : 'Delete this timer report?'
    )) return
    const supabase = createClient()
    // Belt-and-braces: even if RLS DELETE USING doesn't scope to auth.uid(), this
    // client-side user_id filter means the mutation refuses to touch other users' rows.
    const { error } = await supabase.from('timer_reports').delete().eq('id', id).eq('user_id', userId)
    if (error) { showToast('Failed to delete.', false); return }

    // The token is taken back by a trigger on the delete, so read the status
    // back rather than assuming one was.
    const { data: rw } = await supabase.rpc('timer_reward_status')
    const next = (Array.isArray(rw) ? rw[0] : rw) as RewardStatus | null
    const lost = next && rewardState ? rewardState.earned - next.earned : 0
    if (next) setRewardState(next)

    showToast(
      lost > 0
        ? `Timer deleted. ${lost} token${lost === 1 ? '' : 's'} taken back.`
        : 'Timer deleted.',
      true
    )
    startTransition(() => router.refresh())
  }

  async function handleDeleteCondition(id: string) {
    if (!window.confirm('Delete this status update?')) return
    const supabase = createClient()
    // Belt-and-braces (see handleDeleteReport).
    const { error } = await supabase.from('machine_conditions').delete().eq('id', id).eq('user_id', userId)
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
    const groups = [...map.entries()]
    if (!here) return groups.sort((a, b) => a[0].localeCompare(b[0]))
    const nearest = (entries: typeof todayByMachine) => Math.min(Infinity, ...entries.map((e) => milesTo(e.machineId) ?? Infinity))
    return groups.sort((a, b) => nearest(a[1]) - nearest(b[1]) || a[0].localeCompare(b[0]))
  }, [todayByMachine, here, milesTo])

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
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display font-semibold text-base">Log timer</h2>
            {rewardState && rewardState.per_report > 0 && (
              <span
                className={`font-mono text-[10px] ${
                  rewardState.earned >= rewardState.cap ? 'text-muted' : 'text-signal'
                }`}
                title="Tokens earned from timer reports this month"
              >
                {rewardState.earned >= rewardState.cap
                  ? `token cap reached ${rewardState.earned}/${rewardState.cap}`
                  : `${rewardState.earned}/${rewardState.cap} tokens earned`}
              </span>
            )}
          </div>
          {rewardState && rewardState.per_report > 0 && rewardState.earned < rewardState.cap && (
            <p className="text-xs text-muted -mt-2">
              Every timer you log earns {rewardState.per_report} token
              {rewardState.per_report === 1 ? '' : 's'} — hit or miss.
            </p>
          )}

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

          {/* Near me: picks the closest machine, for ones you haven't starred. */}
          {nearby ? (
            <div className="rounded-xl border border-card-border bg-paper p-2 space-y-1">
              <div className="flex items-center justify-between px-1">
                <p className="text-xs font-semibold text-ink">Closest to you</p>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => findNearMe()} disabled={locating}
                    className="min-h-8 px-2 rounded-lg text-xs font-medium text-signal hover:bg-signal/10 disabled:opacity-50">
                    {locating ? 'Locating…' : 'Refresh'}
                  </button>
                  <button type="button" onClick={() => setNearby(null)} aria-label="Close nearby list"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-ink hover:bg-card">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <ul className="space-y-1">
                {nearby.map(({ machine: m, miles }) => {
                  const on = m.id === selectedMachineId
                  return (
                    <li key={m.id}>
                      <button type="button" onClick={() => pickMachine(m.id)} aria-pressed={on}
                        className={`w-full flex items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors ${on ? 'bg-signal/10' : 'hover:bg-card'}`}>
                        <span className="flex-1 min-w-0">
                          <span className={`block text-sm truncate ${on ? 'text-signal font-medium' : 'text-ink'}`}>
                            {m.machine_code} — {m.nickname ?? m.venue}
                          </span>
                          {m.address && <span className="block font-mono text-[10px] text-muted truncate">{m.address}</span>}
                        </span>
                        <span className="shrink-0 font-mono text-xs text-muted">{formatMiles(miles)}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              <p className="px-1 pt-1 text-[11px] text-muted leading-snug">
                {nearby[0].miles > NEAR_ENOUGH_MILES ? 'None of these close by? ' : 'Not here? '}
                {`Only ${mapped.length} of ${machines.length} machines have a map location so far. If yours isn't listed, use Search.`}
              </p>
            </div>
          ) : (
            <button type="button" onClick={() => findNearMe()} disabled={locating}
              className="w-full flex items-center justify-center gap-1.5 min-h-10 rounded-xl border border-signal/30 bg-signal/5 hover:bg-signal/10 text-signal text-sm font-semibold transition-colors disabled:opacity-60">
              <svg className={`w-4 h-4 ${locating ? 'animate-pulse' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              {locating ? 'Finding your location…' : 'Find the machine near me'}
            </button>
          )}
          {locateError && <p role="alert" className="text-xs text-red-600 -mt-2">{locateError}</p>}

          {logTab === 'favorites' ? (
            favoriteMachines.length === 0 ? (
              <div className="text-center py-4 space-y-3">
                <p className="text-sm text-ink font-medium">No favorites yet</p>
                <p className="text-xs text-muted">Use the Search tab to find a machine, then tap the star to save it here.</p>
                <button
                  onClick={() => { setLogTab('search'); setSelectedMachineId(null) }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-signal border border-signal/30 bg-signal/5 hover:bg-signal/10 rounded-lg px-3 py-1.5 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
                  </svg>
                  Go to Search
                </button>
              </div>
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
                                className={`flex items-center gap-2 transition-colors ${
                                  m.id === selectedMachineId ? 'bg-signal/10' : 'hover:bg-paper'
                                }`}
                              >
                                <div
                                  onClick={() => { setSelectedMachineId(m.id); setFavDropdownOpen(false) }}
                                  className="flex-1 min-w-0 px-3 py-2 cursor-pointer"
                                >
                                  <div className="flex items-baseline justify-between gap-2">
                                    <p className={`text-sm min-w-0 ${m.id === selectedMachineId ? 'text-signal font-medium' : 'text-ink'}`}>
                                      {m.machine_code} — {m.nickname ?? m.venue}
                                    </p>
                                    {milesTo(m.id) != null && <span className="shrink-0 font-mono text-[10px] text-muted">{formatMiles(milesTo(m.id)!)}</span>}
                                  </div>
                                  {m.address && <p className="font-mono text-xs text-muted">{m.address}</p>}
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleRemoveFavorite(m.id, `${m.machine_code} — ${m.nickname ?? m.venue}`)
                                  }}
                                  aria-label={`Remove ${m.machine_code} from favorites`}
                                  title="Remove from favorites"
                                  className="shrink-0 mr-2 w-7 h-7 rounded-full flex items-center justify-center text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                >
                                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                                    <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                                  </svg>
                                </button>
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
                  nearestFirst={!!here}
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

          <button
            onClick={handleLogTimer}
            disabled={!selectedMachineId || outcome === null || isSubmitting}
            className="w-full bg-signal hover:bg-signal/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-2.5 text-sm transition-colors"
          >
            Log timer
          </button>

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
                            <div className="flex items-baseline justify-between gap-2">
                              <p className="font-semibold text-sm min-w-0">
                                <span className="font-mono text-muted">{machine?.machine_code}</span>
                                {' — '}{machine?.nickname ?? machine?.venue}
                              </p>
                              {milesTo(machineId) != null && <span className="shrink-0 font-mono text-[10px] text-muted">{formatMiles(milesTo(machineId)!)}</span>}
                            </div>
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

      {tab === 'analytics' && (
        <TimerAnalytics machineItems={machineItems} favoriteMachines={favoriteMachines} maxDays={isContributor ? 1 : undefined} />
      )}
    </div>
  )
}
