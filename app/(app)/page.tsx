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

  const { data: favoriteRows } = await supabase
    .from('machine_favorites')
    .select('machine_id')
    .eq('user_id', userId)

  const favoriteIds = (favoriteRows ?? []).map((f) => f.machine_id)

  const [{ data: favTimers }, { data: favConditions }, { data: myInterests }, { data: recentStockChecks }] =
    await Promise.all([
      favoriteIds.length > 0
        ? supabase
            .from('timer_reports')
            .select('id, minutes, success, reported_at, machines(machine_code, venue, nickname), profiles(username, display_name)')
            .in('machine_id', favoriteIds)
            .gte('reported_at', since.toISOString())
            .order('reported_at', { ascending: false })
            .limit(15)
        : Promise.resolve({ data: [] }),
      favoriteIds.length > 0
        ? supabase
            .from('machine_conditions')
            .select('id, note, created_at, machines(machine_code, venue, nickname), condition_types(name), profiles(username, display_name)')
            .in('machine_id', favoriteIds)
            .gte('created_at', since.toISOString())
            .order('created_at', { ascending: false })
            .limit(15)
        : Promise.resolve({ data: [] }),
      supabase
        .from('product_interest')
        .select('id, note, created_at, products(name, sets(name))')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('stock_checks')
        .select('id, created_at, note, store_locations(label, city, region), product_types(name), profiles(username, display_name)')
        .order('created_at', { ascending: false })
        .limit(8),
    ])

  // Merge favorite timers + conditions into one feed, sorted by time
  type FeedItem =
    | { kind: 'timer'; at: string; minutes: number; success: boolean; machineLabel: string; reporter: string }
    | { kind: 'condition'; at: string; conditionName: string; note: string | null; machineLabel: string; reporter: string }

  const feed: FeedItem[] = [
    ...(favTimers ?? []).map((t) => {
      const machine = one(t.machines)
      const profile = one(t.profiles)
      return {
        kind: 'timer' as const,
        at: t.reported_at,
        minutes: t.minutes,
        success: t.success,
        machineLabel: machine ? `${machine.machine_code} — ${machine.nickname ?? machine.venue}` : '',
        reporter: profile?.display_name ?? profile?.username ?? '?',
      }
    }),
    ...(favConditions ?? []).map((c) => {
      const machine = one(c.machines)
      const condition = one(c.condition_types)
      const profile = one(c.profiles)
      return {
        kind: 'condition' as const,
        at: c.created_at,
        conditionName: condition?.name ?? 'Condition',
        note: c.note,
        machineLabel: machine ? `${machine.machine_code} — ${machine.nickname ?? machine.venue}` : '',
        reporter: profile?.display_name ?? profile?.username ?? '?',
      }
    }),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="font-display font-semibold text-base">Your Favorites</h2>
        {favoriteIds.length === 0 ? (
          <div className="bg-card border border-card-border rounded-xl px-4 py-5 text-center space-y-2">
            <p className="text-sm text-muted">No favorites yet.</p>
            <Link href="/timers" className="text-sm font-medium text-signal underline underline-offset-2">
              Star a machine from Timers
            </Link>
          </div>
        ) : feed.length === 0 ? (
          <p className="text-sm text-muted">No recent activity on your favorited machines.</p>
        ) : (
          <ul className="space-y-2">
            {feed.map((item, i) => (
              <li key={i} className="bg-card border border-card-border rounded-xl px-4 py-3 flex items-start justify-between gap-2">
                {item.kind === 'timer' ? (
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                        item.success ? 'bg-ok/10 text-ok' : 'bg-card-border text-muted'
                      }`}
                    >
                      {item.success ? '✓' : '✗'}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{item.machineLabel}</p>
                      <p className="font-mono text-xs text-muted">
                        :{String(item.minutes).padStart(2, '0')} · {item.reporter}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-signal truncate">{item.conditionName}</p>
                    <p className="text-xs text-muted truncate">{item.machineLabel}</p>
                    {item.note && <p className="text-xs text-muted italic">{item.note}</p>}
                  </div>
                )}
                <span className="font-mono text-xs text-muted shrink-0">{timeAgo(new Date(item.at))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display font-semibold text-base">My Requests</h2>
        {!myInterests?.length ? (
          <p className="text-sm text-muted">Nothing tracked yet. Pick a set to start.</p>
        ) : (
          <ul className="space-y-2">
            {myInterests.map((item) => {
              const product = one(item.products)
              const set = product ? one((product as { sets: unknown }).sets as { name: string } | { name: string }[] | null) : null
              return (
                <li key={item.id} className="bg-card border border-card-border rounded-xl px-4 py-3 space-y-0.5">
                  <p className="font-medium text-sm">{(product as { name: string } | null)?.name}</p>
                  <p className="font-mono text-xs text-muted">{(set as { name: string } | null)?.name}</p>
                  {item.note && <p className="text-xs text-muted italic">{item.note}</p>}
                </li>
              )
            })}
          </ul>
        )}
      </section>

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
