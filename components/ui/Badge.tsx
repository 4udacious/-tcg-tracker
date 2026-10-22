/*
 * Counts and markers. CountBadge is the number on a tab or icon; Dot is the
 * "something new" marker where a number would be noise.
 */
type Tone = 'signal' | 'amber' | 'sky' | 'red' | 'muted'

const TONE: Record<Tone, string> = {
  signal: 'bg-signal text-white',
  amber: 'bg-amber-400 text-[#0E1726]',
  sky: 'bg-sky-400 text-[#0E1726]',
  red: 'bg-red-600 text-white',
  muted: 'bg-ink/15 text-ink',
}

export function CountBadge({ count, tone = 'signal', max = 99, label, className = '' }: {
  count: number; tone?: Tone; max?: number; label?: string; className?: string
}) {
  if (count <= 0) return null
  return (
    <span aria-label={label} className={`inline-flex items-center justify-center min-w-[1.125rem] h-[1.125rem] px-1 rounded-full font-mono text-[10px] font-bold leading-none ${TONE[tone]} ${className}`}>
      {count > max ? `${max}+` : count}
    </span>
  )
}

export function Dot({ tone = 'red', className = '' }: { tone?: Tone; className?: string }) {
  return <span aria-hidden className={`inline-block w-2.5 h-2.5 rounded-full ${TONE[tone]} ${className}`} />
}

/** A small label pill: NEW, BUNDLE, a role. */
export function Pill({ children, tone = 'muted', className = '' }: { children: React.ReactNode; tone?: Tone; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${TONE[tone]} ${className}`}>
      {children}
    </span>
  )
}
