import type { HTMLAttributes, ReactNode } from 'react'

/** The app's standard panel: card colour, hairline border, rounded. */
export function Card({ className = '', padded = true, children, ...rest }: HTMLAttributes<HTMLDivElement> & { padded?: boolean }) {
  return (
    <div className={`bg-card border border-card-border rounded-2xl ${padded ? 'p-4' : ''} ${className}`} {...rest}>
      {children}
    </div>
  )
}

/** A section heading, with optional quiet text or an action on the right. */
export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <h2 className="font-display font-semibold text-base">{children}</h2>
      {aside && <div className="text-xs text-muted shrink-0">{aside}</div>}
    </div>
  )
}
