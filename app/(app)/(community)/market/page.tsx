import { createClient } from '@/lib/supabase/server'
import MarketPanel from '@/app/(app)/vending/MarketPanel'
import { loadBalance, loadBoxes, loadCards, loadMarket, loadPacks } from '@/lib/vending/data'

export const dynamic = 'force-dynamic'

export default async function MarketPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id
  // Your cards, packs and sealed boxes come too: they're what you can list.
  const [market, cards, packs, boxes, balance] = await Promise.all([
    loadMarket(supabase), loadCards(supabase, userId), loadPacks(supabase, userId), loadBoxes(supabase, userId), loadBalance(supabase),
  ])
  return (
    <MarketPanel listings={market.listings} myListings={market.myListings} collection={cards} packs={packs} boxes={boxes}
      balance={balance.total} feePercent={market.feePercent} userId={userId} />
  )
}
