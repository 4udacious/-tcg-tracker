import { createClient } from '@/lib/supabase/server'
import FeedClient, { type FeedItem, type Highlight } from './FeedClient'

export const dynamic = 'force-dynamic'

/*
 * Feed: what the community has been up to (v74's home_feed), with a strip of
 * what's hot right now (home_highlights) above it.
 */
export default async function FeedPage() {
  const supabase = await createClient()
  const [{ data: items }, { data: highlights }] = await Promise.all([
    supabase.rpc('home_feed', { p_before: null, p_limit: 40 }),
    supabase.rpc('home_highlights'),
  ])

  return <FeedClient initialItems={(items as FeedItem[] | null) ?? []} initialHighlights={(highlights as Highlight[] | null) ?? []} />
}
