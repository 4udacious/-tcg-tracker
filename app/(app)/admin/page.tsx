import { createClient } from '@/lib/supabase/server'
import ApprovalsClient from './ApprovalsClient'

export default async function AdminApprovalsPage() {
  const supabase = await createClient()

  const { data: pendingUsers } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, created_at')
    .eq('role', 'pending')
    .order('created_at')

  return <ApprovalsClient pendingUsers={pendingUsers ?? []} />
}
