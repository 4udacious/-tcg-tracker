import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import VendingClient, { type RecentBuy, type TicketStockRow, type SupplyStockRow } from './VendingClient'
import { loadBalance } from '@/lib/vending/data'

export const dynamic = 'force-dynamic'

// The VVM's other views are pages of their own now; old links still land.
const MOVED: Record<string, string> = { collection: '/collection', showcase: '/showcase', market: '/market' }

export default async function VendingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const asked = (await searchParams).view
  if (typeof asked === 'string' && MOVED[asked]) redirect(MOVED[asked])

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id

  // Advancing the cycle happens inside this call, so the first visitor after
  // a cycle expires is the one who rolls it over for everybody.
  const { data: stateRows } = await supabase.rpc('get_vending_state')
  const state = (Array.isArray(stateRows) ? stateRows[0] : stateRows) ?? null

  const showStock = state && (state.status === 'in_stock' || state.status === 'out_of_stock')

  const [{ data: stock }, { data: ticketStock }, { data: supplyStock }, balance, { data: me }, { data: recentBuys }] =
    await Promise.all([
      showStock
        ? supabase.rpc('get_vending_stock', { p_cycle: state.cycle_no })
        : Promise.resolve({ data: [] }),
      showStock
        ? supabase.rpc('get_vending_ticket_stock', { p_cycle: state.cycle_no })
        : Promise.resolve({ data: [] }),
      showStock
        ? supabase.rpc('get_vending_supply_stock', { p_cycle: state.cycle_no })
        : Promise.resolve({ data: [] }),
      loadBalance(supabase),
      supabase.from('profiles').select('vending_cooldown_until').eq('id', userId).single(),
      supabase.rpc('vending_recent_buys', { p_limit: 6 }),
    ])

  return (
    <VendingClient
      initialState={state}
      initialStock={stock ?? []}
      initialTickets={(ticketStock as TicketStockRow[] | null) ?? []}
      initialSupplies={(supplyStock as SupplyStockRow[] | null) ?? []}
      balance={balance.total}
      allowance={balance.allowance}
      earned={balance.earned}
      userId={userId}
      cooldownUntil={me?.vending_cooldown_until ?? null}
      recentBuys={(recentBuys as RecentBuy[] | null) ?? []}
    />
  )
}
