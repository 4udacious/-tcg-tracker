'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/*
 * Five sections. Two of them group several pages under one tab, with their
 * own strip of sub-tabs at the top of the page:
 *
 *   Home       /                         the community feed
 *   Timers     /timers
 *   VVM        /vending                  the machine itself
 *   Trainer    /collection, /showcase    what you own (and, next, your party)
 *   Community  /members, /interest, /market
 *
 * Admin and the stock check-in preview live in the account menu (UserMenu).
 * What needs your attention is in the bell, not on the tabs.
 */
const tabs = [
  {
    href: '/',
    match: ['/'],
    label: 'Home',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5L12 3l9 7.5M5 9v11a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V9" />,
  },
  {
    href: '/timers',
    match: ['/timers'],
    label: 'Timers',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />,
  },
  {
    href: '/vending',
    match: ['/vending'],
    label: 'VVM',
    icon: (
      <>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 3.75h14a1 1 0 011 1v14.5a1 1 0 01-1 1H5a1 1 0 01-1-1V4.75a1 1 0 011-1z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h5v5H7zM15 7h2M15 10h2M7 16h10" />
      </>
    ),
  },
  {
    href: '/collection',
    match: ['/collection', '/showcase'],
    label: 'Trainer',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" d="M3 12h6m6 0h6" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
  },
  {
    href: '/members',
    match: ['/members', '/interest', '/market'],
    label: 'Community',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />,
  },
]

export default function BottomTabNav() {
  const pathname = usePathname()
  return (
    <nav aria-label="Sections" className="fixed bottom-0 inset-x-0 bg-card border-t border-card-border safe-area-inset-bottom z-50">
      <div className="max-w-lg mx-auto flex">
        {tabs.map((tab) => {
          const active = tab.match.some((m) => pathname === m || pathname.startsWith(m + '/'))
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center gap-1 min-h-14 py-2.5 px-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-inset ${
                active ? 'text-signal' : 'text-muted hover:text-ink'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>{tab.icon}</svg>
              <span className={active ? 'font-semibold' : 'font-medium'}>{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
