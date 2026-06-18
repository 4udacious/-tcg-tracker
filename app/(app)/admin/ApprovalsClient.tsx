'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Toast, useToast } from '@/components/Toast'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Profile {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  discord_id: string | null
}

export default function AdminApprovalsClient({ pending }: { pending: Profile[] }) {
  const router = useRouter()
  const { toast, show, dismiss } = useToast()
  const [isPending, startTransition] = useTransition()
  const [query, setQuery] = useState('')

  const filtered = query
    ? pending.filter(p =>
        (p.username ?? '').toLowerCase().includes(query.toLowerCase()) ||
        (p.display_name ?? '').toLowerCase().includes(query.toLowerCase())
      )
    : pending

  async function handleApprove(id: string) {
    const supabase = createClient()
    const { error } = await (supabase as any).rpc('approve_user', { target: id })
    if (error) { show('Approval failed.', 'error'); return }
    show('User approved.', 'success')
    startTransition(() => router.refresh())
  }

  async function handleRemove(id: string) {
    if (!confirm('Remove this user permanently?')) return
    const supabase = createClient()
    const { error } = await supabase.from('profiles').delete().eq('id', id)
    if (error) { show('Failed to remove.', 'error'); return }
    show('User removed.', 'info')
    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-5">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          Approvals
        </h1>
        <div className="flex gap-3 text-xs">
          <Link href="/admin/catalog" className="text-[var(--signal)] hover:underline">Catalog</Link>
          <Link href="/admin/machines" className="text-[var(--signal)] hover:underline">Machines</Link>
          <Link href="/admin/roles" className="text-[var(--signal)] hover:underline">Roles</Link>
        </div>
      </div>

      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search username…"
        className="w-full bg-[var(--card)] border border-[var(--card-border)] rounded-xl px-4 py-3 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--signal)]"
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-[var(--muted)] text-center py-8">
          {pending.length === 0 ? 'No pending approvals.' : 'No matches.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map(p => (
            <li
              key={p.id}
              className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl px-4 py-3 flex items-center gap-3"
            >
              {p.avatar_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.avatar_url} alt="" className="w-9 h-9 rounded-full shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--ink)] truncate">
                  {p.display_name ?? p.username ?? 'Unknown'}
                </p>
                {p.username && (
                  <p className="text-xs text-[var(--muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
                    @{p.username}
                  </p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => handleApprove(p.id)}
                  disabled={isPending}
                  className="px-3 py-1.5 rounded-lg bg-[var(--ok)] text-white text-xs font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleRemove(p.id)}
                  disabled={isPending}
                  className="px-3 py-1.5 rounded-lg border border-[var(--card-border)] text-xs font-semibold text-[var(--muted)] hover:text-[var(--danger)] hover:border-[var(--danger)] disabled:opacity-40 transition-colors"
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
