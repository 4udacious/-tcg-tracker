import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SettingsApplier from '@/components/SettingsApplier'
import { ToastProvider } from '@/components/ui/Toast'

/**
 * Full-screen pages (battles): signed in like the rest of the app, but
 * without the header and tab bar. Each page frames itself in FullScreenShell.
 */
export default async function PlayLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return (
    <ToastProvider>
      <SettingsApplier />
      {children}
    </ToastProvider>
  )
}
