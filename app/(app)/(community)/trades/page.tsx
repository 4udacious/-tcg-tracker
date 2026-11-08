import { createClient } from '@/lib/supabase/server'
import TradesPanel, { type Binder, type BinderSummary, type TradeOffer } from '@/app/(app)/vending/TradesPanel'
import { loadBalance, loadBoxes, loadCards, loadPacks } from '@/lib/vending/data'

export const dynamic = 'force-dynamic'

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)

/** Trades (v100): members' trade binders, yours, and the offers between you. ?u=<member> opens that member's binder. */
export default async function TradesPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const asked = (await searchParams).u
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id
  const [binders, mine, offers, opened, cards, packs, boxes, balance] = await Promise.all([
    supabase.rpc('trade_binders'),
    supabase.rpc('trade_binder', { p_user: userId }),
    supabase.rpc('trade_offers_mine'),
    typeof asked === 'string' && asked !== userId ? supabase.rpc('trade_binder', { p_user: asked }) : Promise.resolve({ data: null }),
    loadCards(supabase, userId), loadPacks(supabase, userId), loadBoxes(supabase, userId), loadBalance(supabase),
  ])
  return (
    <TradesPanel
      binders={(binders.data as BinderSummary[] | null) ?? []}
      myBinder={one(mine.data as Binder | null)}
      offers={(offers.data as TradeOffer[] | null) ?? []}
      initialBinder={one(opened.data as Binder | null)}
      collection={cards} packs={packs} boxes={boxes} balance={balance.total} userId={userId}
    />
  )
}
