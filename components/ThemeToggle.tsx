'use client'

import { useEffect, useState } from 'react'

/**
 * Night mode switch. The actual theme is applied by the pre-paint script in the
 * root layout; this reads what that decided and flips it from there, so there's
 * no flash and no hydration mismatch.
 */
export default function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null)

  useEffect(() => {
    setDark(document.documentElement.getAttribute('data-theme') === 'dark')
  }, [])

  function toggle() {
    const next = !dark
    setDark(next)
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light')
    // An explicit choice sticks per device and stops following the OS setting.
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light')
    } catch {
      // Private mode / blocked storage: the toggle still works for this visit.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark ?? false}
      aria-label={dark ? 'Switch to light mode' : 'Switch to night mode'}
      title={dark ? 'Light mode' : 'Night mode'}
      className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-colors"
    >
      {/* Render nothing until mounted so SSR markup matches either theme. */}
      {dark === null ? null : dark ? (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="4" />
          <path strokeLinecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" />
        </svg>
      )}
    </button>
  )
}
