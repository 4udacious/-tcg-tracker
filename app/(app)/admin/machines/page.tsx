import { createClient } from '@/lib/supabase/server'
import MachinesClient from './MachinesClient'

export default async function MachinesAdminPage() {
  const supabase = await createClient()
  const [{ data: machines }, { data: stores }] = await Promise.all([
    supabase
      .from('machines')
      .select('*')
      .order('area')
      .order('machine_code'),
    supabase
      .from('store_locations')
      .select('id, label, area, retailers(name)')
      .eq('is_active', true)
      .order('area')
      .order('label'),
  ])

  return <MachinesClient machines={machines ?? []} stores={stores ?? []} />
}
