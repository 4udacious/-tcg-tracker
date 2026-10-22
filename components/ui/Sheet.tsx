'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * The app's one overlay: a sheet that rises from the bottom on a phone and
 * sits centred on wider screens. It closes the ways people expect, all of
 * them going through `onClose`:
 *
 *   - the phone's (or browser's) Back button: opening pushes a history entry,
 *     so Back closes the sheet instead of leaving the page
 *   - Escape, a tap on the backdrop, or the close button
 *
 * The page behind stops scrolling while it's open, focus moves into it, and
 * goes back to whatever opened it afterwards.
 */
// A Back-button entry being handed back. Deferred a tick so an immediate
// remount (React's development double-mount) can keep it instead.
let pendingBack: { id: string; timer: ReturnType<typeof setTimeout> } | null = null

export function Sheet({ open, onClose, title, children, footer, accent, wide = false, hideClose = false, header }: {
  open: boolean
  onClose: () => void
  /** Shown as the heading and used as the dialog's accessible name. */
  title: string
  children: ReactNode
  /** Pinned under the scrolling body: the sheet's main actions. */
  footer?: ReactNode
  /** A colour stripe along the top edge. */
  accent?: string
  wide?: boolean
  hideClose?: boolean
  /** Replaces the visible heading (an editable title, a back arrow); `title` still names the dialog for screen readers. */
  header?: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()
  // Kept in a ref so the effect below doesn't re-run (and re-push history) when the parent re-renders.
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    // Back closes the sheet: give it an entry of its own to pop.
    let popped = false
    if (pendingBack?.id === titleId && history.state?.sheet === titleId) {
      clearTimeout(pendingBack.timer); pendingBack = null   // remounted straight away: keep the entry
    } else {
      history.pushState({ ...(history.state ?? {}), sheet: titleId }, '')
    }
    const onPop = () => { popped = true; closeRef.current() }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); closeRef.current() } }
    window.addEventListener('popstate', onPop)
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    requestAnimationFrame(() => panel.current?.focus())
    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      // Closed some other way: take back the history entry we added.
      if (!popped && history.state?.sheet === titleId) {
        const timer = setTimeout(() => { pendingBack = null; if (history.state?.sheet === titleId) history.back() }, 0)
        pendingBack = { id: titleId, timer }
      }
      opener?.focus?.()
    }
  }, [open, titleId])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center" role="presentation">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px] ui-fade-in" onClick={() => onClose()} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative w-full ${wide ? 'sm:max-w-lg' : 'sm:max-w-sm'} max-h-[88vh] flex flex-col bg-card text-ink border border-card-border shadow-2xl rounded-t-3xl sm:rounded-2xl outline-none ui-sheet-in pb-[env(safe-area-inset-bottom)]`}
        style={accent ? { borderTop: `4px solid ${accent}` } : undefined}
      >
        {/* The grab handle: only a hint on phones, where sheets come from the bottom. */}
        <div className="sm:hidden mx-auto mt-2 h-1.5 w-10 rounded-full bg-ink/15" aria-hidden />
        <div className="flex items-center gap-2 px-4 pt-3 pb-2">
          {header ? (
            <>
              <h2 id={titleId} className="sr-only">{title}</h2>
              <div className="flex-1 min-w-0">{header}</div>
            </>
          ) : (
            <h2 id={titleId} className="flex-1 min-w-0 font-display font-bold text-base leading-tight truncate">{title}</h2>
          )}
          {!hideClose && (
            <button type="button" onClick={() => onClose()} aria-label="Close"
              className="shrink-0 w-10 h-10 -mr-2 rounded-xl flex items-center justify-center text-muted hover:text-ink hover:bg-ink/5 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
        {footer && <div className="px-4 py-3 border-t border-card-border">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
