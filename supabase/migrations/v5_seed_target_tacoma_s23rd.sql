-- ============================================================
-- v5 migration: seed Target — S 23rd St, Tacoma
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor).
-- Pure data insert (no schema changes). Idempotent — re-running
-- inserts nothing on the second run.
-- ============================================================

-- ─── 1. Ensure the "Target" retailer exists ──────────────────
-- Uses a NOT EXISTS guard rather than ON CONFLICT so we don't
-- depend on retailers.name having a UNIQUE constraint.
insert into public.retailers (name)
select 'Target'
where not exists (
  select 1 from public.retailers where name = 'Target'
);

-- ─── 2. Add the store location ───────────────────────────────
-- Match against retailer_id + address to make this idempotent:
-- if a store with the same address already exists under Target,
-- do nothing.
insert into public.store_locations
  (retailer_id, region, city, label, address, is_active)
select
  r.id,
  'WA',
  'Tacoma',
  'S 23rd St',
  '3320 S 23rd St, Tacoma, WA 98405',
  true
from public.retailers r
where r.name = 'Target'
  and not exists (
    select 1
    from public.store_locations sl
    where sl.retailer_id = r.id
      and sl.address = '3320 S 23rd St, Tacoma, WA 98405'
  );
