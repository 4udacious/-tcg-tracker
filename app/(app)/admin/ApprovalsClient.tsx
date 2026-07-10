'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface PendingUser {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  created_at: string
}

interface Props {
  pendingUsers: PendingUser[]
}

export default function ApprovalsClient({ pendingUsers }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const filtered = query
    ? pendingUsers.filter((u) =>
        (u.username ?? '').toLowerCase().includes(query.toLowerCase()) ||
        (u.display_name ?? '').toLowerCase().includes(query.toLowerCase())
      )
    : pendingUsers

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function handleApprove(id: string, role: 'member' | 'contributor') {
    const supabase = createClient()
    const { error } = await supabase.rpc('set_role', { target: id, new_role: role })
    if (error) { showToast('Failed to approve.'); return }
    showToast(`Approved as ${role}.`)
    startTransition(() => router.refresh())
  }

  async function handleRemove(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('profiles').delete().eq('id', id)
    if (error) { showToast('Failed to remove.'); return }
    showToast('Removed.')
    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-sm font-medium shadow-lg bg-ink text-white">
          {toast}
        </div>
      )}

      <div className="space-y-1">
        <h2 className="font-display font-semibold text-base">Pending Approvals</h2>
        <p className="text-sm text-muted font-mono">{pendingUsers.length} in queue</p>
      </div>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search username…"
        className="w-full bg-card border border-card-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-signal focus:ring-2 focus:ring-signal/20 placeholder:text-muted"
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-muted">{query ? 'No matches.' : 'Queue is empty.'}</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((user) => (
            <li
              key={user.id}
              className="bg-card border border-card-border rounded-xl px-4 py-3 flex items-center justify-between gap-3"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="font-medium text-sm truncate">
                  {user.display_name ?? user.username ?? 'Unknown'}
                </p>
                {user.username && (
                  <p className="font-mono text-xs text-muted">@{user.username}</p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => handleApprove(user.id, 'member')}
                  disabled={isPending}
                  className="text-xs font-semibold text-ok border border-ok/30 rounded-lg px-3 py-1.5 hover:bg-ok/10 transition-colors disabled:opacity-50"
                >
                  Member
                </button>
                <button
                  onClick={() => handleApprove(user.id, 'contributor')}
                  disabled={isPending}
                  className="text-xs font-semibold text-sky-500 border border-sky-400/30 rounded-lg px-3 py-1.5 hover:bg-sky-50 transition-colors disabled:opacity-50"
                >
                  Contributor
                </button>
                <button
                  onClick={() => handleRemove(user.id)}
                  disabled={isPending}
                  className="text-xs font-semibold text-muted border border-card-border rounded-lg px-3 py-1.5 hover:text-ink hover:border-ink/20 transition-colors disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
