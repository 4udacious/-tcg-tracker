import { createClient } from '@/lib/supabase/server'
import RolesClient from './RolesClient'

export const dynamic = 'force-dynamic'

export default async function RolesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: profile }, { data: members }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user!.id).single(),
    supabase
      .from('profiles')
      .select('id, username, display_name, role')
      .in('role', ['contributor', 'member', 'mod', 'admin'])
      .order('username'),
  ])

  return <RolesClient members={members ?? []} userRole={profile?.role ?? 'mod'} />
}
