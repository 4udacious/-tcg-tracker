import { createClient } from '@/lib/supabase/server'
import MachinesClient from './MachinesClient'

export default async function MachinesPage() {
  const supabase = await createClient()

  const { data: machines } = await supabase
    .from('machines')
    .select('id, machine_code, region, city, neighborhood, venue, address, nickname, latitude, longitude, is_active')
    .order('region')
    .order('city')
    .order('machine_code')

  return <MachinesClient machines={machines ?? []} />
}
