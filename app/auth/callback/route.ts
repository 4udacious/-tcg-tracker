import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Only allow same-origin, absolute-path redirects. Rejects `//evil.com`,
// backslash tricks, and any string that would resolve to a different origin
// once concatenated onto `origin`. Reference: OWASP unvalidated-redirects.
function safeNext(raw: string, origin: string): string {
  if (!raw.startsWith('/')) return '/'
  // Protocol-relative or backslash smuggling → force away.
  if (raw.startsWith('//') || raw.startsWith('/\\') || raw.startsWith('/%2f')) return '/'
  try {
    const url = new URL(raw, origin)
    if (url.origin !== origin) return '/'
    // Check what it resolved to as well as what came in: `/..//evil.com`
    // passes the checks above but normalises to the path `//evil.com`, which
    // the redirect would then read as another site.
    const path = url.pathname + url.search + url.hash
    return /^\/[/\\]/.test(path) ? '/' : path
  } catch {
    return '/'
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next') ?? '/', origin)

  // Supabase redirects here with error params when the provider step fails
  // (e.g. Discord returns no email for an unverified account).
  const providerError = searchParams.get('error_description') ?? searchParams.get('error')
  if (providerError) {
    console.error('[auth/callback] provider error:', providerError)
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(providerError)}`
    )
  }

  if (code) {
    // Build the redirect response first so we can set cookies directly on it.
    // Use new URL(next, origin) — never string-concat, which lets `@evil.com`
    // become the userinfo half of the URL and redirect off-site.
    const redirectResponse = NextResponse.redirect(new URL(next, origin))

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              redirectResponse.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return redirectResponse
    }

    console.error('[auth/callback] exchangeCodeForSession error:', error.message)
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    )
  }

  return NextResponse.redirect(new URL('/login?error=auth', origin))
}
