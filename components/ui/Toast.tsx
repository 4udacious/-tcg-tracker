'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

/*
 * Short confirmations and errors after an action ("Listed for 4 tokens",
 * "Not enough tokens"), stacked at the top and read out by
 * screen readers. They drop in just under the header, clear of the tab bar
 * and of any sheet that's open. useToast() from anywhere under <ToastProvider>.
 */
type Tone = 'ok' | 'error' | 'info'
type Toast = { id: number; text: string; tone: Tone }
type ToastApi = { show: (text: string, tone?: Tone) => void; ok: (text: string) => void; error: (text: string) => void }

const Ctx = createContext<ToastApi | null>(null)

const TONE: Record<Tone, string> = {
  ok: 'bg-ok text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-[#0E1726] text-white',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const next = useRef(0)

  const show = useCallback((text: string, tone: Tone = 'info') => {
    const id = ++next.current
    // At most three at once: a fourth pushes the oldest out.
    setToasts((t) => [...t.slice(-2), { id, text, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 6000 : 3500)
  }, [])
  const api = useMemo<ToastApi>(() => ({ show, ok: (t) => show(t, 'ok'), error: (t) => show(t, 'error') }), [show])

  return (
    <Ctx.Provider value={api}>
      {children}
      <div aria-live="polite" role="status"
        className="pointer-events-none fixed inset-x-0 top-[calc(4rem+env(safe-area-inset-top))] z-[80] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div key={t.id}
            className={`pointer-events-auto max-w-sm w-full rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg ui-toast-in ${TONE[t.tone]}`}
            onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}>
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

/** Outside a provider (a page rendered on its own) this quietly does nothing. */
export function useToast(): ToastApi {
  return useContext(Ctx) ?? { show: () => {}, ok: () => {}, error: () => {} }
}
