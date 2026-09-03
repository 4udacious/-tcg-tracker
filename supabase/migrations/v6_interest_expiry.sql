-- Interest entries expire after 2 weeks unless marked "forever need".
--
-- expires_at semantics:
--   future timestamp -> actively tracked, counts toward the community board
--   past timestamp   -> lapsed; still visible to its owner so they can re-add,
--                       but excluded from the board and from other people's views
--   NULL             -> "forever need", no time limit until the user removes it
--
-- Rows are kept rather than deleted so (a) owners can see what lapsed and
-- one-tap revive it, and (b) achievement progress counts stay intact.
--
-- Postgres 11+ backfills existing rows with the default, so everyone currently
-- tracking something gets a fresh 2 weeks rather than having their list expire
-- the moment this runs.

alter table public.product_interest
  add column if not exists expires_at timestamptz default (now() + interval '14 days');

-- Reads filter on this constantly (board, by-person, member profiles).
create index if not exists product_interest_expires_at_idx
  on public.product_interest (expires_at);
