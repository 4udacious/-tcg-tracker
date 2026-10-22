import { createClient } from '@/lib/supabase/server'
import TrainerCard from '@/components/TrainerCard'

export const dynamic = 'force-dynamic'

/** Your trainer card, as other members see it, with the buttons to edit it. */
export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return <TrainerCard id={user!.id} self />
}
