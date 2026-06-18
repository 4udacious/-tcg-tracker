'use client'

import { useEffect, useState } from 'react'

interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'info'
  onDismiss: () => void
}

export function Toast({ message, type = 'info', onDismiss }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500)
    return () => clearTimeout(t)
  }, [onDismiss])

  const colors = {
    success: 'bg-[var(--ok)] text-white',
    error: 'bg-[var(--danger)] text-white',
    info: 'bg-[var(--ink)] text-white',
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-lg ${colors[type]} max-w-xs text-center`}
    >
      {message}
    </div>
  )
}

export function useToast() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  function show(message: string, type: 'success' | 'error' | 'info' = 'info') {
    setToast({ message, type })
  }

  function dismiss() {
    setToast(null)
  }

  return { toast, show, dismiss }
}
