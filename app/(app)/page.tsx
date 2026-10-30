import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { START_TAB_COOKIE, startHref } from '@/lib/startTab'

/* Opening the app: the tab picked in Settings → Start on, or Timers. */
export default async function StartPage() {
  const jar = await cookies()
  redirect(startHref(jar.get(START_TAB_COOKIE)?.value))
}
