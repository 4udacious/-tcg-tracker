'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Comment {
  id: string
  user_id: string
  body: string
  created_at: string
  username: string
  display_name: string | null
  trainer_icon_file: string | null
}

interface Props {
  machineId: string
  userId: string
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function MachineComments({ machineId, userId }: Props) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(false)
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function fetchComments() {
    const supabase = createClient()
    const { data } = await supabase
      .from('v_machine_comments')
      .select('id, user_id, body, created_at, username, display_name, trainer_icon_file')
      .eq('machine_id', machineId)
      .order('created_at', { ascending: false })
      .limit(30)
    setComments((data ?? []) as Comment[])
  }

  useEffect(() => {
    setComments([])
    setBody('')
    setLoading(true)
    fetchComments().finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machineId])

  async function handlePost() {
    const trimmed = body.trim()
    if (!trimmed) return
    setSubmitting(true)
    const supabase = createClient()
    await supabase
      .from('machine_comments')
      .insert({ user_id: userId, machine_id: machineId, body: trimmed })
    setBody('')
    await fetchComments()
    setSubmitting(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-ink">Discussion</h3>
        <span className="font-mono text-[10px] text-muted">expire after 14 days</span>
      </div>

      {/* Post box */}
      <div className="flex gap-2">
        <input
          type="text"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePost() } }}
          placeholder="Add a comment…"
          maxLength={500}
          className="flex-1 bg-paper border border-card-border rounded-xl px-3 py-2 text-sm outline-none focus:border-signal focus:ring-2 focus:ring-signal/20 placeholder:text-muted"
        />
        <button
          onClick={handlePost}
          disabled={!body.trim() || submitting}
          className="px-3 py-2 bg-signal hover:bg-signal/90 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors shrink-0"
        >
          Post
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted">No comments yet. Be the first.</p>
      ) : (
        <ul className="space-y-2.5">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-2">
              <div className="shrink-0 mt-0.5">
                {c.trainer_icon_file ? (
                  <img
                    src={`/Trainers/${c.trainer_icon_file}`}
                    alt=""
                    className="w-7 h-7 rounded-full object-contain bg-paper"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-ink/10 flex items-center justify-center text-xs font-bold text-muted">
                    {(c.display_name ?? c.username).charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-xs font-semibold text-ink">{c.display_name ?? c.username}</span>
                  <span className="font-mono text-[10px] text-muted">{timeAgo(new Date(c.created_at))}</span>
                </div>
                <p className="text-xs text-ink/80 leading-snug break-words">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
