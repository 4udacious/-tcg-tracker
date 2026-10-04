'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ChatMessage {
  id: number
  user_id: string
  username: string
  display_name: string | null
  name_color: string | null
  avatar_url: string | null
  body: string
  created_at: string
  mine: boolean
}

/** "now", "4m", "2h" - a room this small never needs a date. */
function ago(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h`
}

/**
 * The lobby chat.
 *
 * Polled rather than subscribed, on the same beat as presence: the rest of
 * this app advances on reads, and a realtime channel for a few people stood
 * at a machine is not worth the moving parts. Each poll asks only for
 * messages newer than the last id held, so the usual answer is an empty list.
 */
export default function LobbyChat({ watching }: { watching: number }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const lastId = useRef(0)
  const listRef = useRef<HTMLDivElement>(null)
  // Only pin to the bottom when the reader is already there, so arriving
  // messages never yank someone out of what they were scrolled up reading.
  const atBottom = useRef(true)

  const poll = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.rpc('get_vending_chat', { p_since: lastId.current })
    const rows = (data as ChatMessage[] | null) ?? []
    if (rows.length === 0) return
    lastId.current = Math.max(lastId.current, ...rows.map((r) => r.id))
    setMessages((prev) => [...prev, ...rows].slice(-60))
  }, [])

  useEffect(() => {
    poll()
    const t = setInterval(poll, 5000)
    return () => clearInterval(t)
  }, [poll])

  useEffect(() => {
    const el = listRef.current
    if (el && atBottom.current) el.scrollTop = el.scrollHeight
  }, [messages])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const body = draft.trim()
    if (!body || sending) return
    setSending(true); setNote(null)
    const supabase = createClient()
    const { data, error } = await supabase.rpc('send_vending_chat', { p_body: body })
    setSending(false)
    const row = (Array.isArray(data) ? data[0] : data) as { ok: boolean; reason: string } | null
    if (error || !row?.ok) {
      setNote(
        row?.reason === 'too_fast' ? 'Give it a second.'
        : row?.reason === 'slow_down' ? 'That is enough for one minute.'
        : row?.reason === 'too_long' ? 'Too long — 240 characters.'
        : 'Could not send that.'
      )
      setTimeout(() => setNote(null), 3000)
      return
    }
    setDraft('')
    atBottom.current = true
    poll()
  }

  return (
    <section className="bg-card border border-card-border rounded-2xl overflow-hidden">
      <header className="flex items-baseline justify-between gap-2 px-3 py-2 border-b border-card-border">
        <h2 className="font-display font-semibold text-sm">Lobby</h2>
        <span className="font-mono text-[10px] text-muted">
          {watching === 0 ? 'just you' : `${watching + 1} here`}
        </span>
      </header>

      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24
        }}
        className="h-44 overflow-y-auto px-3 py-2 space-y-1.5"
      >
        {messages.length === 0 ? (
          <p className="text-xs text-muted py-6 text-center">
            Nothing said yet. Say hello while you wait for a restock.
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="text-sm leading-snug">
              <span
                className="font-semibold text-xs"
                style={m.name_color ? { color: m.name_color } : undefined}
              >
                {m.display_name ?? m.username}
              </span>
              <span className="font-mono text-[9px] text-muted ml-1.5">{ago(m.created_at)}</span>
              {/* Rendered as text, never as markup. */}
              <span className="block break-words">{m.body}</span>
            </div>
          ))
        )}
      </div>

      <form onSubmit={send} className="flex gap-1.5 p-2 border-t border-card-border">
        <label htmlFor="lobby-msg" className="sr-only">Message the lobby</label>
        <input
          id="lobby-msg"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={240}
          placeholder="Say something…"
          className="flex-1 min-w-0 bg-paper border border-card-border rounded-xl px-3 py-2 text-sm outline-none focus:border-signal placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={sending || draft.trim().length === 0}
          className="shrink-0 rounded-xl bg-signal text-white text-sm font-semibold px-4 hover:bg-signal/90 transition-colors disabled:opacity-40"
        >
          Send
        </button>
      </form>

      {note && <p className="px-3 pb-2 text-[11px] text-amber-600">{note}</p>}
    </section>
  )
}
