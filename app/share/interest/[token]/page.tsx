import type { Metadata } from 'next'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import ProductThumb from '@/components/ProductThumb'
import { GAMES } from '@/lib/cardGames'

export const dynamic = 'force-dynamic'

type Row = {
  display_name: string
  product_name: string | null
  set_name: string | null
  game: string | null
  image_url: string | null
  note: string | null
  forever: boolean | null
}

type Props = { params: Promise<{ token: string }> }

/**
 * A member's live interest list, by the token in their share link (v73's
 * shared_interest_list). Null when the link is off, reset or never existed.
 * Cached per request so the metadata and the page share one call.
 */
const loadList = cache(async (token: string) => {
  if (!/^[0-9a-f]{32}$/.test(token)) return null
  const supabase = await createClient()
  const { data } = await supabase.rpc('shared_interest_list', { p_token: token })
  const rows = (data as Row[] | null) ?? []
  if (rows.length === 0) return null
  return { name: rows[0].display_name, items: rows.filter((r) => r.product_name) }
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const list = await loadList((await params).token)
  return {
    title: list ? `${list.name}'s interest check · TCG Tracker` : 'Interest check · TCG Tracker',
    description: list
      ? `${list.items.length} sealed product${list.items.length === 1 ? '' : 's'} ${list.name} is looking for.`
      : undefined,
    robots: { index: false, follow: false },
  }
}

export default async function SharedInterestPage({ params }: Props) {
  const list = await loadList((await params).token)

  if (!list) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-sm text-center space-y-2">
          <h1 className="font-display text-xl font-bold">This link isn&apos;t active</h1>
          <p className="text-sm text-muted">
            Its owner may have turned it off or made a new one. Ask them for their current link.
          </p>
        </div>
      </main>
    )
  }

  // Group by game (in the switch's order), then by set, keeping the order the
  // function returns within each.
  const groups = GAMES.map((g) => {
    const sets = new Map<string, Row[]>()
    for (const item of list.items.filter((i) => (i.game ?? 'pokemon') === g.id)) {
      const key = item.set_name ?? ''
      sets.set(key, [...(sets.get(key) ?? []), item])
    }
    return { label: g.label, sets: [...sets.entries()] }
  }).filter((g) => g.sets.length > 0)

  return (
    <main className="max-w-xl mx-auto px-4 py-8 space-y-6">
      <header className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted">TCG Tracker · Interest check</p>
        <h1 className="font-display text-2xl font-bold">{list.name} is looking for</h1>
        <p className="text-sm text-muted">
          {list.items.length === 0
            ? 'Nothing on the list right now.'
            : `${list.items.length} sealed product${list.items.length === 1 ? '' : 's'}`}
        </p>
      </header>

      {groups.map((g) => (
        <section key={g.label} className="space-y-3">
          {groups.length > 1 && <h2 className="font-display font-semibold text-base">{g.label}</h2>}
          {g.sets.map(([setName, items]) => (
            <div key={setName} className="space-y-2">
              <p className="font-mono text-xs text-muted">{setName}</p>
              <ul className="space-y-2">
                {items.map((item, i) => (
                  <li key={i} className="bg-card border border-card-border rounded-xl px-4 py-3 flex items-start gap-3">
                    <ProductThumb src={item.image_url} alt={item.product_name ?? ''} className="w-12 h-12" />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="font-medium text-sm">{item.product_name}</p>
                      {item.note && <p className="text-xs text-muted italic">{item.note}</p>}
                    </div>
                    {item.forever && (
                      <span className="shrink-0 font-mono text-[10px] px-2 py-0.5 rounded-full border text-signal border-signal/40 bg-signal/5">
                        always
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}

      <footer className="pt-4 border-t border-card-border">
        <p className="text-xs text-muted">
          Shared from TCG Tracker. This list updates as {list.name} changes it.
        </p>
      </footer>
    </main>
  )
}
