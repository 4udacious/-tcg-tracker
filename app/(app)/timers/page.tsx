import { createClient } from '@/lib/supabase/server'
import TimersClient from './TimersClient'

export default async function TimersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Distinct areas from active machines
  const { data: machineRows } = await supabase
    .from('machines')
    .select('area')
    .eq('is_active', true)

  const distinctAreas = [...new Set((machineRows ?? []).map((r: any) => r.area))].sort()

  // Today's timer reports
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { data: todayReports } = await supabase
    .from('timer_reports')
    .select('id, minutes, success, reported_at, machines(id, machine_code, venue, nickname, area, address), profiles(username)')
    .gte('reported_at', todayStart.toISOString())
    .order('reported_at', { ascending: false })

  return (
    <TimersClient
      areas={distinctAreas}
      todayReports={todayReports ?? []}
      userId={user.id}
    />
  )
}
