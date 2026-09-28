import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RaffleClient, { type RaffleTicket, type TicketHolder } from './RaffleClient'

export const dynamic = 'force-dynamic'

export default async function AdminRafflePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Writing tickets is admin-only in the database too; this just keeps mods
  // off a page where every button would fail.
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  if (me?.role !== 'admin') redirect('/admin')

  const [{ data: tickets }, { data: holders }] = await Promise.all([
    supabase
      .from('raffle_tickets')
      .select('id, name, description, token_price, rarity, image_url, starts_at, ends_at, total_quantity, claimed_quantity, is_active, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('user_raffle_tickets')
      .select('id, ticket_id, acquired_at, profiles(username, display_name)')
      .order('acquired_at', { ascending: false })
      .limit(200),
  ])

  type HolderRow = {
    id: number
    ticket_id: number
    acquired_at: string
    profiles: { username: string; display_name: string | null } | { username: string; display_name: string | null }[] | null
  }

  const holderRows: TicketHolder[] = ((holders as HolderRow[] | null) ?? []).map((h) => {
    const p = Array.isArray(h.profiles) ? h.profiles[0] : h.profiles
    return {
      id: h.id,
      ticket_id: h.ticket_id,
      acquired_at: h.acquired_at,
      holder: p?.display_name ?? p?.username ?? 'Unknown',
    }
  })

  return (
    <RaffleClient
      tickets={(tickets as RaffleTicket[] | null) ?? []}
      holders={holderRows}
    />
  )
}
