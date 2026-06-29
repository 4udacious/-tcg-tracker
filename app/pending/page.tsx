import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SignOutButton from '@/components/SignOutButton'

export default async function PendingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <main className="min-h-screen bg-ink flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-signal/10 border border-signal/30">
            <svg className="w-7 h-7 text-signal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
            </svg>
          </div>
          <h1 className="font-display text-2xl font-bold text-white">
            You&apos;re in the queue
          </h1>
          <p className="text-white/50 text-sm leading-relaxed">
            An organizer will approve you shortly. Check back soon.
          </p>
        </div>
        <SignOutButton variant="ghost" />
      </div>
    </main>
  )
}
