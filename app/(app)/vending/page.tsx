import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import VvmGame, { type RecentBuy } from './VvmGame'
import { gameCornerAccess } from '../game-corner/access'

export const dynamic = 'force-dynamic'

// The VVM's other views are pages of their own now; old links still land.
const MOVED: Record<string, string> = { collection: '/collection', showcase: '/showcase', market: '/market' }

/* The VVM tab: the battle game's machine, with the lobby chat and recent buys under it. */
export default async function VendingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const asked = (await searchParams).view
  if (typeof asked === 'string' && MOVED[asked]) redirect(MOVED[asked])

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const [{ data: recentBuys }, corner, { data: attractUrls }] = await Promise.all([
    supabase.rpc('vending_recent_buys', { p_limit: 6 }),
    gameCornerAccess(supabase, user!.id),   // the Game Corner's card: once it's open, or to admins
    supabase.rpc('vending_attract_packs', { p_sets: 6 }),   // the idle screen's packs (v120; none before it)
  ])

  return <VvmGame userId={user!.id} initialBuys={(recentBuys as RecentBuy[] | null) ?? []} gameCorner={corner.visible ? (corner.open ? 'open' : 'admins') : null}
    attract={attractNames(attractUrls)} />
}

/**
 * The machine's idle screen: the packs of the six sets stocked most recently, as their art's names ('/packs/x.webp' is
 * 'x'). The game finds a small copy of each in /rpg/a/attract. Without any, it shows its own few.
 */
function attractNames(urls: unknown): string[] {
  if (!Array.isArray(urls)) return []
  const names = urls.map((u) => (typeof u === 'string' ? /^\/packs\/([a-z0-9-]+)\.webp$/.exec(u)?.[1] : undefined))
  return [...new Set(names.filter((n): n is string => !!n))].slice(0, 40)
}
