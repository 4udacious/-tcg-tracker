import { createClient } from '@/lib/supabase/server'
import ShowcasePanel from '@/app/(app)/vending/ShowcasePanel'
import { loadBoxes, loadCards, loadShowcase } from '@/lib/vending/data'

export const dynamic = 'force-dynamic'

export default async function ShowcasePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id
  // The cards and sealed boxes come too: the showcase is filled from them.
  const [showcase, cards, boxes] = await Promise.all([loadShowcase(supabase, userId), loadCards(supabase, userId), loadBoxes(supabase, userId)])
  return <ShowcasePanel initialItems={showcase.items} initialLighting={showcase.lighting} collection={cards} boxes={boxes} />
}
