import { createClient } from '@/lib/supabase/server'
import AdminApprovalsClient from './ApprovalsClient'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: pending } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, discord_id')
    .eq('role', 'pending')
    .order('username')

  return <AdminApprovalsClient pending={pending ?? []} />
}
