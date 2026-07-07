import { createClient } from '@/lib/supabase/server'
import RolesClient from './RolesClient'

export const dynamic = 'force-dynamic'

export default async function RolesPage() {
  const supabase = await createClient()

  const { data: allProfiles, error: allError } = await supabase
    .from('profiles')
    .select('id, username, display_name, role')
    .order('username')

  console.log('[roles] all profiles count:', allProfiles?.length ?? 0, 'error:', allError?.message)
  console.log('[roles] roles present:', [...new Set(allProfiles?.map(p => p.role) ?? [])])

  const members = (allProfiles ?? []).filter(p =>
    ['contributor', 'member', 'mod', 'admin'].includes(p.role)
  )

  return <RolesClient members={members ?? []} />
}
