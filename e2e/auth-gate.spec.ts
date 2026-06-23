import { test, expect } from '@playwright/test'

// Smoke test for proxy.ts: with no Supabase session, every protected route
// must redirect to /login. This needs no live database — supabase.auth.getUser()
// returns no user, so the proxy's "no session → /login" branch fires.
const PROTECTED_ROUTES = ['/', '/interest', '/stock', '/timers', '/admin']

for (const route of PROTECTED_ROUTES) {
  test(`unauthenticated ${route} redirects to /login`, async ({ page }) => {
    await page.goto(route)
    await expect(page).toHaveURL(/\/login$/)
  })
}

test('the /login page itself is reachable without a session', async ({ page }) => {
  const response = await page.goto('/login')
  expect(response?.status()).toBe(200)
  await expect(page).toHaveURL(/\/login$/)
})
