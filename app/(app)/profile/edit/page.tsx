import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import ProfileClient from '../ProfileClient'

export default async function EditProfilePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const initialTab = (await searchParams).tab === 'achievements' ? 'achievements' : 'profile'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id

  const [{ data: profile }, { data: achievements }, { data: progress }, { data: trainerIcons }, { data: breakdown }] = await Promise.all([
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
      .select('achievement_id, action, required_qty, current_qty')
      .eq('user_id', userId),
    supabase
      .from('trainer_icons')
      .select('id, file, label')
      .order('id'),
    // Your own balance only; token_balance takes any user and is internal.
    supabase.rpc('token_breakdown'),
  ])
  const tokenBalance = Number(
    ((Array.isArray(breakdown) ? breakdown[0] : breakdown) as { total: number } | null)?.total ?? 0
  )

  return (
    <div className="space-y-4">
      <Link href="/profile" className="inline-flex items-center gap-1 min-h-10 text-sm text-muted hover:text-ink transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Trainer card
      </Link>
    <ProfileClient
      initialTab={initialTab}
      userId={userId}
      profile={profile}
      achievements={achievements ?? []}
      progress={progress ?? []}
      trainerIcons={trainerIcons ?? []}
      tokenBalance={tokenBalance}
    />
    </div>
  )
}
