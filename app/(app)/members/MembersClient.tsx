'use client'

import { useState } from 'react'
import Link from 'next/link'

export interface MemberSummary {
  id: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  role: string
  trainerIconFile: string | null
  badgeCount: number
}

function MemberAvatar({ member, size = 44 }: { member: MemberSummary; size?: number }) {
  const cls = 'rounded-full object-contain bg-paper shrink-0'
  if (member.trainerIconFile) {
    return <img src={`/Trainers/${member.trainerIconFile}`} alt="" width={size} height={size} className={cls} style={{ width: size, height: size }} />
  }
  if (member.avatarUrl) {
    return <img src={member.avatarUrl} alt="" width={size} height={size} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
  }
  const initial = (member.displayName ?? member.username ?? '?').charAt(0).toUpperCase()
  return (
    <div
      className="rounded-full bg-ink/10 flex items-center justify-center font-bold text-muted shrink-0"
      style={{ width: size, height: size }}
    >
      {initial}
    </div>
  )
}

export default function MembersClient({ members }: { members: MemberSummary[] }) {
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? members.filter((m) =>
        (m.displayName ?? '').toLowerCase().includes(query.toLowerCase()) ||
        m.username.toLowerCase().includes(query.toLowerCase())
      )
    : members

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="font-display font-bold text-lg">Members</h1>
        <p className="text-sm text-muted font-mono">{members.length} in the community</p>
      </div>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search members…"
        className="w-full bg-card border border-card-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-signal focus:ring-2 focus:ring-signal/20 placeholder:text-muted"
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-muted">No members found.</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((m) => (
            <li key={m.id}>
              <Link
                href={`/members/${m.id}`}
                className="flex items-center gap-3 bg-card border border-card-border rounded-2xl px-4 py-3 hover:border-ink/20 transition-colors"
              >
                <MemberAvatar member={m} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">{m.displayName ?? m.username}</p>
                  <p className="font-mono text-xs text-muted capitalize">{m.role}</p>
                </div>
                {m.badgeCount > 0 && (
                  <span className="shrink-0 flex items-center gap-1 text-xs font-mono text-muted">
                    🏅 {m.badgeCount}
                  </span>
                )}
                <svg className="w-4 h-4 text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
