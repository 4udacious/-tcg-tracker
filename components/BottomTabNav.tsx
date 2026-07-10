'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface Props {
  role: string
}

const tabs = [
  {
    href: '/timers',
    label: 'Timers',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
      </svg>
    ),
  },
  {
    href: '/interest',
    label: 'Interest',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 5h6" />
      </svg>
    ),
  },
  {
    href: '/stock',
    label: 'Stock',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
      </svg>
    ),
  },
]

export default function BottomTabNav({ role }: Props) {
  const pathname = usePathname()
  const showAdmin = role === 'mod' || role === 'admin'

  const allTabs = showAdmin
    ? [
        ...tabs,
        {
          href: '/admin',
          label: 'Admin',
          icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          ),
        },
      ]
    : tabs

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-card border-t border-card-border safe-area-inset-bottom z-50">
      <div className="flex">
        {allTabs.map((tab) => {
          const active = pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 px-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-inset ${
                active ? 'text-signal' : 'text-muted hover:text-ink'
              }`}
            >
              {tab.icon}
              <span className={`font-medium ${active ? 'font-semibold' : ''}`}>
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
