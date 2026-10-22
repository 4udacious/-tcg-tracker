import { createClient } from '@/lib/supabase/server'
import { SubTabs } from '@/components/ui/SubTabs'
import { CountBadge } from '@/components/ui/Badge'

/** The Community tab: the members, what they're hunting for, and the market between them. */
export default async function CommunityLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // Unread sales, bids and outbids, on the Market tab.
  const { count: unread } = await supabase
    .from('market_notices')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user!.id)
    .neq('kind', 'announcement')
    .is('read_at', null)

  return (
    <div className="space-y-4">
      <SubTabs label="Community" tabs={[
        { href: '/members', label: 'Members' },
        { href: '/interest', label: 'Interest' },
        { href: '/market', label: 'Market', badge: <CountBadge count={unread ?? 0} label={`${unread} market updates`} /> },
      ]} />
      {children}
    </div>
  )
}
