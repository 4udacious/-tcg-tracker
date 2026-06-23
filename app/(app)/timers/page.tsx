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

  // Timer reports from the last 24h (rolling window, not a calendar day — a
  // server-timezone midnight boundary made WA entries vanish ~8am local).
  // eslint-disable-next-line react-hooks/purity -- server component renders once per request
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: recentReports } = await supabase
    .from('timer_reports')
    .select('id, minutes, success, reported_at, machines(id, machine_code, venue, nickname, area, address), profiles(username)')
    .gte('reported_at', since)
    .order('reported_at', { ascending: false })

  return (
    <TimersClient
      areas={distinctAreas}
      recentReports={recentReports ?? []}
      userId={user.id}
    />
  )
}
