import { createClient } from '@/lib/supabase/server'
import MembersClient from './MembersClient'

export const dynamic = 'force-dynamic'

export default async function MembersPage() {
  const supabase = await createClient()

  const [{ data: profiles }, { data: earned }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, trainer_icons(file)')
      .neq('role', 'pending')
      .order('username'),
    supabase.from('user_achievements').select('user_id'),
  ])

  // Count earned badges per member.
  const badgeCounts = new Map<string, number>()
  for (const row of (earned as { user_id: string }[] | null) ?? []) {
    badgeCounts.set(row.user_id, (badgeCounts.get(row.user_id) ?? 0) + 1)
  }

  type ProfileRow = {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    trainer_icons: { file: string } | { file: string }[] | null
  }

  const members = ((profiles as ProfileRow[] | null) ?? []).map((p) => {
    const ti = Array.isArray(p.trainer_icons) ? p.trainer_icons[0] : p.trainer_icons
    return {
      id: p.id,
      username: p.username,
      displayName: p.display_name,
      avatarUrl: p.avatar_url,
      role: p.role,
      trainerIconFile: ti?.file ?? null,
      badgeCount: badgeCounts.get(p.id) ?? 0,
    }
  })

  return <MembersClient members={members} />
}
