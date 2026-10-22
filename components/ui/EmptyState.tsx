import type { ReactNode } from 'react'

/** What a list says when it has nothing in it yet, and what to do about it. */
export function EmptyState({ icon, title, children, action, className = '' }: {
  icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode; className?: string
}) {
  return (
    <div className={`flex flex-col items-center text-center gap-2 rounded-2xl border border-dashed border-card-border px-6 py-8 ${className}`}>
      {icon && <div className="text-3xl text-muted" aria-hidden>{icon}</div>}
      <p className="font-display font-semibold text-sm">{title}</p>
      {children && <div className="text-sm text-muted max-w-xs">{children}</div>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  )
}
