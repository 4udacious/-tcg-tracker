-- Finite inventory per set, so a set can run out for good rather than the
-- machine inventing 1-5 packs from nothing every cycle.
--
-- Shaped like raffle_tickets (total_quantity / claimed_quantity) so both
-- kinds of stock behave and read the same way. total_quantity NULL means
-- unlimited, which is the behaviour every set has had until now - so this
-- changes nothing until an admin sets a number.
--
-- build_vending_stock now excludes exhausted sets and caps each cycle's
-- offer at what the set actually has left. See the applied migration for
-- the full function bodies.

alter table public.vending_set_info
  add column if not exists total_quantity int
    check (total_quantity is null or total_quantity >= 0),
  add column if not exists claimed_quantity int not null default 0
    check (claimed_quantity >= 0);
