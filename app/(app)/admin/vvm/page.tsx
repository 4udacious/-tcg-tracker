import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import VvmItemsClient, { type SetItem } from './VvmItemsClient'
import VvmSuppliesClient, { type SupplyRow } from './VvmSuppliesClient'
import BattlesLiveClient from './BattlesLiveClient'

export const dynamic = 'force-dynamic'

export default async function AdminVvmPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  if (me?.role !== 'admin') redirect('/admin')

  const [{ data: packs }, { data: info }, { data: supplies }, { data: settings }] = await Promise.all([
    supabase
      .from('vending_packs')
      .select('set_code, set_name, image_url, sort_order, is_active')
      .eq('is_active', true)
      .order('sort_order'),
    supabase.from('vending_set_info').select('set_code, description, total_quantity, claimed_quantity'),
    supabase
      .from('vvm_supplies')
      .select('key, kind, name, description, contents, token_price, appearance_rate, is_active, sort_order, updated_at')
      .order('sort_order'),
    supabase.from('vending_settings').select('wild_live, battle_rewards_open').single(),
  ])

  type PackRow = { set_code: string | null; set_name: string; image_url: string; sort_order: number }

  type InfoRow = {
    set_code: string
    description: string | null
    total_quantity: number | null
    claimed_quantity: number
  }
  const infoBySet = new Map<string, InfoRow>(
    ((info as InfoRow[] | null) ?? []).map((i) => [i.set_code, i])
  )

  // The machine sells by set, so collapse the per-wrapper rows into one card
  // per set and keep a sample wrapper for the thumbnail.
  const bySet = new Map<string, SetItem>()
  for (const p of (packs as PackRow[] | null) ?? []) {
    if (!p.set_code) continue
    const existing = bySet.get(p.set_code)
    if (existing) {
      existing.artCount += 1
    } else {
      bySet.set(p.set_code, {
        set_code: p.set_code,
        set_name: p.set_name,
        image_url: p.image_url,
        artCount: 1,
        description: infoBySet.get(p.set_code)?.description ?? null,
        totalQuantity: infoBySet.get(p.set_code)?.total_quantity ?? null,
        claimedQuantity: infoBySet.get(p.set_code)?.claimed_quantity ?? 0,
      })
    }
  }

  return (
    <div className="space-y-8">
      <VvmItemsClient sets={[...bySet.values()]} />
      <VvmSuppliesClient supplies={(supplies as SupplyRow[] | null) ?? []} />
      <BattlesLiveClient
        wild={!!(settings as { wild_live: boolean } | null)?.wild_live}
        trainers={!!(settings as { battle_rewards_open: boolean } | null)?.battle_rewards_open}
      />
    </div>
  )
}
