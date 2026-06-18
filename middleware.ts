import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database, Role } from './lib/supabase/types'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Public routes — always allowed
  if (pathname === '/login' || pathname.startsWith('/auth/')) {
    return supabaseResponse
  }

  // No session → login
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Fetch role
  const { data: profileData } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const profile = profileData as { role: Role } | null
  const role = profile?.role ?? 'pending'

  // Pending → pending screen (unless already there)
  if (role === 'pending' && pathname !== '/pending') {
    return NextResponse.redirect(new URL('/pending', request.url))
  }

  // Approved users shouldn't linger on /pending
  if (role !== 'pending' && pathname === '/pending') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Admin-only routes
  if (pathname.startsWith('/admin/catalog') || pathname.startsWith('/admin/machines') || pathname.startsWith('/admin/roles')) {
    if (role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  // Mod+ routes
  if (pathname.startsWith('/admin')) {
    if (role !== 'mod' && role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
