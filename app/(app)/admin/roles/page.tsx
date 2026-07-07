import { createClient } from '@/lib/supabase/server'
import RolesClient from './RolesClient'

export const dynamic = 'force-dynamic'

export default async function RolesPage() {
  const supabase = await createClient()

  const { data: members } = await supabase
    .from('profiles')
    .select('id, username, display_name, role')
    .in('role', ['contributor', 'member', 'mod', 'admin'])
    .order('username')

  return <RolesClient members={members ?? []} />
}
