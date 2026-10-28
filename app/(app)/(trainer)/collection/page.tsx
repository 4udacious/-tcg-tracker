import { createClient } from '@/lib/supabase/server'
import CollectionPanel from '@/app/(app)/vending/CollectionPanel'
import { loadPacks, loadBoxes, loadCards, loadSetTotals, loadOwnedTickets, loadOwnedItems, loadServiceSettings } from '@/lib/vending/data'

export const dynamic = 'force-dynamic'

export default async function CollectionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id
  const [packs, boxes, cards, setTotals, tickets, items, services] = await Promise.all([
    loadPacks(supabase, userId),
    loadBoxes(supabase, userId),
    loadCards(supabase, userId),
    loadSetTotals(supabase),
    loadOwnedTickets(supabase, userId),
    loadOwnedItems(supabase, userId),
    loadServiceSettings(supabase),
  ])
  return (
    <CollectionPanel packs={packs} boxes={boxes} collection={cards} setTotals={setTotals} tickets={tickets} items={items}
      gradingCost={services.gradingCost} gradingDays={services.gradingDays}
      cleaningCost={services.cleaningCost} cleaningDays={services.cleaningDays} />
  )
}
