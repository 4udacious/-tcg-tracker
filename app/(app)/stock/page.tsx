import { createClient } from '@/lib/supabase/server'
import StockCheckForm from './StockCheckForm'

export default async function StockPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: stores }, { data: productTypes }, { data: recentChecks }, { data: favorites }] = await Promise.all([
    supabase
      .from('store_locations')
      .select('id, retailer_id, region, city, neighborhood, label, address, retailers(name)')
      .eq('is_active', true),
    supabase
      .from('product_types')
      .select('id, name')
      .order('sort_order'),
    supabase
      .from('stock_checks')
      .select('id, user_id, created_at, note, has_stock, store_locations(label, city, region, address, retailers(name)), product_types(name), profiles(username, display_name)')
      .order('created_at', { ascending: false })
      .limit(20),
    // RLS scopes this to the signed-in user's own favorites.
    supabase.from('store_favorites').select('store_location_id'),
  ])

  return (
    <StockCheckForm
      stores={stores ?? []}
      productTypes={productTypes ?? []}
      recentChecks={recentChecks ?? []}
      favoriteStoreIds={(favorites ?? []).map((f) => String(f.store_location_id))}
      userId={user!.id}
    />
  )
}
