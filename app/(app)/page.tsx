import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // My current interests
  const { data: myInterests } = await supabase
    .from('product_interest')
    .select('id, note, created_at, products(name, sets(name))')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  // Recent stock checks (last 24h)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: recentStock } = await supabase
    .from('stock_checks')
    .select('id, created_at, note, store_locations(label, area), product_types(name), profiles(username)')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(5)

  // Recent timer hits (today)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const { data: recentHits } = await supabase
    .from('timer_reports')
    .select('id, minutes, success, reported_at, machines(machine_code, venue, nickname), profiles(username)')
    .gte('reported_at', todayStart.toISOString())
    .eq('success', true)
    .order('reported_at', { ascending: false })
    .limit(5)

  return (
    <div className="space-y-6">
      {/* My Tracked */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
            My Tracking
          </h2>
          <Link href="/interest" className="text-xs text-[var(--signal)] font-medium hover:underline">
            View all →
          </Link>
        </div>
        {myInterests && myInterests.length > 0 ? (
          <ul className="space-y-2">
            {myInterests.map((item: any) => (
              <li key={item.id} className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl px-4 py-3">
                <p className="text-sm font-medium text-[var(--ink)]">{item.products?.name}</p>
                <p className="text-xs text-[var(--muted)] mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>
                  {item.products?.sets?.name}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState href="/interest" cta="Pick a set to start tracking">
            Nothing tracked yet.
          </EmptyState>
        )}
      </section>

      {/* Recent Stock Activity */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
            Recent Stock
          </h2>
          <Link href="/stock" className="text-xs text-[var(--signal)] font-medium hover:underline">
            Report →
          </Link>
        </div>
        {recentStock && recentStock.length > 0 ? (
          <ul className="space-y-2">
            {recentStock.map((check: any) => {
              const isRecent = Date.now() - new Date(check.created_at).getTime() < 60 * 60 * 1000
              return (
                <li
                  key={check.id}
                  className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl px-4 py-3 flex items-start gap-3"
                >
                  {isRecent && (
                    <span className="mt-0.5 w-2 h-2 rounded-full bg-[var(--signal)] shrink-0 amber-pulse" aria-hidden />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--ink)] truncate">
                      {(check.store_locations as any)?.label} · {(check.product_types as any)?.name}
                    </p>
                    <p className="text-xs text-[var(--muted)] mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>
                      {(check.profiles as any)?.username} · {timeAgo(check.created_at)}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState href="/stock" cta="Report stock when you spot product">
            No check-ins in the last 24h.
          </EmptyState>
        )}
      </section>

      {/* Today's Timer Hits */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
            Timer Hits Today
          </h2>
          <Link href="/timers" className="text-xs text-[var(--signal)] font-medium hover:underline">
            Log timer →
          </Link>
        </div>
        {recentHits && recentHits.length > 0 ? (
          <ul className="space-y-2">
            {recentHits.map((hit: any) => (
              <li key={hit.id} className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--ok)] font-mono text-sm font-semibold">✓</span>
                  <p className="text-sm font-medium text-[var(--ink)]">
                    {(hit.machines as any)?.machine_code} — :{String(hit.minutes).padStart(2, '0')}
                  </p>
                </div>
                <p className="text-xs text-[var(--muted)] mt-0.5 ml-5" style={{ fontFamily: 'var(--font-mono)' }}>
                  {(hit.profiles as any)?.username} · {timeAgo(hit.reported_at)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState href="/timers" cta="Log one when you spot a machine">
            No timer hits today.
          </EmptyState>
        )}
      </section>
    </div>
  )
}

function EmptyState({ children, href, cta }: { children: React.ReactNode; href: string; cta: string }) {
  return (
    <div className="bg-[var(--card)] border border-dashed border-[var(--card-border)] rounded-xl px-4 py-6 text-center">
      <p className="text-sm text-[var(--muted)]">{children}</p>
      <Link href={href} className="mt-2 inline-block text-xs text-[var(--signal)] font-medium hover:underline">
        {cta}
      </Link>
    </div>
  )
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
