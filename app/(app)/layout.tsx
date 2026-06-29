import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BottomTabNav from '@/components/BottomTabNav'
import SignOutButton from '@/components/SignOutButton'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, display_name, username')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'member'

  return (
    <div className="min-h-screen flex flex-col bg-paper">
      <header className="sticky top-0 z-40 bg-ink text-white">
        <div className="max-w-lg mx-auto px-4 h-12 flex items-center justify-between">
          <span className="font-display font-bold text-base tracking-tight">
            TCG Tracker
          </span>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-white/40">
              {profile?.display_name ?? profile?.username ?? ''}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 pb-24 pt-4">
        {children}
      </main>

      <BottomTabNav role={role} />
    </div>
  )
}
