'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Props {
  variant?: 'default' | 'ghost'
}

export default function SignOutButton({ variant = 'default' }: Props) {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (variant === 'ghost') {
    return (
      <button
        onClick={handleSignOut}
        className="text-white/40 hover:text-white/70 text-sm transition-colors underline underline-offset-4"
      >
        Sign out
      </button>
    )
  }

  return (
    <button
      onClick={handleSignOut}
      className="text-sm text-muted hover:text-ink transition-colors"
    >
      Sign out
    </button>
  )
}
