'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Member {
  id: string
  username: string | null
  display_name: string | null
  role: string
}

interface Props {
  members: Member[]
}

const ROLES = ['contributor', 'member', 'mod', 'admin']
const ROLE_COLORS: Record<string, string> = {
  // Contributors are members-minus-analytics; visually same weight as member.
  contributor: 'text-muted border-card-border',
  member: 'text-muted border-card-border',
  mod: 'text-[#818cf8] border-[#818cf8]/30',
  admin: 'text-signal border-signal/30',
}

export default function RolesClient({ members }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const filtered = query
    ? members.filter((m) =>
        (m.username ?? '').toLowerCase().includes(query.toLowerCase()) ||
        (m.display_name ?? '').toLowerCase().includes(query.toLowerCase())
      )
    : members

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function handleSetRole(id: string, newRole: string) {
    const supabase = createClient()
    const { error } = await supabase.rpc('set_role', { target: id, new_role: newRole })
    if (error) { showToast('Failed.'); return }
    showToast(`Role updated to ${newRole}.`)
    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-sm font-medium shadow-lg bg-ink text-white">
          {toast}
        </div>
      )}

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search members…"
        className="w-full bg-card border border-card-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-signal focus:ring-2 focus:ring-signal/20 placeholder:text-muted"
      />

      <ul className="space-y-2">
        {filtered.map((member) => (
          <li
            key={member.id}
            className="bg-card border border-card-border rounded-xl px-4 py-3 space-y-2"
          >
            <div>
              <p className="font-medium text-sm">{member.display_name ?? member.username}</p>
              {member.username && (
                <p className="font-mono text-xs text-muted">@{member.username}</p>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {ROLES.map((role) => (
                <button
                  key={role}
                  onClick={() => handleSetRole(member.id, role)}
                  className={`text-xs font-medium px-3 py-1 rounded-lg border transition-colors ${
                    member.role === role
                      ? ROLE_COLORS[role] + ' font-bold'
                      : 'text-muted border-card-border hover:text-ink'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </li>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted">{query ? 'No matches.' : 'No members.'}</p>
        )}
      </ul>
    </div>
  )
}
