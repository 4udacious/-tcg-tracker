import Link from 'next/link'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

/*
 * The app's buttons. Every size is at least 40px tall, which is about the
 * smallest a thumb hits reliably; `sm` is for dense rows where a 40px target
 * still comes from the surrounding padding.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-signal text-white hover:bg-signal/90',
  secondary: 'bg-ink text-white hover:opacity-90',
  outline: 'border border-card-border bg-card text-ink hover:border-ink/30',
  ghost: 'text-muted hover:text-ink hover:bg-ink/5',
  danger: 'bg-red-600 text-white hover:bg-red-600/90',
}
const SIZE: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 text-xs rounded-lg',
  md: 'min-h-10 px-4 text-sm rounded-xl',
  lg: 'min-h-12 px-5 text-base rounded-xl',
}

export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', full = false, extra = '') {
  return `inline-flex items-center justify-center gap-2 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-paper ${VARIANT[variant]} ${SIZE[size]} ${full ? 'w-full' : ''} ${extra}`
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  full?: boolean
  /** Shows a spinner and blocks clicks. */
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', full, loading, disabled, className = '', children, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} aria-busy={loading || undefined}
      className={buttonClass(variant, size, full, className)} {...rest}>
      {loading && <Spinner />}
      {children}
    </button>
  )
})

/** A link styled as a button, for navigation that looks like an action. */
export function ButtonLink({ href, variant = 'primary', size = 'md', full, className = '', children }: {
  href: string; variant?: ButtonVariant; size?: ButtonSize; full?: boolean; className?: string; children: ReactNode
}) {
  return <Link href={href} className={buttonClass(variant, size, full, className)}>{children}</Link>
}

/** A square, icon-only button: always 40px, always labelled for screen readers. */
export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { label: string; tone?: 'plain' | 'onInk' }>(
  function IconButton({ label, tone = 'plain', className = '', children, type = 'button', ...rest }, ref) {
    const look = tone === 'onInk' ? 'text-white bg-white/10 hover:bg-white/20' : 'text-muted hover:text-ink hover:bg-ink/5'
    return (
      <button ref={ref} type={type} aria-label={label} title={label}
        className={`relative inline-flex items-center justify-center w-10 h-10 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal ${look} ${className}`}
        {...rest}>
        {children}
      </button>
    )
  },
)

export function Spinner({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
