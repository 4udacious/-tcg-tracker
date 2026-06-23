import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BottomTabNav from '@/components/BottomTabNav'
import type { Role } from '@/lib/supabase/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role, display_name, username, avatar_url')
    .eq('id', user.id)
    .single()

  const profile = profileData as { role: Role; display_name: string | null; username: string | null; avatar_url: string | null } | null
  const role = (profile?.role ?? 'pending') as Role

  if (role === 'pending') redirect('/pending')

  return (
    <div className="flex flex-col min-h-screen pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[var(--ink)] text-white px-4 py-3 flex items-center justify-between gap-3">
        <span
          className="text-sm font-bold tracking-tight truncate"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          WA Pokemon Collectors Tracker
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {profile?.avatar_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt={profile.display_name ?? 'avatar'}
              className="w-7 h-7 rounded-full"
            />
          )}
          <span className="text-xs text-white/60 font-mono">
            {profile?.display_name ?? profile?.username ?? ''}
          </span>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-5">
        {children}
      </main>

      <BottomTabNav role={role} />
    </div>
  )
}
