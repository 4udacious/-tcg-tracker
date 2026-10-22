import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PlayFrame from './PlayFrame'

export const dynamic = 'force-dynamic'

/*
 * The battle game. Admin-only while it's built out: the proxy turns everyone
 * else away from /play and the game's files, and this checks again.
 */
export default async function PlayPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  if (profile?.role !== 'admin') notFound()
  return <PlayFrame userId={user!.id} />
}
