import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// A sign-in or role redirect is never stored: some paths it answers (the
// battle game's files) are cached for long in next.config.ts, and a browser
// that kept the redirect would keep being sent away after signing in.
function redirectTo(url: URL) {
  const res = NextResponse.redirect(url)
  res.headers.set('Cache-Control', 'no-store')
  return res
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Shared interest lists (/share/interest/<token>) are public read-only
  // pages: open to anyone, signed in or not, whatever their role.
  if (pathname.startsWith('/share/')) return supabaseResponse

  const isPublic =
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/pending')

  if (!user) {
    if (!isPublic) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return redirectTo(url)
    }
    return supabaseResponse
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'pending'

  if (role === 'pending' && pathname !== '/pending') {
    const url = request.nextUrl.clone()
    url.pathname = '/pending'
    return redirectTo(url)
  }

  if (role !== 'pending' && pathname === '/pending') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return redirectTo(url)
  }

  // Stock check-in stays admin-only while it is reworked. Gated here rather
  // than only hiding the tab, so a bookmark or a typed URL can't reach it
  // either.
  if (pathname.startsWith('/stock') && role !== 'admin') {
    const url = request.nextUrl.clone()
    url.pathname = '/timers'
    return redirectTo(url)
  }

  if (pathname.startsWith('/admin') && role !== 'mod' && role !== 'admin') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return redirectTo(url)
  }

  if (
    (pathname.startsWith('/admin/catalog') ||
      pathname.startsWith('/admin/machines') ||
      pathname.startsWith('/admin/roles') ||
      pathname.startsWith('/admin/achievements')) &&
    role !== 'admin'
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin'
    return redirectTo(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
