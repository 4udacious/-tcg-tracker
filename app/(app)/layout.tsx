import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BottomTabNav from '@/components/BottomTabNav'
import NotificationBell from '@/components/NotificationBell'
import UserMenu from '@/components/UserMenu'
import SettingsApplier from '@/components/SettingsApplier'
import { ToastProvider } from '@/components/ui/Toast'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date().toISOString()
  const [{ data: profile }, { count: gradesReady }, { count: cleansReady }, { data: announcement }, { data: balance }, { count: marketUnread }] = await Promise.all([
    supabase
      .from('profiles')
      .select('role, display_name, username, name_color, trainer_icons(file)')
      .eq('id', user.id)
      .single(),
    // Grades back from WAPC and not yet opened, for the bell.
    // Head-only count: no rows come back, just the number.
    supabase
      .from('user_cards')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .not('grading_started_at', 'is', null)
      .is('graded_at', null)
      .lte('grading_ready_at', now),
    // Cleaned cards back and waiting to be picked up, for the bell.
    supabase
      .from('user_cards')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .not('cleaning_started_at', 'is', null)
      .lte('cleaning_ready_at', now),
    // The newest market announcement this member has not seen yet, if any.
    supabase
      .from('market_notices')
      .select('id, message')
      .eq('user_id', user.id)
      .eq('kind', 'announcement')
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Your token balance, for the chip in the header.
    supabase.rpc('token_breakdown'),
    // Unread market activity (sales, bids, outbids); the announcement is counted separately.
    supabase
      .from('market_notices')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .neq('kind', 'announcement')
      .is('read_at', null),
  ])

  const role = profile?.role ?? 'member'
  const ti = Array.isArray(profile?.trainer_icons) ? profile.trainer_icons[0] : profile?.trainer_icons
  const tokens = Number(((Array.isArray(balance) ? balance[0] : balance) as { total: number } | null)?.total ?? 0)

  return (
    <ToastProvider>
      <SettingsApplier />
      <div className="min-h-screen flex flex-col bg-paper">
        <header className="sticky top-0 z-40 bg-ink text-white">
          <div className="max-w-lg mx-auto pl-4 pr-2 h-14 flex items-center gap-1">
            <Link href="/timers" className="font-display font-bold text-base tracking-tight mr-auto">
              TCG Tracker
            </Link>
            {/* Tokens are spent and earned all over the app, so they're always in sight. */}
            <Link href="/vending" aria-label={`${tokens} tokens`}
              className="flex items-center gap-1 h-8 px-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
              <span className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-amber-200 to-amber-500 ring-1 ring-amber-600/50" aria-hidden />
              <span className="font-mono text-xs font-semibold text-amber-200">{Number.isInteger(tokens) ? tokens : tokens.toFixed(2)}</span>
            </Link>
            <NotificationBell
              grades={gradesReady ?? 0}
              cleans={cleansReady ?? 0}
              marketUnread={marketUnread ?? 0}
              announcement={announcement?.message ? { id: announcement.id, message: announcement.message } : null}
            />
            <UserMenu
              name={profile?.display_name ?? profile?.username ?? ''}
              nameColor={profile?.name_color ?? null}
              iconFile={ti?.file ?? null}
              role={role}
            />
          </div>
        </header>

        <main className="flex-1 max-w-lg mx-auto w-full px-4 pb-28 pt-4">
          {children}
        </main>

        <BottomTabNav />
      </div>
    </ToastProvider>
  )
}
