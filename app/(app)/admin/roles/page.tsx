import { createClient } from '@/lib/supabase/server'
import RolesClient from './RolesClient'

export default async function RolesPage() {
  const supabase = await createClient()

  const { data: members, error: membersError } = await supabase
    .from('profiles')
    .select('id, username, display_name, role')
    .in('role', ['contributor', 'member', 'mod', 'admin'])
    .order('username')

  if (membersError) console.error('[roles] query error:', membersError.message, membersError.details)
  console.log('[roles] member count:', members?.length ?? 0)

  return <RolesClient members={members ?? []} />
}
