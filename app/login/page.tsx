import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SignInButton from '@/components/SignInButton'

export default async function LoginPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/')

  return (
    <main className="min-h-screen bg-ink flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="space-y-2">
          <Image
            src="/logo.png"
            alt="TCG Tracker logo"
            width={112}
            height={112}
            priority
            className="mx-auto mb-2 w-24 h-24 rounded-full"
          />
          <h1 className="font-display text-3xl font-bold text-white tracking-tight">
            TCG Tracker
          </h1>
          <p className="text-sm text-white/50 font-mono">
            community restock intel
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-6">
          <div className="space-y-1">
            <p className="text-white font-medium">Sign in to continue</p>
            <p className="text-white/40 text-sm">
              Members only. Discord account required.
            </p>
          </div>
          <SignInButton />
        </div>
      </div>
    </main>
  )
}
