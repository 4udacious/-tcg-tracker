import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import VvmGame, { type RecentBuy } from './VvmGame'

export const dynamic = 'force-dynamic'

// The VVM's other views are pages of their own now; old links still land.
const MOVED: Record<string, string> = { collection: '/collection', showcase: '/showcase', market: '/market' }

/* The VVM tab: the battle game's machine, with the lobby chat and recent buys under it. */
export default async function VendingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const asked = (await searchParams).view
  if (typeof asked === 'string' && MOVED[asked]) redirect(MOVED[asked])

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: recentBuys } = await supabase.rpc('vending_recent_buys', { p_limit: 6 })

  return <VvmGame userId={user!.id} initialBuys={(recentBuys as RecentBuy[] | null) ?? []} />
}
