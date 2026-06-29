import { createClient } from '@/lib/supabase/server'
import TimersClient from './TimersClient'

export default async function TimersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const [
    { data: machines },
    { data: favorites },
    { data: conditionTypes },
    { data: todayReports },
    { data: todayConditions },
  ] = await Promise.all([
    supabase
      .from('machines')
      .select('id, machine_code, region, city, neighborhood, venue, address, nickname')
      .eq('is_active', true),
    supabase
      .from('machine_favorites')
      .select('machine_id, machines(id, machine_code, venue, nickname, address)')
      .eq('user_id', userId),
    supabase.from('condition_types').select('id, name').order('sort_order'),
    supabase
      .from('timer_reports')
      .select('id, machine_id, user_id, minutes, success, reported_at, profiles(username, display_name)')
      .gte('reported_at', startOfToday.toISOString())
      .order('reported_at', { ascending: false }),
    supabase
      .from('machine_conditions')
      .select('id, machine_id, user_id, note, created_at, condition_types(name), profiles(username, display_name)')
      .gte('created_at', startOfToday.toISOString())
      .order('created_at', { ascending: false }),
  ])

  return (
    <TimersClient
      machines={machines ?? []}
      favorites={favorites ?? []}
      conditionTypes={conditionTypes ?? []}
      todayReports={todayReports ?? []}
      todayConditions={todayConditions ?? []}
      userId={userId}
    />
  )
}
