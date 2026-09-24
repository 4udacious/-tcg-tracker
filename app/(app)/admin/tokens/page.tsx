import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TokensClient from './TokensClient'

export const dynamic = 'force-dynamic'

export default async function AdminTokensPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Granting and adjusting are admin-only in the database too; this just
  // keeps mods from landing on a page where every button would fail.
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  if (me?.role !== 'admin') redirect('/admin')

  const [{ data: settings }, { data: balances }, { data: period }, { data: recent }] = await Promise.all([
    supabase.from('vending_settings').select('monthly_allowance, tokens_expire_monthly, per_cycle_pack_cap, cooldown_hours, tokens_per_timer_report, max_earned_tokens_per_month').single(),
    supabase
      .from('v_token_balances')
      .select('user_id, username, display_name, role, effective_allowance, balance')
      .neq('role', 'pending')
      .order('username'),
    supabase.rpc('current_token_period'),
    supabase
      .from('token_ledger')
      .select('id, user_id, delta, reason, note, created_at, profiles!token_ledger_user_id_fkey(username, display_name)')
      .order('created_at', { ascending: false })
      .limit(25),
  ])

  return (
    <TokensClient
      settings={settings ?? { monthly_allowance: 10, tokens_expire_monthly: true, per_cycle_pack_cap: null, cooldown_hours: 3, tokens_per_timer_report: 1, max_earned_tokens_per_month: 15 }}
      balances={balances ?? []}
      period={(period as string) ?? ''}
      recent={recent ?? []}
    />
  )
}
