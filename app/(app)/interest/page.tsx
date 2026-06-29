import { createClient } from '@/lib/supabase/server'
import InterestTracker from './InterestTracker'

export default async function InterestPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: sets }, { data: myInterests }, { data: allInterests }, { data: overview }] = await Promise.all([
    supabase
      .from('sets')
      .select('id, name, set_type')
      .eq('is_active', true)
      .order('sort_order')
      .order('name'),
    supabase
      .from('product_interest')
      .select('id, note, product_id, created_at, products(id, name, sets(id, name))')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('product_interest')
      .select('user_id, note, profiles(username, display_name), products(name, sets(name))')
      .order('user_id'),
    supabase.from('v_interest_overview').select('*'),
  ])

  // Group allInterests by user_id for the "By Person" tab
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

  // v_interest_overview: one row per product. Column names per brief are
  // set_name, set_type, interested_count, interested_users — product identity
  // and sort columns aren't documented, so we read defensively.
  type OverviewRow = {
    set_name?: string
    set_type?: string
    interested_count?: number
    interested_users?: string[]
    product_name?: string
    name?: string
    [key: string]: unknown
  }

  const overviewBySet = (overview as OverviewRow[] | null ?? []).reduce<
    Record<string, { setType: string; rows: { productName: string; count: number; users: string[] }[] }>
  >((acc, row) => {
    const setName = row.set_name ?? 'Unknown set'
    const productName = row.product_name ?? row.name ?? 'Unknown product'
    const count = row.interested_count ?? 0
    const users = row.interested_users ?? []
    if (!acc[setName]) {
      acc[setName] = { setType: row.set_type ?? '', rows: [] }
    }
    acc[setName].rows.push({ productName, count, users })
    return acc
  }, {})

  const setOrder = (sets ?? []).map((s) => s.name)
  const interestBoard = Object.entries(overviewBySet)
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
