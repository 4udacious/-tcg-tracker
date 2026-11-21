import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Whether this member sees the Game Corner (v115): everyone once an admin
 * opens it, only admins while it's closed (so they can try it out first).
 * Before v115 there are no settings to read, and nobody sees it.
 */
export async function gameCornerAccess(supabase: SupabaseClient, userId: string): Promise<{ visible: boolean; open: boolean; admin: boolean }> {
  const [{ data: settings, error }, { data: me }] = await Promise.all([
    supabase.from('game_corner_settings').select('is_open').maybeSingle(),
    supabase.from('profiles').select('role').eq('id', userId).single(),
  ])
  const admin = me?.role === 'admin'
  const open = !error && !!settings?.is_open
  return { visible: !error && !!settings && (open || admin), open, admin }
}
