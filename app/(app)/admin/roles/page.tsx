import { createClient } from '@/lib/supabase/server'
import RolesClient from './RolesClient'

export default async function RolesPage() {
  const supabase = await createClient()
  const { data: members } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .in('role', ['member', 'mod', 'admin'])
    .order('username')

  return <RolesClient members={members ?? []} />
}
