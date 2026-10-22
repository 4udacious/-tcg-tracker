import { createClient } from '@/lib/supabase/server'
import { SubTabs } from '@/components/ui/SubTabs'
import { CountBadge } from '@/components/ui/Badge'

/**
 * The Trainer tab: what you own. Cards (packs, cards, tickets, items) and your
 * Showcase; the RPG's party, bag and badges join here.
 */
export default async function TrainerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // Unopened packs, on the Cards tab: the one thing in here that's waiting on you.
  const { count: packs } = await supabase
    .from('user_packs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user!.id)
    .is('opened_at', null)
    .is('market_listing_id', null)

  return (
    <div className="space-y-4">
      <SubTabs label="Trainer" tabs={[
        { href: '/collection', label: 'Cards', badge: <CountBadge count={packs ?? 0} label={`${packs} unopened`} /> },
        { href: '/showcase', label: 'Showcase' },
      ]} />
      {children}
    </div>
  )
}
