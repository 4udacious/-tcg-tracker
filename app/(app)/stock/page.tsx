import { createClient } from '@/lib/supabase/server'
import StockClient from './StockClient'

export default async function StockPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: areaRows }, { data: productTypes }, { data: recent }] = await Promise.all([
    supabase.from('store_locations').select('area').eq('is_active', true),
    supabase.from('product_types').select('id, name').order('sort_order'),
    supabase
      .from('stock_checks')
      .select('id, created_at, note, store_locations(label, area, retailers(name)), product_types(name), profiles(username)')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const distinctAreas = [...new Set((areaRows ?? []).map((r) => (r as any).area as string))].sort()

  return (
    <StockClient
      areas={distinctAreas}
      productTypes={(productTypes ?? []) as { id: string; name: string }[]}
      recentChecks={recent ?? []}
      userId={user.id}
    />
  )
}
