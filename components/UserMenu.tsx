'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Menu, MenuLink, MenuButton, MenuDivider } from '@/components/ui/Menu'

/**
 * The account menu behind your name in the header: profile, settings, the
 * admin tools for those who have them, night mode, and signing out (kept at
 * the bottom, away from everything else, so it isn't hit by accident).
 */
export default function UserMenu({ name, nameColor, iconFile, role }: {
  name: string
  nameColor: string | null
  iconFile: string | null
  role: string
}) {
  const router = useRouter()
  const [dark, setDark] = useState<boolean | null>(null)
  useEffect(() => { setDark(document.documentElement.getAttribute('data-theme') === 'dark') }, [])

  function toggleTheme() {
    const next = !dark
    setDark(next)
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light')
    // An explicit choice sticks per device and stops following the OS setting.
    try { localStorage.setItem('theme', next ? 'dark' : 'light') } catch {}
  }

  async function signOut() {
    await createClient().auth.signOut()
    router.push('/login')
  }

  const staff = role === 'mod' || role === 'admin'

  return (
    <Menu label="Account" width="w-64"
      trigger={() => (
        <span className="flex items-center gap-1.5 pl-1 pr-1.5">
          {iconFile ? (
            <img src={`/Trainers/${iconFile}`} alt="" className="w-7 h-7 rounded-full object-contain bg-white/10" />
          ) : (
            <span className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center text-xs font-bold">{name.charAt(0).toUpperCase()}</span>
          )}
          <span className="hidden min-[400px]:block max-w-[7rem] truncate font-mono text-xs font-medium" style={nameColor ? { color: nameColor } : undefined}>{name}</span>
          <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
          </svg>
        </span>
      )}>
      {(close) => (
        <>
          <div className="px-3 pt-2 pb-2">
            <p className="font-display font-semibold text-sm truncate" style={nameColor ? { color: nameColor } : undefined}>{name}</p>
            <p className="font-mono text-[11px] text-muted capitalize">{role}</p>
          </div>
          <MenuLink href="/profile" onSelect={close} icon={<Icon d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.1a7.5 7.5 0 0115 0" />}>Trainer card</MenuLink>
          <MenuLink href="/settings" onSelect={close} icon={<Icon d="M10.3 4.3c.4-1.7 2.9-1.7 3.3 0a1.7 1.7 0 002.6 1.1c1.5-.9 3.3.8 2.3 2.3a1.7 1.7 0 001.1 2.6c1.7.4 1.7 2.9 0 3.3a1.7 1.7 0 00-1.1 2.6c.9 1.5-.8 3.3-2.3 2.3a1.7 1.7 0 00-2.6 1.1c-.4 1.7-2.9 1.7-3.3 0a1.7 1.7 0 00-2.6-1.1c-1.5.9-3.3-.8-2.3-2.3a1.7 1.7 0 00-1.1-2.6c-1.7-.4-1.7-2.9 0-3.3a1.7 1.7 0 001.1-2.6c-.9-1.5.8-3.3 2.3-2.3a1.7 1.7 0 002.6-1.1zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />}>Settings</MenuLink>
          <MenuButton onClick={toggleTheme}
            icon={<Icon d={dark ? 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.4 6.4l-.7-.7M6.3 6.3l-.7-.7m12.8 0l-.7.7M6.3 17.7l-.7.7M16 12a4 4 0 11-8 0 4 4 0 018 0z' : 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z'} />}
            aside={<span className={`w-9 h-5 rounded-full p-0.5 transition-colors ${dark ? 'bg-signal' : 'bg-ink/20'}`}><span className={`block w-4 h-4 rounded-full bg-white transition-transform ${dark ? 'translate-x-4' : ''}`} /></span>}>
            Night mode
          </MenuButton>
          {staff && (
            <>
              <MenuDivider />
              <p className="px-3 pt-1 pb-0.5 text-[10px] font-bold tracking-wide text-muted">STAFF</p>
              <MenuLink href="/admin" onSelect={close} icon={<Icon d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />}>Admin</MenuLink>
              {role === 'admin' && (
                <>
                <MenuLink href="/stock" onSelect={close} icon={<Icon d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />}>Stock check-in <span className="text-xs text-muted">(preview)</span></MenuLink>
                <MenuLink href="/play" onSelect={close} icon={<Icon d="M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h6m6 0h6M12 9a3 3 0 100 6 3 3 0 000-6z" />}>Battle <span className="text-xs text-muted">(preview)</span></MenuLink>
              </>
              )}
            </>
          )}
          <MenuDivider />
          <MenuButton onClick={signOut} danger icon={<Icon d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />}>Sign out</MenuButton>
        </>
      )}
    </Menu>
  )
}

function Icon({ d }: { d: string }) {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  )
}
