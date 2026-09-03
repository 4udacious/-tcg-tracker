import { createClient } from '@/lib/supabase/server'
import InterestTracker from './InterestTracker'

export const dynamic = 'force-dynamic'

export default async function InterestPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // An entry is live while it has no expiry ("forever need") or its expiry is
  // still in the future. Lapsed entries stay in the table so their owner can
  // re-add them, but they drop out of everyone else's view.
  const nowIso = new Date().toISOString()
  const liveOnly = `expires_at.is.null,expires_at.gt.${nowIso}`

  const [{ data: sets }, { data: myInterests }, { data: allInterests }, { data: products }] =
    await Promise.all([
      supabase
        .from('sets')
        .select('id, name, set_type')
        .eq('is_active', true)
        .order('sort_order')
        .order('name'),
      // The owner's own list deliberately includes lapsed rows.
      supabase
        .from('product_interest')
        .select('id, note, product_id, created_at, expires_at, products(id, name, sets(id, name))')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('product_interest')
        .select('user_id, note, profiles(username, display_name), products(name, sets(name))')
        .or(liveOnly)
        .order('user_id'),
      supabase
        .from('products')
        .select('id, name, sort_order, sets(id, name, set_type)')
        .eq('is_active', true)
        .order('sort_order')
        .order('name'),
    ])

  // Group live interests by user_id for the "By Person" tab
  type InterestRow = {
    user_id: string
    note: string | null
    profiles: { username: string; display_name?: string } | { username: string; display_name?: string }[] | null
    products: { name: string; sets: { name: string } | { name: string }[] | null } | { name: string; sets: { name: string } | { name: string }[] | null }[] | null
  }

  const peopleMap = new Map<string, { label: string; items: { productName: string; setName: string; note: string | null }[] }>()

  for (const row of (allInterests as InterestRow[] | null) ?? []) {
    const product = Array.isArray(row.products) ? row.products[0] : row.products
    const set = product
      ? Array.isArray((product as { sets: unknown }).sets)
        ? ((product as { sets: { name: string }[] }).sets)[0]
        : (product as { sets: { name: string } | null }).sets
      : null
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    const label = profile?.display_name ?? profile?.username ?? 'Unknown'
    if (!peopleMap.has(row.user_id)) {
      peopleMap.set(row.user_id, { label, items: [] })
    }
    peopleMap.get(row.user_id)!.items.push({
      productName: (product as { name: string } | null)?.name ?? '',
      setName: (set as { name: string } | null)?.name ?? '',
      note: row.note,
    })
  }

  const peopleList = [...peopleMap.entries()]
    .map(([id, v]) => ({ id, label: v.label }))
    .sort((a, b) => a.label.localeCompare(b.label))

  const interestsByPerson = Object.fromEntries(
    [...peopleMap.entries()].map(([id, v]) => [id, v.items])
  )

  // Build the "By Set" board from the catalog plus live interest, so products
  // with nobody waiting still appear under "Show all" and lapsed entries stop
  // inflating the counts.
  type ProductRow = {
    id: string
    name: string
    sets: { id: string; name: string; set_type: string } | { id: string; name: string; set_type: string }[] | null
  }

  const wantersByProductName = new Map<string, string[]>()
  for (const [, person] of peopleMap) {
    for (const item of person.items) {
      if (!item.productName) continue
      const list = wantersByProductName.get(item.productName) ?? []
      list.push(person.label)
      wantersByProductName.set(item.productName, list)
    }
  }

  const bySet = new Map<string, { setType: string; rows: { productName: string; count: number; users: string[] }[] }>()
  for (const p of (products as ProductRow[] | null) ?? []) {
    const set = Array.isArray(p.sets) ? p.sets[0] : p.sets
    if (!set) continue
    const users = wantersByProductName.get(p.name) ?? []
    if (!bySet.has(set.name)) bySet.set(set.name, { setType: set.set_type ?? '', rows: [] })
    bySet.get(set.name)!.rows.push({ productName: p.name, count: users.length, users })
  }

  const setOrder = (sets ?? []).map((s) => s.name)
  const interestBoard = [...bySet.entries()]
    .sort(([a], [b]) => {
      const ia = setOrder.indexOf(a)
      const ib = setOrder.indexOf(b)
      if (ia === -1 && ib === -1) return a.localeCompare(b)
      if (ia === -1) return 1
      if (ib === -1) return -1
      return ia - ib
    })
    .map(([setName, v]) => ({
      setName,
      setType: v.setType,
      rows: v.rows.sort((a, b) => b.count - a.count),
    }))

  return (
    <InterestTracker
      sets={sets ?? []}
      myInterests={myInterests ?? []}
      peopleList={peopleList}
      interestsByPerson={interestsByPerson}
      interestBoard={interestBoard}
      userId={user!.id}
    />
  )
}
