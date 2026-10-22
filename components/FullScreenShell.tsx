'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'

/**
 * The frame for anything that takes over the whole screen, like a battle: no
 * header, no tabs, just the content filling the phone and an exit in the
 * corner.
 *
 * With `guard` on (mid-battle), leaving asks first, however it's attempted:
 * the exit button, the phone's Back button, or closing/reloading the tab.
 */
export default function FullScreenShell({ title, exitHref = '/vending', guard = false, guardText, onLeave, children }: {
  title: string
  exitHref?: string
  guard?: boolean
  /** What leaving costs, for the "Leave?" question. */
  guardText?: string
  /** Runs just before leaving (a game saving, say). */
  onLeave?: () => void
  children: ReactNode
}) {
  const router = useRouter()
  const [asking, setAsking] = useState(false)
  const guarding = useRef(guard)
  guarding.current = guard

  // Back while guarded: put the page back and ask instead.
  useEffect(() => {
    if (!guard) return
    history.pushState({ ...(history.state ?? {}), fullscreen: true }, '')
    const onPop = () => {
      if (!guarding.current) return
      history.pushState({ ...(history.state ?? {}), fullscreen: true }, '')
      setAsking(true)
    }
    const onUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('popstate', onPop)
    window.addEventListener('beforeunload', onUnload)
    return () => { window.removeEventListener('popstate', onPop); window.removeEventListener('beforeunload', onUnload) }
  }, [guard])

  function leave() {
    try { onLeave?.() } catch {}
    guarding.current = false
    setAsking(false)
    router.push(exitHref)
  }

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="absolute top-[max(0.5rem,env(safe-area-inset-top))] left-2 z-20">
        <button type="button" onClick={() => (guard ? setAsking(true) : leave())} aria-label={`Leave ${title}`}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur flex items-center justify-center">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <main className="flex-1 min-h-0 flex items-center justify-center" aria-label={title}>
        {children}
      </main>
      <Sheet open={asking} onClose={() => setAsking(false)} title={`Leave ${title}?`}
        footer={(
          <div className="flex gap-2">
            <Button variant="outline" full onClick={() => setAsking(false)}>Stay</Button>
            <Button variant="danger" full onClick={leave}>Leave</Button>
          </div>
        )}>
        <p className="text-sm text-muted">{guardText ?? "You're in the middle of it. Leave now and it ends here."}</p>
      </Sheet>
    </div>
  )
}
