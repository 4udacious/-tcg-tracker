@AGENTS.md

# tcg-tracker

Mobile-first Pokémon TCG community tracker. **Next.js 16 (App Router) · React 19 · Supabase (SSR auth) · Tailwind v4 · TypeScript strict.**

## Commands
- `npm run dev` — local dev server (needs `.env.local`; see `.env.example`).
- `npm run lint` / `npm run typecheck` — ESLint / `tsc --noEmit`.
- `npm run test` / `npm run test:watch` — Vitest unit tests (jsdom + Testing Library).
- `npm run e2e` — Playwright (mobile-chrome / Pixel 7). Auth-gate smoke needs no live DB.
- CI: `.github/workflows/ci.yml` — `verify` job (typecheck → test → build) is the hard gate; `lint` and `e2e` are separate non-blocking jobs for now.

## Auth & access
`proxy.ts` (Next 16 renamed `middleware` → `proxy`) gates every route by Supabase session + `profiles.role`:
unauthenticated → `/login`; `pending` → `/pending`; `/admin/*` (catalog/machines/roles) is **admin-only**; `/admin` (approvals) is **mod+**. Roles: `pending | member | mod | admin`.

## Data model (Supabase — see `lib/supabase/types.ts`)
Tables: `profiles`, `sets`, `products`, `retailers`, `store_locations`, `machines`, `product_types`, `product_interest`, `stock_checks`, `timer_reports`.
View: `v_interest_overview` (per-product interest counts). RPCs: `approve_user(target)`, `set_role(target, new_role)`.
Feature → write target: `/interest`→`product_interest`, `/stock`→`stock_checks`, `/timers`→`timer_reports`.

## Known follow-ups
- **Lint debt (blocked):** ~38 `@typescript-eslint/no-explicit-any` remain, all `(supabase as any)` casts working around a hand-written `lib/supabase/types.ts` that lacks `Relationships` metadata (postgrest infers `insert`/`update`/`rpc`/embedded-selects as `never`). Real fix = regenerate via `supabase gen types typescript --project-id <ref>`, then strip the casts and add Row-derived types. Needs Supabase CLI access. The CI `lint` job is non-blocking until this lands.
- A stray `C:\Users\Arman\package-lock.json` (empty orphan) was mis-detected as the workspace root; pinned via `turbopack.root` in `next.config.ts`. Delete that file to fix it globally.
