import { createClient } from '@/lib/supabase/server'
import ProfileClient from './ProfileClient'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id

  const [{ data: profile }, { data: achievements }, { data: progress }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .eq('id', userId)
      .single(),
    supabase
      .from('achievements')
      .select('id, name, description, starts_at, ends_at, badge_icons(file, label), achievement_requirements(id, action, qty), user_achievements(id, completed_at, granted_by)')
      .eq('is_active', true)
      .order('id'),
    supabase
      .from('v_achievement_progress')
      .select('achievement_id, requirement_id, action, required_qty, current_qty')
      .eq('user_id', userId),
  ])

  return (
    <ProfileClient
      userId={userId}
      profile={profile}
      achievements={achievements ?? []}
      progress={progress ?? []}
    />
  )
}
