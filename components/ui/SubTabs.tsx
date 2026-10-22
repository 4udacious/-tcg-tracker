'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

/**
 * The strip of tabs inside a section (Trainer: Cards · Showcase; Community:
 * Members · Interest · Market). Each is a real route, so the Back button,
 * links and bookmarks all land on the right one.
 */
export type SubTab = { href: string; label: string; badge?: ReactNode }

export function SubTabs({ tabs, label }: { tabs: SubTab[]; label: string }) {
  const pathname = usePathname()
  return (
    <nav aria-label={label} className="flex gap-1 p-1 rounded-xl bg-card border border-card-border">
      {tabs.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + '/')
        return (
          <Link key={t.href} href={t.href} aria-current={active ? 'page' : undefined}
            className={`flex-1 min-h-10 inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors ${
              active ? 'bg-ink text-white' : 'text-muted hover:text-ink'
            }`}>
            {t.label}
            {t.badge}
          </Link>
        )
      })}
    </nav>
  )
}
