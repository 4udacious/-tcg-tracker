import { createClient } from '@/lib/supabase/server'
import ProfileClient from './ProfileClient'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id

  const [{ data: profile }, { data: achievements }, { data: progress }, { data: trainerIcons }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, trainer_icon_id, trainer_icons(id, file, label)')
      .eq('id', userId)
      .single(),
    supabase
      .from('achievements')
      .select('id, name, description, starts_at, ends_at, badge_icons(file, label), achievement_requirements(id, action, qty), user_achievements(id, completed_at, granted_by)')
      .eq('is_active', true)
      // Only embed THIS user's completions — without this, an achievement
      // earned by anyone would show as earned on everyone's profile.
      .eq('user_achievements.user_id', userId)
      .order('id'),
    supabase
      .from('v_achievement_progress')
      .select('achievement_id, requirement_id, action, required_qty, current_qty')
      .eq('user_id', userId),
    supabase
      .from('trainer_icons')
      .select('id, file, label')
      .order('id'),
  ])

  return (
    <ProfileClient
      userId={userId}
      profile={profile}
      achievements={achievements ?? []}
      progress={progress ?? []}
      trainerIcons={trainerIcons ?? []}
    />
  )
}
