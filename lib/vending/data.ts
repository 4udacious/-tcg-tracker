import type { SupabaseClient } from '@supabase/supabase-js'
import type { UnopenedPack, CollectionCard, SetTotal, OwnedTicket, OwnedItem, OwnedBox } from '@/app/(app)/vending/CollectionPanel'
import type { ShowcaseItem, Lighting } from '@/app/(app)/vending/ShowcaseRoom'
import type { MarketListing } from '@/app/(app)/vending/MarketPanel'

/*
 * Server-side loaders for the VVM's pages. These used to run all at once on
 * the one VVM page; now the machine, Cards, Showcase and Market each load only
 * what they show.
 */

const SET_NAMES: Record<string, string> = {
  base1: 'Base Set',
  base2: 'Jungle',
  base3: 'Fossil',
  base4: 'Base Set 2',
  base5: 'Team Rocket',
  gym1: 'Gym Heroes',
  gym2: 'Gym Challenge',
  neo1: 'Neo Genesis',
}

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)

/** Your token balance and how it splits into allowance (expires) and earned (kept). */
export async function loadBalance(supabase: SupabaseClient) {
  const { data } = await supabase.rpc('token_breakdown')
  const bd = one(data as { total: number; allowance: number; earned: number } | null)
  return { total: Number(bd?.total ?? 0), allowance: Number(bd?.allowance ?? 0), earned: Number(bd?.earned ?? 0) }
}

/** Unopened packs, not listed on the market. */
export async function loadPacks(supabase: SupabaseClient, userId: string): Promise<UnopenedPack[]> {
  const { data } = await supabase
    .from('user_packs')
    .select('id, acquired_at, vending_packs(set_name, pack_name, image_url)')
    .eq('user_id', userId)
    .is('opened_at', null)
    .is('market_listing_id', null)
    .order('acquired_at')
  type PackRow = { id: number; acquired_at: string; vending_packs: { set_name: string; pack_name: string; image_url: string } | { set_name: string; pack_name: string; image_url: string }[] | null }
  return ((data as PackRow[] | null) ?? []).map((r) => {
    const p = one(r.vending_packs)
    return { id: r.id, set_name: p?.set_name ?? '', pack_name: p?.pack_name ?? '', image_url: p?.image_url ?? '', acquired_at: r.acquired_at }
  })
}

/** Sealed booster boxes, not listed on the market (empty before v63). */
export async function loadBoxes(supabase: SupabaseClient, userId: string): Promise<OwnedBox[]> {
  const { data } = await supabase
    .from('user_boxes')
    .select('id, packs, acquired_at, vending_boxes(name, image_url, set_code)')
    .eq('user_id', userId)
    .is('opened_at', null)
    .is('market_listing_id', null)
    .order('acquired_at')
  type B = { name: string; image_url: string | null; set_code: string }
  type Row = { id: number; packs: number; acquired_at: string; vending_boxes: B | B[] | null }
  return ((data as Row[] | null) ?? []).map((r) => {
    const b = one(r.vending_boxes)
    return { id: r.id, packs: r.packs, acquired_at: r.acquired_at, name: b?.name ?? 'Booster Box', image_url: b?.image_url ?? null, set_code: b?.set_code ?? '' }
  })
}

/**
 * Your cards, grouped under each card with every copy's own condition (two
 * copies of one card have different condition, so they cannot be collapsed
 * before they reach the client). Listed copies are left out.
 */
export async function loadCards(supabase: SupabaseClient, userId: string): Promise<CollectionCard[]> {
  const { data } = await supabase
    .from('user_cards')
    .select('id, center_x, center_y, corners, edges, surface, border_wear, wear_seed, ' +
            'crease, holes, rips, cleaning_started_at, cleaning_ready_at, times_cleaned, ' +
            'grading_started_at, grading_ready_at, graded_at, grade, ' +
            'vending_cards!inner(id, set_code, number, name, rarity, image_url)')
    .eq('user_id', userId)
    .is('market_listing_id', null)
    .order('acquired_at')

  type Card = { id: number; set_code: string; number: string; name: string; rarity: string; image_url: string }
  type CopyRow = {
    id: number
    center_x: number; center_y: number
    corners: number; edges: number; surface: number; border_wear: number; wear_seed: number
    crease: number; holes: number; rips: number
    cleaning_started_at: string | null; cleaning_ready_at: string | null; times_cleaned: number
    grading_started_at: string | null; grading_ready_at: string | null
    graded_at: string | null; grade: number | null
    vending_cards: Card | Card[] | null
  }

  const cardMap = new Map<number, CollectionCard>()
  for (const row of (data as unknown as CopyRow[] | null) ?? []) {
    const c = one(row.vending_cards)
    if (!c) continue
    let entry = cardMap.get(c.id)
    if (!entry) {
      entry = { card_id: c.id, set_code: c.set_code, number: c.number, name: c.name, rarity: c.rarity, image_url: c.image_url, copies: [] }
      cardMap.set(c.id, entry)
    }
    const { vending_cards: _, ...copy } = row
    entry.copies.push(copy)
  }
  return [...cardMap.values()]
}

/** Totals per set, for the "12/102" completion counters. */
export async function loadSetTotals(supabase: SupabaseClient): Promise<SetTotal[]> {
  const { data } = await supabase.from('vending_cards').select('set_code')
  const counts = new Map<string, number>()
  for (const c of (data as { set_code: string }[] | null) ?? []) counts.set(c.set_code, (counts.get(c.set_code) ?? 0) + 1)
  return [...counts.entries()]
    .map(([set_code, total]) => ({ set_code, set_name: SET_NAMES[set_code] ?? set_code, total }))
    .sort((a, b) => a.set_code.localeCompare(b.set_code))
}

/** Raffle tickets you own, one row per ticket with a copy count. */
export async function loadOwnedTickets(supabase: SupabaseClient, userId: string): Promise<OwnedTicket[]> {
  const { data } = await supabase
    .from('user_raffle_tickets')
    .select('ticket_id, raffle_tickets(name, description, rarity, image_url)')
    .eq('user_id', userId)
  type T = { name: string; description: string | null; rarity: string; image_url: string | null }
  const map = new Map<number, OwnedTicket>()
  for (const row of (data as { ticket_id: number; raffle_tickets: T | T[] | null }[] | null) ?? []) {
    const t = one(row.raffle_tickets)
    if (!t) continue
    const existing = map.get(row.ticket_id)
    if (existing) existing.copies += 1
    else map.set(row.ticket_id, { ticket_id: row.ticket_id, name: t.name, description: t.description, rarity: t.rarity, image_url: t.image_url, copies: 1 })
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** Battle items you own, already one row per item with a count. */
export async function loadOwnedItems(supabase: SupabaseClient, userId: string): Promise<OwnedItem[]> {
  const { data } = await supabase
    .from('user_items')
    .select('item_key, qty, vvm_supplies(name, description, sort_order)')
    .eq('user_id', userId)
    .gt('qty', 0)
  type S = { name: string; description: string | null; sort_order: number }
  return ((data as { item_key: string; qty: number; vvm_supplies: S | S[] | null }[] | null) ?? [])
    .map((r) => ({ r, s: one(r.vvm_supplies) }))
    .sort((a, b) => (a.s?.sort_order ?? 0) - (b.s?.sort_order ?? 0))
    .map(({ r, s }) => ({ key: r.item_key, name: s?.name ?? r.item_key, description: s?.description ?? null, qty: r.qty }))
}

/** What grading and cleaning cost, and how long they take. */
export async function loadServiceSettings(supabase: SupabaseClient) {
  const [{ data: g }, { data: c }] = await Promise.all([supabase.rpc('grading_settings'), supabase.rpc('cleaning_settings')])
  const grading = one(g as { cost: number; days: number } | null)
  const cleaning = one(c as { cost: number; days: number } | null)
  return {
    gradingCost: Number(grading?.cost ?? 3), gradingDays: Number(grading?.days ?? 7),
    cleaningCost: Number(cleaning?.cost ?? 2), cleaningDays: Number(cleaning?.days ?? 3),
  }
}

/** Your showcase and its lighting. */
export async function loadShowcase(supabase: SupabaseClient, userId: string) {
  const [{ data: rows }, { data: cfg }] = await Promise.all([
    supabase.rpc('get_showcase', { p_user: userId }),
    supabase.from('showcase_settings').select('warmth, brightness, shelf, light_mode, hue').eq('user_id', userId).maybeSingle(),
  ])
  return {
    items: (rows as ShowcaseItem[] | null) ?? [],
    lighting: (cfg as Lighting | null) ?? ({ warmth: 55, brightness: 60, shelf: 'oak' } as Lighting),
  }
}

/** Everything on the market, your own listings, and the fee. */
export async function loadMarket(supabase: SupabaseClient) {
  const [{ data: listings }, { data: mine }, { data: fee }] = await Promise.all([
    supabase.rpc('get_market_listings', { p_mine: false }),
    supabase.rpc('get_market_listings', { p_mine: true }),
    supabase.rpc('market_fee_percent'),
  ])
  return {
    listings: (listings as MarketListing[] | null) ?? [],
    myListings: (mine as MarketListing[] | null) ?? [],
    feePercent: Number(fee ?? 10),
  }
}
