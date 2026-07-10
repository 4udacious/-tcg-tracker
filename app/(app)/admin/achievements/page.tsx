import { createClient } from '@/lib/supabase/server'
import AchievementsClient from './AchievementsClient'

export default async function AdminAchievementsPage() {
  const supabase = await createClient()

  const [{ data: achievements }, { data: badgeIcons }, { data: members }] = await Promise.all([
    supabase
      .from('achievements')
      .select('id, name, description, starts_at, ends_at, is_active, badge_icon_id, badge_icons(id, file, label), achievement_requirements(id, action, qty)')
      .order('id'),
    supabase
      .from('badge_icons')
      .select('id, file, label, sort_order')
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('profiles')
      .select('id, username, display_name')
      .in('role', ['member', 'mod', 'admin', 'contributor'])
      .order('username'),
  ])

  return (
    <AchievementsClient
      achievements={achievements ?? []}
      badgeIcons={badgeIcons ?? []}
      members={members ?? []}
    />
  )
}
