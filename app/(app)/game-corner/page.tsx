import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { gameCornerAccess } from './access'
import GameCorner from './GameCorner'

export const dynamic = 'force-dynamic'

/* The Game Corner: slots and roulette, played with tokens, beside other members (v115). Only admins, while it's closed. */
export default async function GameCornerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const access = await gameCornerAccess(supabase, user!.id)
  if (!access.visible) redirect('/vending')
  return <GameCorner admin={access.admin} />
}
