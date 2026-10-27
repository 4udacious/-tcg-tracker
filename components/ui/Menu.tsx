'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * A button that drops a small panel down from the header (the bell, the
 * account menu). A tap outside, Escape, or picking an item closes it.
 */
export function Menu({ trigger, label, children, width = 'w-72', onOpenChange }: {
  /** What the header shows; receives whether the menu is open. */
  trigger: (open: boolean) => ReactNode
  label: string
  /** The panel; gets a `close` to call from its items. */
  children: (close: () => void) => ReactNode
  width?: string
  /** Called after the menu opens or closes. */
  onOpenChange?: (open: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  // Skip the first render: the menu starts closed, that's not a change.
  const changed = useRef(onOpenChange)
  changed.current = onOpenChange
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    changed.current?.(open)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div ref={root} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={label}
        className="relative inline-flex items-center justify-center min-w-10 h-10 rounded-xl text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal">
        {trigger(open)}
      </button>
      {open && (
        <div role="menu" aria-label={label}
          className={`absolute right-0 top-full mt-2 ${width} max-w-[calc(100vw-1.5rem)] max-h-[70vh] overflow-y-auto rounded-2xl border border-card-border bg-card text-ink shadow-2xl p-1.5 ui-pop-in z-50`}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

const ROW = 'flex items-center gap-3 w-full min-h-11 px-3 py-2 rounded-xl text-left text-sm hover:bg-ink/5 transition-colors'

/** `page`: a static page in public/ rather than an app route, opened with a plain link instead of client-side navigation. */
export function MenuLink({ href, icon, children, onSelect, aside, page }: {
  href: string; icon?: ReactNode; children: ReactNode; onSelect?: () => void; aside?: ReactNode; page?: boolean
}) {
  const inner = (
    <>
      {icon && <span className="w-5 h-5 shrink-0 text-muted flex items-center justify-center" aria-hidden>{icon}</span>}
      <span className="flex-1 min-w-0">{children}</span>
      {aside}
    </>
  )
  return page
    ? <a href={href} role="menuitem" onClick={onSelect} className={ROW}>{inner}</a>
    : <Link href={href} role="menuitem" onClick={onSelect} className={ROW}>{inner}</Link>
}

export function MenuButton({ onClick, icon, children, aside, danger }: {
  onClick: () => void; icon?: ReactNode; children: ReactNode; aside?: ReactNode; danger?: boolean
}) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className={`${ROW} ${danger ? 'text-red-600' : ''}`}>
      {icon && <span className={`w-5 h-5 shrink-0 flex items-center justify-center ${danger ? '' : 'text-muted'}`} aria-hidden>{icon}</span>}
      <span className="flex-1 min-w-0">{children}</span>
      {aside}
    </button>
  )
}

export function MenuDivider() {
  return <div className="my-1 h-px bg-card-border" role="separator" />
}
