import { createClient } from '@/lib/supabase/server'
import CatalogClient from './CatalogClient'

export default async function CatalogPage() {
  const supabase = await createClient()

  const [{ data: sets }, { data: products }, { data: retailers }, { data: stores }] = await Promise.all([
    supabase.from('sets').select('*').order('sort_order').order('name'),
    supabase.from('products').select('*, sets(name)').order('sort_order').order('name'),
    supabase.from('retailers').select('*').order('name'),
    supabase.from('store_locations').select('*, retailers(name)').order('area').order('label'),
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
