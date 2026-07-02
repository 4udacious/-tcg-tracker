import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? v[0] ?? null : v
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

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id

  const since = new Date()
  since.setHours(since.getHours() - 48)

  // Fetch favorites with machine details (city needed for nearby lookup)
  const { data: favoriteRows } = await supabase
    .from('machine_favorites')
    .select('machine_id, machines(id, machine_code, venue, nickname, address, city, region)')
    .eq('user_id', userId)

  const favMachines = (favoriteRows ?? [])
    .map((f) => one(f.machines as Parameters<typeof one>[0]))
    .filter(Boolean) as { id: string; machine_code: string; venue: string; nickname: string | null; address: string | null; city: string; region: string }[]

  const favoriteIds = favMachines.map((m) => m.id)
  const favCities = [...new Set(favMachines.map((m) => m.city).filter(Boolean))]

  // Fetch nearby machine IDs (same cities, not already favorited)
  let nearbyIds: string[] = []
  if (favCities.length > 0 && favoriteIds.length > 0) {
    const { data: nearbyMachines } = await supabase
      .from('machines')
      .select('id')
      .in('city', favCities)
      .not('id', 'in', `(${favoriteIds.join(',')})`)
      .eq('is_active', true)
    nearbyIds = (nearbyMachines ?? []).map((m) => m.id)
  } else if (favCities.length > 0) {
    const { data: nearbyMachines } = await supabase
      .from('machines')
      .select('id')
      .in('city', favCities)
      .eq('is_active', true)
    nearbyIds = (nearbyMachines ?? []).map((m) => m.id)
  }

  const allMachineIds = [...favoriteIds, ...nearbyIds]

  const [{ data: favTimers }, { data: favConditions }, { data: latestRequests }, { data: recentStockChecks }] =
    await Promise.all([
      allMachineIds.length > 0
        ? supabase
            .from('timer_reports')
            .select('id, machine_id, minutes, success, reported_at, machines(machine_code, venue, nickname, address, city), profiles(username, display_name)')
            .in('machine_id', allMachineIds)
            .eq('success', true)
            .gte('reported_at', since.toISOString())
            .order('reported_at', { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [] }),
      allMachineIds.length > 0
        ? supabase
            .from('machine_conditions')
            .select('id, machine_id, note, created_at, machines(machine_code, venue, nickname, address, city), condition_types(name), profiles(username, display_name)')
            .in('machine_id', allMachineIds)
            .gte('created_at', since.toISOString())
            .order('created_at', { ascending: false })
            .limit(60)
        : Promise.resolve({ data: [] }),
      supabase
        .from('product_interest')
        .select('id, user_id, note, created_at, products(name, sets(name)), profiles(username, display_name)')
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('stock_checks')
        .select('id, created_at, note, store_locations(label, city, region), product_types(name), profiles(username, display_name)')
        .order('created_at', { ascending: false })
        .limit(8),
    ])

  type FeedItem =
    | { kind: 'timer'; at: string; minutes: number; machineLabel: string; machineAddress: string | null; machineCity: string | null; reporter: string; isFavorite: boolean }
    | { kind: 'condition'; at: string; conditionName: string; note: string | null; machineLabel: string; machineAddress: string | null; machineCity: string | null; reporter: string; isFavorite: boolean }

  // Dedupe conditions to latest per machine
  const latestConditionByMachine = new Map<string, NonNullable<typeof favConditions>[number]>()
  for (const c of favConditions ?? []) {
    if (!latestConditionByMachine.has(c.machine_id)) {
      latestConditionByMachine.set(c.machine_id, c)
    }
  }

  const feed: FeedItem[] = [
    ...(favTimers ?? []).map((t) => {
      const machine = one(t.machines)
      const profile = one(t.profiles)
      return {
        kind: 'timer' as const,
        at: t.reported_at,
        minutes: t.minutes,
        machineLabel: machine ? `${machine.machine_code} — ${machine.nickname ?? machine.venue}` : '',
        machineAddress: machine?.address ?? null,
        machineCity: (machine as { city?: string } | null)?.city ?? null,
        reporter: profile?.display_name ?? profile?.username ?? '?',
        isFavorite: favoriteIds.includes(t.machine_id),
      }
    }),
    ...[...latestConditionByMachine.values()].map((c) => {
      const machine = one(c.machines)
      const condition = one(c.condition_types)
      const profile = one(c.profiles)
      return {
        kind: 'condition' as const,
        at: c.created_at,
        conditionName: condition?.name ?? 'Condition',
        note: c.note,
        machineLabel: machine ? `${machine.machine_code} — ${machine.nickname ?? machine.venue}` : '',
        machineAddress: machine?.address ?? null,
        machineCity: (machine as { city?: string } | null)?.city ?? null,
        reporter: profile?.display_name ?? profile?.username ?? '?',
        isFavorite: favoriteIds.includes(c.machine_id),
      }
    }),
  ].sort((a, b) => {
    // Favorites first when timestamps are close, then sort by time
    const timeDiff = new Date(b.at).getTime() - new Date(a.at).getTime()
    if (Math.abs(timeDiff) < 300000 && a.isFavorite !== b.isFavorite) {
      return a.isFavorite ? -1 : 1
    }
    return timeDiff
  })

  return (
    <div className="space-y-6">
      {/* Favorites feed */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-base">Favorites &amp; Nearby</h2>
          {feed.length > 0 && (
            <span className="text-xs text-muted">Last 48h</span>
          )}
        </div>
        {favoriteIds.length === 0 ? (
          <div className="bg-card border border-card-border rounded-xl px-4 py-5 text-center space-y-2">
            <p className="text-sm text-muted">No favorites yet.</p>
            <Link href="/timers" className="text-sm font-medium text-signal underline underline-offset-2">
              Star a machine from Timers
            </Link>
          </div>
        ) : feed.length === 0 ? (
          <p className="text-sm text-muted">No recent activity on your favorited machines or nearby.</p>
        ) : (
          <div className="bg-card border border-card-border rounded-2xl overflow-hidden relative">
            {/* Fade hint at bottom when content overflows */}
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-card to-transparent z-10 rounded-b-2xl" />
            <ul className="divide-y divide-card-border max-h-72 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:theme(colors.card-border)_transparent]">
              {feed.map((item, i) => (
                <li key={i} className="px-4 py-3 flex items-start justify-between gap-2">
                  {item.kind === 'timer' ? (
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs bg-ok/10 text-ok">
                        ✓
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="font-medium text-sm truncate">{item.machineLabel}</p>
                          {!item.isFavorite && item.machineCity && (
                            <span className="shrink-0 text-[10px] font-mono text-muted bg-paper rounded-full px-1.5 py-0.5">nearby</span>
                          )}
                        </div>
                        {item.machineAddress && (
                          <p className="font-mono text-[10px] text-muted truncate">{item.machineAddress}</p>
                        )}
                        <p className="font-mono text-xs text-muted">
                          :{String(item.minutes).padStart(2, '0')} · {item.reporter}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="font-medium text-sm text-signal truncate">{item.conditionName}</p>
                        {!item.isFavorite && item.machineCity && (
                          <span className="shrink-0 text-[10px] font-mono text-muted bg-paper rounded-full px-1.5 py-0.5">nearby</span>
                        )}
                      </div>
                      <p className="text-xs text-muted truncate">{item.machineLabel}</p>
                      {item.machineAddress && (
                        <p className="font-mono text-[10px] text-muted truncate">{item.machineAddress}</p>
                      )}
                      {item.note && <p className="text-xs text-muted italic">{item.note}</p>}
                    </div>
                  )}
                  <div className="shrink-0 text-right space-y-0.5">
                    <span className="font-mono text-xs text-muted">{timeAgo(new Date(item.at))}</span>
                    <p className="text-[10px] text-muted">{item.reporter}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Latest Requests */}
      <section className="space-y-3">
        <h2 className="font-display font-semibold text-base">Latest Requests</h2>
        {!latestRequests?.length ? (
          <p className="text-sm text-muted">No requests yet. Add one from the Interest tracker.</p>
        ) : (
          <ul className="space-y-2">
            {latestRequests.map((item) => {
              const product = one(item.products)
              const set = product ? one((product as { sets: unknown }).sets as { name: string } | { name: string }[] | null) : null
              const profile = one(item.profiles as { username: string; display_name?: string } | { username: string; display_name?: string }[] | null)
              const isOwn = item.user_id === userId
              return (
                <li key={item.id} className="bg-card border border-card-border rounded-xl px-4 py-3 flex items-start justify-between gap-2">
                  <div className="space-y-0.5 min-w-0">
                    <p className="font-medium text-sm truncate">{(product as { name: string } | null)?.name}</p>
                    <p className="font-mono text-xs text-muted">{(set as { name: string } | null)?.name}</p>
                    {item.note && <p className="text-xs text-muted italic">{item.note}</p>}
                  </div>
                  <div className="shrink-0 text-right space-y-0.5">
                    <p className="font-mono text-xs text-muted">{timeAgo(new Date(item.created_at))}</p>
                    {profile && !isOwn && (
                      <p className="text-[10px] text-muted">{profile.display_name ?? profile.username}</p>
                    )}
                    {isOwn && (
                      <p className="text-[10px] text-signal font-medium">you</p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Recent Sightings */}
      <section className="space-y-3">
        <h2 className="font-display font-semibold text-base">Recent Sightings</h2>
        {!recentStockChecks?.length ? (
          <p className="text-sm text-muted">No recent stock reports.</p>
        ) : (
          <ul className="space-y-2">
            {recentStockChecks.map((check) => {
              const store = one(check.store_locations)
              const type = one(check.product_types)
              const reporter = one(check.profiles)
              return (
                <li key={check.id} className="bg-card border border-card-border rounded-xl px-4 py-3 flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <p className="font-medium text-sm">{(type as { name: string } | null)?.name}</p>
                    <p className="font-mono text-xs text-muted">
                      {(store as { city: string; region: string; label: string } | null)?.city} — {(store as { city: string; region: string; label: string } | null)?.label}
                    </p>
                    {check.note && <p className="text-xs text-muted italic">{check.note}</p>}
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <p className="font-mono text-xs text-muted">{timeAgo(new Date(check.created_at))}</p>
                    <p className="text-xs text-muted">{(reporter as { display_name?: string; username: string } | null)?.display_name ?? (reporter as { display_name?: string; username: string } | null)?.username}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
