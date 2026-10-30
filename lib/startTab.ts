/**
 * Which tab the app opens on (Settings → Start on). Kept per device like the
 * other settings, but in a cookie rather than localStorage so the server can
 * send `/` straight to it without a flash of the wrong page.
 */
export const START_TAB_COOKIE = 'tcg-start-tab'

export const START_TABS = [
  { id: 'timers', label: 'Timers', href: '/timers' },
  { id: 'feed', label: 'Feed', href: '/feed' },
  { id: 'vending', label: 'VVM', href: '/vending' },
  { id: 'trainer', label: 'Trainer', href: '/collection' },
  { id: 'community', label: 'Community', href: '/members' },
] as const

export type StartTab = (typeof START_TABS)[number]['id']

/** Where `/` goes: the saved tab, or Timers. */
export function startHref(id: string | undefined): string {
  return START_TABS.find((t) => t.id === id)?.href ?? '/timers'
}
