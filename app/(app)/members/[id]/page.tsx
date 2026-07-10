import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? v[0] ?? null : v ?? null
}

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: profile }, { data: earned }, { data: interests }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, trainer_icons(file)')
      .eq('id', id)
      .single(),
    supabase
      .from('user_achievements')
      .select('id, completed_at, granted_by, achievements(id, name, description, is_active, badge_icons(file, label))')
      .eq('user_id', id)
      .order('completed_at', { ascending: false }),
    supabase
      .from('product_interest')
      .select('id, note, created_at, products(name, sets(name))')
      .eq('user_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (!profile) notFound()

  const ti = one(profile.trainer_icons as { file: string } | { file: string }[] | null)
  const name = profile.display_name ?? profile.username

  type EarnedRow = {
    id: number
    completed_at: string
    granted_by: string | null
    achievements: {
      id: number
      name: string
      description: string
      is_active: boolean
      badge_icons: { file: string; label: string } | { file: string; label: string }[] | null
    } | { id: number; name: string; description: string; is_active: boolean; badge_icons: { file: string; label: string } | { file: string; label: string }[] | null }[] | null
  }

  const badges = ((earned as EarnedRow[] | null) ?? [])
    .map((row) => {
      const ach = one(row.achievements)
      return ach ? { ...ach, icon: one(ach.badge_icons), grantedBy: row.granted_by, completedAt: row.completed_at } : null
    })
    .filter((b): b is NonNullable<typeof b> => b !== null)

  type InterestRow = {
    id: number
    note: string | null
    products: { name: string; sets: { name: string } | { name: string }[] | null } | { name: string; sets: { name: string } | { name: string }[] | null }[] | null
  }

  // Group interests by set name.
  const interestGroups = new Map<string, { productName: string; note: string | null }[]>()
  for (const row of (interests as InterestRow[] | null) ?? []) {
    const product = one(row.products)
    const set = one(product?.sets ?? null)
    const setName = set?.name ?? 'Other'
    if (!interestGroups.has(setName)) interestGroups.set(setName, [])
    interestGroups.get(setName)!.push({ productName: product?.name ?? 'Unknown', note: row.note })
  }
  const interestList = [...interestGroups.entries()]

  return (
    <div className="space-y-6">
      <Link href="/members" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        All members
      </Link>

      {/* Header */}
      <div className="bg-card border border-card-border rounded-2xl p-4 flex items-center gap-4">
        {ti?.file ? (
          <img src={`/Trainers/${ti.file}`} alt="" className="w-16 h-16 rounded-full object-contain bg-paper shrink-0" />
        ) : profile.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-ink/10 flex items-center justify-center text-2xl font-bold text-muted shrink-0">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-display font-bold text-lg truncate">{name}</p>
          <p className="font-mono text-xs text-muted capitalize">{profile.role}</p>
        </div>
      </div>

      {/* Achievements */}
      <section className="space-y-3">
        <h2 className="font-display font-semibold text-base">Achievements ({badges.length})</h2>
        {badges.length === 0 ? (
          <p className="text-sm text-muted">No achievements earned yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {badges.map((b) => (
              <div key={b.id} className="bg-card border border-card-border rounded-2xl p-3 flex flex-col items-center text-center gap-2">
                {b.icon ? (
                  <img src={`/badges/${b.icon.file}`} alt={b.icon.label} className="w-14 h-14 object-contain" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-signal/10 flex items-center justify-center text-signal text-2xl">🏅</div>
                )}
                <div className="space-y-0.5">
                  <p className="font-semibold text-xs">{b.name}</p>
                  <p className="text-[10px] text-muted leading-snug">{b.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Interest checklist */}
      <section className="space-y-3">
        <h2 className="font-display font-semibold text-base">Interest List</h2>
        {interestList.length === 0 ? (
          <p className="text-sm text-muted">No items on their interest list.</p>
        ) : (
          <div className="space-y-3">
            {interestList.map(([setName, items]) => (
              <div key={setName} className="bg-card border border-card-border rounded-2xl p-4 space-y-2">
                <p className="font-mono text-[11px] uppercase tracking-wide text-muted">{setName}</p>
                <ul className="space-y-1.5">
                  {items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <svg className="w-4 h-4 text-signal shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      <span className="min-w-0">
                        {item.productName}
                        {item.note && <span className="text-muted"> — {item.note}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
