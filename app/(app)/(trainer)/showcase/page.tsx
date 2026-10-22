import { createClient } from '@/lib/supabase/server'
import ShowcasePanel from '@/app/(app)/vending/ShowcasePanel'
import { loadCards, loadShowcase } from '@/lib/vending/data'

export const dynamic = 'force-dynamic'

export default async function ShowcasePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id
  // The cards come too: the showcase is filled from them.
  const [showcase, cards] = await Promise.all([loadShowcase(supabase, userId), loadCards(supabase, userId)])
  return <ShowcasePanel initialItems={showcase.items} initialLighting={showcase.lighting} collection={cards} />
}
