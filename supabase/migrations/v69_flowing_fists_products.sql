-- Flowing Fists on the interest check: the first English Mega Evolution set
-- of 2027, the English counterpart of Japan's "Aura Seeker" (Nov 27, 2026),
-- led by Mega Lucario Z ex.
--
-- Reported, not yet officially announced: PokeBeach reported the name and a
-- February 5, 2027 release (prereleases January 23-31) on October 20, 2026,
-- and retailers are already listing Elite Trainer Box pre-orders. The Pokémon
-- Company hasn't published an English product list yet, so this carries the
-- four products every main set here has: Booster Box, Bundle, Elite Trainer
-- Box and Single Packs. Special products (a Pokémon Center Elite Trainer Box,
-- Build & Battle Box) can follow once they're announced.
--
-- Sources:
--   https://www.pokebeach.com/2026/10/flowing-fists-pokemon-tcg-set-to-release-in-february-starring-mega-lucario-z-ex
--   https://www.wargamer.com/pokemon-trading-card-game/flowing-fists
--   https://pokennoisseur.ca/tools/release-calendar
--
-- No images yet: the official site and the retailers' image hosts weren't
-- reachable when this was written. The interest page shows its plain box icon
-- until image_url is set.
--
-- Safe to re-run: an existing set or product is left alone.

insert into public.sets (name, set_type, game)
values ('Flowing Fists', 'standard', 'pokemon')
on conflict (name) do nothing;

insert into public.products (set_id, name, sort_order)
select s.id, v.name, v.sort_order
  from public.sets s,
       (values ('Booster Box', 1), ('Bundle', 2), ('Elite Trainer Box', 3), ('Single Packs', 4)) as v(name, sort_order)
 where s.name = 'Flowing Fists'
on conflict (set_id, name) do nothing;
