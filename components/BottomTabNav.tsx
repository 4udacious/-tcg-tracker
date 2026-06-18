'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Role } from '@/lib/supabase/types'

const memberTabs = [
  { href: '/', label: 'Home', icon: HomeIcon },
  { href: '/interest', label: 'Interest', icon: StarIcon },
  { href: '/stock', label: 'Stock', icon: BoxIcon },
  { href: '/timers', label: 'Timers', icon: ClockIcon },
]

export default function BottomTabNav({ role }: { role: Role }) {
  const pathname = usePathname()

  const isAdmin = role === 'admin' || role === 'mod'

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-[var(--ink)] border-t border-white/10 z-40 safe-bottom"
      aria-label="Main navigation"
    >
      <div className="flex max-w-lg mx-auto">
        {memberTabs.map(tab => {
          const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
                active
                  ? 'text-[var(--signal)]'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              <tab.icon active={active} />
              {tab.label}
            </Link>
          )
        })}
        {isAdmin && (
          <Link
            href="/admin"
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
              pathname.startsWith('/admin')
                ? 'text-[var(--signal)]'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            <ShieldIcon active={pathname.startsWith('/admin')} />
            Admin
          </Link>
        )}
      </div>
    </nav>
  )
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M3 8.5L10 2l7 6.5V17a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8.5Z"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.5}
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.15 : 0}
        strokeLinejoin="round"
      />
      <path d="M7.5 18V12h5v6" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  )
}

function StarIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M10 2l2.39 4.84 5.34.78-3.87 3.77.91 5.32L10 14.27 5.23 16.7l.91-5.32L2.27 7.62l5.34-.78L10 2Z"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.5}
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.2 : 0}
        strokeLinejoin="round"
      />
    </svg>
  )
}

function BoxIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M3 7l7-4 7 4v9l-7 3-7-3V7Z"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.5}
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.15 : 0}
        strokeLinejoin="round"
      />
      <path d="M3 7l7 4m0 0l7-4m-7 4v9" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  )
}

function ClockIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth={active ? 2 : 1.5} />
      <path d="M10 6v4.5l2.5 2" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ShieldIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M10 2L3 5v5c0 4.418 3.134 7.552 7 8.5C13.866 17.552 17 14.418 17 10V5L10 2Z"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.5}
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.2 : 0}
        strokeLinejoin="round"
      />
    </svg>
  )
}
