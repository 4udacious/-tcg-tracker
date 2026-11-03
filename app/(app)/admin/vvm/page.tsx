import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import VvmItemsClient, { type SetItem } from './VvmItemsClient'
import VvmSuppliesClient, { isRematch, type SupplyRow } from './VvmSuppliesClient'
import VvmBoxesClient, { type BoxRow } from './VvmBoxesClient'
import BattlesLiveClient from './BattlesLiveClient'
import GiftPokemonClient, { type GiftMember, type GiftRow } from './GiftPokemonClient'
import CrashReportsClient, { type CrashRow } from './CrashReportsClient'

export const dynamic = 'force-dynamic'

/** The page's tabs, in order; `?tab=` picks one (Packs when it's missing or unknown). */
const TABS = [
  { id: 'packs', label: 'Packs' },
  { id: 'supplies', label: 'Supplies' },
  { id: 'rematches', label: 'Rematches' },
  { id: 'game', label: 'Game settings' },
  { id: 'gifts', label: 'Gifts' },
  { id: 'crashes', label: 'Crash reports' },
] as const
type TabId = (typeof TABS)[number]['id']

export default async function AdminVvmPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const asked = (await searchParams).tab
  const tab: TabId = TABS.some((t) => t.id === asked) ? (asked as TabId) : 'packs'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  if (me?.role !== 'admin') redirect('/admin')

  const [{ data: packs }, { data: info }, { data: supplies }, { data: settings }, { data: boxes }, { data: members }, gifts, crashes] = await Promise.all([
    supabase
      .from('vending_packs')
      .select('set_code, set_name, image_url, sort_order, is_active')
      .eq('is_active', true)
      .order('sort_order'),
    supabase.from('vending_set_info').select('set_code, description, total_quantity, claimed_quantity'),
    supabase
      .from('vvm_supplies')
      .select('*')   // '*': max_per_checkout and daily_limit are v86's
      .order('sort_order'),
    supabase.from('vending_settings').select('*').single(),   // '*': battle_heal_price is v79's, battle_find_chance v80's
    // Empty (and the section hidden) before v62.
    supabase
      .from('vending_boxes')
      .select('*')
      .order('sort_order'),
    // Members to gift a Pokémon to: approved accounts, by username (admin-checked in the database).
    supabase.rpc('admin_token_balances'),
    // Recent gifts; an error (before v82) hides the section.
    supabase
      .from('battle_gifts')
      .select('id, user_id, species, level, note, created_at, claimed_at, member:profiles!battle_gifts_user_id_fkey(username, display_name)')
      .order('created_at', { ascending: false })
      .limit(15),
    // Crash reports from the battle game; an error (before v83) hides the section.
    supabase
      .from('battle_crash_reports')
      .select('id, created_at, note, device, member:profiles!battle_crash_reports_user_id_fkey(username, display_name)')
      .order('created_at', { ascending: false })
      .limit(20),
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

  const supplyRows = (supplies as SupplyRow[] | null) ?? []
  const crashRows = (crashes.data as unknown as CrashRow[] | null) ?? []
  // A count beside a tab's name, where one helps: rematch tickets on, and crash reports from the last day.
  const dayAgo = Date.now() - 86_400_000
  const counts: Partial<Record<TabId, number>> = {
    rematches: supplyRows.filter((s) => isRematch(s) && s.is_active).length,
    crashes: crashRows.filter((c) => new Date(c.created_at).getTime() > dayAgo).length,
  }

  return (
    <div className="space-y-5">
      <nav aria-label="VVM settings" className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.filter((t) => (t.id !== 'gifts' || !gifts.error) && (t.id !== 'crashes' || !crashes.error)).map((t) => (
          <Link
            key={t.id}
            href={t.id === 'packs' ? '/admin/vvm' : `/admin/vvm?tab=${t.id}`}
            aria-current={tab === t.id ? 'page' : undefined}
            scroll={false}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              tab === t.id ? 'bg-ink text-white border-ink' : 'bg-card border-card-border text-ink hover:border-ink/20'
            }`}
          >
            {t.label}
            {counts[t.id] ? <span className={`ml-1.5 text-xs ${tab === t.id ? 'opacity-70' : 'text-muted'}`}>{counts[t.id]}</span> : null}
          </Link>
        ))}
      </nav>

      {tab === 'packs' && (
        <div className="space-y-8">
          <VvmItemsClient sets={[...bySet.values()]} />
          <VvmBoxesClient boxes={((boxes as (Omit<BoxRow, 'image_url'> & { image_url?: string | null })[] | null) ?? []).map((b) => ({ ...b, image_url: b.image_url ?? bySet.get(b.set_code)?.image_url ?? null }))} />
        </div>
      )}
      {tab === 'supplies' && <VvmSuppliesClient supplies={supplyRows} />}
      {tab === 'rematches' && <VvmSuppliesClient supplies={supplyRows} show="rematches" />}
      {tab === 'game' && (
        <BattlesLiveClient
          wild={!!(settings as { wild_live: boolean } | null)?.wild_live}
          trainers={!!(settings as { battle_rewards_open: boolean } | null)?.battle_rewards_open}
          healPrice={(settings as { battle_heal_price?: number | string | null } | null)?.battle_heal_price ?? null}
          findChance={(settings as { battle_find_chance?: number | string | null } | null)?.battle_find_chance ?? null}
        />
      )}
      {tab === 'gifts' && !gifts.error && (
        <GiftPokemonClient
          members={((members as GiftMember[] | null) ?? []).map((m) => ({ user_id: m.user_id, username: m.username, display_name: m.display_name }))}
          recent={(gifts.data as unknown as GiftRow[] | null) ?? []}
        />
      )}
      {tab === 'crashes' && !crashes.error && <CrashReportsClient reports={crashRows} />}
    </div>
  )
}
