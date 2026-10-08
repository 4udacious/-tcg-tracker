import { createClient } from '@/lib/supabase/server'
import VendingClient, { type RecentBuy, type TicketStockRow } from './VendingClient'
import type { UnopenedPack, CollectionCard, SetTotal, OwnedTicket } from './CollectionPanel'
import type { ShowcaseItem } from './ShowcaseRoom'
import type { MarketListing } from './MarketPanel'

export const dynamic = 'force-dynamic'

const SET_NAMES: Record<string, string> = {
  base1: 'Base Set',
  base2: 'Jungle',
  base3: 'Fossil',
  base5: 'Team Rocket',
}

export default async function VendingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id

  // Advancing the cycle happens inside this call, so the first visitor after
  // a cycle expires is the one who rolls it over for everybody.
  const { data: stateRows } = await supabase.rpc('get_vending_state')
  const state = (Array.isArray(stateRows) ? stateRows[0] : stateRows) ?? null

  const showStock = state && (state.status === 'in_stock' || state.status === 'out_of_stock')

  const [{ data: stock }, { data: ticketStock }, { data: balance }, { data: me }, { data: packRows }, { data: collection }, { data: catalog }] =
    await Promise.all([
      showStock
        ? supabase.rpc('get_vending_stock', { p_cycle: state.cycle_no })
        : Promise.resolve({ data: [] }),
      showStock
        ? supabase.rpc('get_vending_ticket_stock', { p_cycle: state.cycle_no })
        : Promise.resolve({ data: [] }),
      supabase.rpc('token_breakdown'),
      supabase.from('profiles').select('vending_cooldown_until').eq('id', userId).single(),
      supabase
        .from('user_packs')
        .select('id, vending_packs(set_name, pack_name, image_url)')
        .eq('user_id', userId)
        .is('opened_at', null)
        .is('market_listing_id', null)
        .order('acquired_at'),
      // Per copy, not per card: two copies of one card have different
      // condition, so they cannot be collapsed before they reach the client.
      supabase
        .from('user_cards')
        .select('id, center_x, center_y, corners, edges, surface, border_wear, wear_seed, ' +
                'grading_started_at, grading_ready_at, graded_at, grade, ' +
                'vending_cards!inner(id, set_code, number, name, rarity, image_url)')
        .eq('user_id', userId)
        .is('market_listing_id', null)
        .order('acquired_at'),
      supabase.from('vending_cards').select('set_code'),
    ])

  const bd = (Array.isArray(balance) ? balance[0] : balance) as
    { total: number; allowance: number; earned: number } | null

  const { data: recentBuys } = await supabase.rpc('vending_recent_buys', { p_limit: 6 })

  const [{ data: showcaseRows }, { data: showcaseCfg }] = await Promise.all([
    supabase.rpc('get_showcase', { p_user: userId }),
    supabase.from('showcase_settings')
      .select('warmth, brightness, shelf, light_mode, hue').eq('user_id', userId).maybeSingle(),
  ])

  const { data: marketRows } = await supabase.rpc('get_market_listings', { p_mine: false })
  const { data: myListingRows } = await supabase.rpc('get_market_listings', { p_mine: true })

  const { data: feeRow } = await supabase.rpc('market_fee_percent')

  // Only the count, for the badge on the Market tab. The notices themselves
  // are fetched by the panel that shows them.
  const { data: noticeRows } = await supabase.rpc('get_market_notices', { p_limit: 50 })
  const marketUnread = ((noticeRows as { unread: boolean }[] | null) ?? [])
    .filter((n) => n.unread).length

  const { data: gradingRows } = await supabase.rpc('grading_settings')
  const grading = (Array.isArray(gradingRows) ? gradingRows[0] : gradingRows) as
    { cost: number; days: number } | null

  // Owned raffle tickets, collapsed to one row per ticket with a copy count.
  const { data: ticketRows } = await supabase
    .from('user_raffle_tickets')
    .select('ticket_id, raffle_tickets(name, description, rarity, image_url)')
    .eq('user_id', userId)

  type OwnedRow = {
    ticket_id: number
    raffle_tickets:
      | { name: string; description: string | null; rarity: string; image_url: string | null }
      | { name: string; description: string | null; rarity: string; image_url: string | null }[]
      | null
  }

  const ticketMap = new Map<number, OwnedTicket>()
  for (const row of (ticketRows as OwnedRow[] | null) ?? []) {
    const t = Array.isArray(row.raffle_tickets) ? row.raffle_tickets[0] : row.raffle_tickets
    if (!t) continue
    const existing = ticketMap.get(row.ticket_id)
    if (existing) existing.copies += 1
    else ticketMap.set(row.ticket_id, {
      ticket_id: row.ticket_id,
      name: t.name,
      description: t.description,
      rarity: t.rarity,
      image_url: t.image_url,
      copies: 1,
    })
  }
  const ownedTickets = [...ticketMap.values()].sort((a, b) => a.name.localeCompare(b.name))

  type PackRow = {
    id: number
    vending_packs:
      | { set_name: string; pack_name: string; image_url: string }
      | { set_name: string; pack_name: string; image_url: string }[]
      | null
  }

  const packs: UnopenedPack[] = ((packRows as PackRow[] | null) ?? []).map((r) => {
    const p = Array.isArray(r.vending_packs) ? r.vending_packs[0] : r.vending_packs
    return {
      id: r.id,
      set_name: p?.set_name ?? '',
      pack_name: p?.pack_name ?? '',
      image_url: p?.image_url ?? '',
    }
  })

  // Group the copies under their card, keeping each copy's own condition.
  type CopyRow = {
    id: number
    center_x: number; center_y: number
    corners: number; edges: number; surface: number; border_wear: number; wear_seed: number
    grading_started_at: string | null; grading_ready_at: string | null
    graded_at: string | null; grade: number | null
    vending_cards:
      | { id: number; set_code: string; number: string; name: string; rarity: string; image_url: string }
      | { id: number; set_code: string; number: string; name: string; rarity: string; image_url: string }[]
      | null
  }

  const cardMap = new Map<number, CollectionCard>()
  for (const row of (collection as CopyRow[] | null) ?? []) {
    const c = Array.isArray(row.vending_cards) ? row.vending_cards[0] : row.vending_cards
    if (!c) continue
    let entry = cardMap.get(c.id)
    if (!entry) {
      entry = {
        card_id: c.id,
        set_code: c.set_code,
        number: c.number,
        name: c.name,
        rarity: c.rarity,
        image_url: c.image_url,
        copies: [],
      }
      cardMap.set(c.id, entry)
    }
    entry.copies.push({
      id: row.id,
      center_x: row.center_x,
      center_y: row.center_y,
      corners: row.corners,
      edges: row.edges,
      surface: row.surface,
      border_wear: row.border_wear,
      wear_seed: row.wear_seed,
      grading_started_at: row.grading_started_at,
      grading_ready_at: row.grading_ready_at,
      graded_at: row.graded_at,
      grade: row.grade,
    })
  }
  const cards = [...cardMap.values()]

  // Totals per set, for the "12/102" completion counters.
  const counts = new Map<string, number>()
  for (const c of (catalog as { set_code: string }[] | null) ?? []) {
    counts.set(c.set_code, (counts.get(c.set_code) ?? 0) + 1)
  }
  const setTotals: SetTotal[] = [...counts.entries()]
    .map(([set_code, total]) => ({ set_code, set_name: SET_NAMES[set_code] ?? set_code, total }))
    .sort((a, b) => a.set_code.localeCompare(b.set_code))

  return (
    <VendingClient
      initialState={state}
      initialStock={stock ?? []}
      initialTickets={(ticketStock as TicketStockRow[] | null) ?? []}
      balance={Number(bd?.total ?? 0)}
      allowance={Number(bd?.allowance ?? 0)}
      earned={Number(bd?.earned ?? 0)}
      userId={userId}
      cooldownUntil={me?.vending_cooldown_until ?? null}
      packs={packs}
      collection={cards}
      setTotals={setTotals}
      ownedTickets={ownedTickets}
      recentBuys={(recentBuys as RecentBuy[] | null) ?? []}
      gradingCost={Number(grading?.cost ?? 3)}
      gradingDays={Number(grading?.days ?? 7)}
      showcaseItems={(showcaseRows as ShowcaseItem[] | null) ?? []}
      showcaseLighting={showcaseCfg ?? { warmth: 55, brightness: 60, shelf: 'oak' }}
      listings={(marketRows as MarketListing[] | null) ?? []}
      myListings={(myListingRows as MarketListing[] | null) ?? []}
      feePercent={Number(feeRow ?? 10)}
      marketUnread={marketUnread}
    />
  )
}
