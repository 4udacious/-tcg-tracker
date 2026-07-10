import { createClient } from '@/lib/supabase/client'

/** Calls check_achievements RPC and returns names of any newly earned badges. */
export async function checkAchievements(userId: string): Promise<string[]> {
  const supabase = createClient()
  const { data: ids } = await supabase.rpc('check_achievements', { target: userId })
  if (!ids || ids.length === 0) return []
  const { data: achieved } = await supabase
    .from('achievements')
    .select('name')
    .in('id', ids)
  return (achieved ?? []).map((a: { name: string }) => a.name)
}
