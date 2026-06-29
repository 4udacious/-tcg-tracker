import { createClient } from '@/lib/supabase/server'
import CatalogClient from './CatalogClient'

export default async function CatalogPage() {
  const supabase = await createClient()

  const [{ data: sets }, { data: products }, { data: retailers }, { data: stores }] =
    await Promise.all([
      supabase.from('sets').select('id, name, set_type, sort_order, is_active').order('sort_order').order('name'),
      supabase.from('products').select('id, name, set_id, is_active').order('name'),
      supabase.from('retailers').select('id, name').order('name'),
      supabase
        .from('store_locations')
        .select('id, region, city, neighborhood, label, address, latitude, longitude, is_active, retailer_id')
        .order('region')
        .order('city')
        .order('label'),
    ])

  return (
    <CatalogClient
      sets={sets ?? []}
      products={products ?? []}
      retailers={retailers ?? []}
      stores={stores ?? []}
    />
  )
}
