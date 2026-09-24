import { createClient } from '@/lib/supabase/server'
import VendingClient from './VendingClient'

export const dynamic = 'force-dynamic'

export default async function VendingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id

  // Advancing the cycle happens inside this call, so the first visitor after
  // a cycle expires is the one who rolls it over for everybody.
  const { data: stateRows } = await supabase.rpc('get_vending_state')
  const state = (Array.isArray(stateRows) ? stateRows[0] : stateRows) ?? null

  const [{ data: stock }, { data: balance }, { data: me }] = await Promise.all([
    state && (state.status === 'in_stock' || state.status === 'out_of_stock')
      ? supabase.rpc('get_vending_stock', { p_cycle: state.cycle_no })
      : Promise.resolve({ data: [] }),
    supabase.rpc('token_balance', { target: userId }),
    supabase.from('profiles').select('vending_cooldown_until').eq('id', userId).single(),
  ])

  return (
    <VendingClient
      initialState={state}
      initialStock={stock ?? []}
      balance={(balance as number | null) ?? 0}
      userId={userId}
      cooldownUntil={me?.vending_cooldown_until ?? null}
    />
  )
}
