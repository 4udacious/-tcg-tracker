import { createClient } from '@/lib/supabase/server'
import VendingClient from './VendingClient'
import type { UnopenedPack, CollectionCard, SetTotal } from './CollectionPanel'

export const dynamic = 'force-dynamic'

const SET_NAMES: Record<string, string> = {
  base1: 'Base Set',
  base2: 'Jungle',
  base3: 'Fossil',
  base5: 'Team Rocket',
}

export default async function VendingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id

  // Advancing the cycle happens inside this call, so the first visitor after
  // a cycle expires is the one who rolls it over for everybody.
  const { data: stateRows } = await supabase.rpc('get_vending_state')
  const state = (Array.isArray(stateRows) ? stateRows[0] : stateRows) ?? null

  const [{ data: stock }, { data: balance }, { data: me }, { data: packRows }, { data: collection }, { data: catalog }] =
    await Promise.all([
      state && (state.status === 'in_stock' || state.status === 'out_of_stock')
        ? supabase.rpc('get_vending_stock', { p_cycle: state.cycle_no })
        : Promise.resolve({ data: [] }),
      supabase.rpc('token_balance', { target: userId }),
      supabase.from('profiles').select('vending_cooldown_until').eq('id', userId).single(),
      supabase
        .from('user_packs')
        .select('id, vending_packs(set_name, pack_name, image_url)')
        .eq('user_id', userId)
        .is('opened_at', null)
        .order('acquired_at'),
      supabase
        .from('v_user_collection')
        .select('card_id, set_code, number, name, rarity, image_url, copies')
        .eq('user_id', userId),
      supabase.from('vending_cards').select('set_code'),
    ])

  type PackRow = {
    id: number
    vending_packs:
      | { set_name: string; pack_name: string; image_url: string }
      | { set_name: string; pack_name: string; image_url: string }[]
      | null
  }

  const packs: UnopenedPack[] = ((packRows as PackRow[] | null) ?? []).map((r) => {
    const p = Array.isArray(r.vending_packs) ? r.vending_packs[0] : r.vending_packs
    return {
      id: r.id,
      set_name: p?.set_name ?? '',
      pack_name: p?.pack_name ?? '',
      image_url: p?.image_url ?? '',
    }
  })

  // Totals per set, for the "12/102" completion counters.
  const counts = new Map<string, number>()
  for (const c of (catalog as { set_code: string }[] | null) ?? []) {
    counts.set(c.set_code, (counts.get(c.set_code) ?? 0) + 1)
  }
  const setTotals: SetTotal[] = [...counts.entries()]
    .map(([set_code, total]) => ({ set_code, set_name: SET_NAMES[set_code] ?? set_code, total }))
    .sort((a, b) => a.set_code.localeCompare(b.set_code))

  return (
    <VendingClient
      initialState={state}
      initialStock={stock ?? []}
      balance={(balance as number | null) ?? 0}
      userId={userId}
      cooldownUntil={me?.vending_cooldown_until ?? null}
      packs={packs}
      collection={(collection as CollectionCard[] | null) ?? []}
      setTotals={setTotals}
    />
  )
}
