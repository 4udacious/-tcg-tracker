'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Toast, useToast } from '@/components/Toast'
import { useRouter } from 'next/navigation'
import type { Role } from '@/lib/supabase/types'

const ROLE_OPTIONS: Role[] = ['member', 'mod', 'admin']

export default function RolesClient({ members }: { members: any[] }) {
  const router = useRouter()
  const { toast, show, dismiss } = useToast()
  const [isPending, startTransition] = useTransition()
  const [query, setQuery] = useState('')

  const filtered = query
    ? members.filter(m =>
        (m.username ?? '').toLowerCase().includes(query.toLowerCase()) ||
        (m.display_name ?? '').toLowerCase().includes(query.toLowerCase())
      )
    : members

  async function handleSetRole(id: string, newRole: Role) {
    const supabase = createClient()
    const { error } = await (supabase as any).rpc('set_role', { target: id, new_role: newRole })
    if (error) { show('Failed to update role.', 'error'); return }
    show(`Role updated to ${newRole}.`, 'success')
    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-5">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}

      <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Roles</h1>

      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search member…"
        className="w-full bg-[var(--card)] border border-[var(--card-border)] rounded-xl px-4 py-3 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--signal)]"
      />

      <ul className="space-y-2">
        {filtered.map((m: any) => (
          <li key={m.id} className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl px-4 py-3">
            <div className="flex items-center gap-3 mb-3">
              {m.avatar_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.avatar_url} alt="" className="w-8 h-8 rounded-full" />
              )}
              <div>
                <p className="text-sm font-medium">{m.display_name ?? m.username}</p>
                <p className="text-xs text-[var(--muted)] font-mono">@{m.username} · currently {m.role}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {ROLE_OPTIONS.map(role => (
                <button
                  key={role}
                  onClick={() => handleSetRole(m.id, role)}
                  disabled={isPending || m.role === role}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                    m.role === role
                      ? 'bg-[var(--ink)] text-white border-[var(--ink)]'
                      : 'border-[var(--card-border)] text-[var(--muted)] hover:border-[var(--signal)] hover:text-[var(--ink)] disabled:opacity-40'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
