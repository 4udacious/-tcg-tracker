'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function PendingPage() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[var(--paper)]">
      <div className="w-full max-w-sm text-center">
        <div
          className="text-4xl mb-4"
          style={{ fontFamily: 'var(--font-mono)' }}
          aria-hidden
        >
          ⏳
        </div>
        <h1
          className="text-2xl font-bold text-[var(--ink)] mb-3"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          You&apos;re in the queue
        </h1>
        <p className="text-[var(--muted)] text-sm leading-relaxed mb-8">
          An organizer will approve your account shortly. Check back after you&apos;ve been approved.
        </p>
        <button
          onClick={handleSignOut}
          className="text-sm text-[var(--muted)] hover:text-[var(--ink)] underline underline-offset-2 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
