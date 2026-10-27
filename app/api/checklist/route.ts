import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/*
 * The Standard checklist's ticks on your account (public/checklist.html is a
 * static page, so it can't reach Supabase itself; it calls this, same-origin,
 * with your login cookie). The functions only ever touch your own row; see
 * supabase/migrations/v61_checklist_saves.sql.
 *
 *   GET  -> { data, rev }  (both null before your first save)
 *   PUT  { data, rev } -> { ok, reason, rev, data }  (on 'conflict', `data` is the account's newer save)
 */

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'not_signed_in' }, { status: 401 })
  const { data, error } = await supabase.rpc('checklist_get')
  if (error) return Response.json({ error: 'unavailable' }, { status: 503 })
  const row = Array.isArray(data) ? data[0] : data
  return Response.json({ data: row?.data ?? null, rev: row?.rev ?? null })
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'not_signed_in' }, { status: 401 })
  let body: { data?: unknown; rev?: unknown }
  try { body = await request.json() } catch { return Response.json({ error: 'bad_request' }, { status: 400 }) }
  const rev = typeof body.rev === 'number' && Number.isInteger(body.rev) ? body.rev : null
  const { data, error } = await supabase.rpc('checklist_put', { p_data: body.data ?? null, p_rev: rev })
  if (error) return Response.json({ error: 'unavailable' }, { status: 503 })
  const row = Array.isArray(data) ? data[0] : data
  return Response.json({ ok: !!row?.ok, reason: row?.reason ?? 'unavailable', rev: row?.rev ?? null, data: row?.data ?? null })
}
