-- Kayou's Naruto Smriti Collectible Card, Series 3: Chapter Jin (NRSA03), in
-- English, on the interest check under Naruto.
--
-- Released April 2026 (Kayou's product page, kayouofficial.com): 185 cards in
-- 13 rarity tiers, 8 cards a pack, 12 packs a box, 16 boxes a carton. US
-- retailers (Walmart, Best Buy, GameStop) also sell a 5-pack Collector Box
-- with a promo card, and single packs.
--
-- It sits after Bandai's Naruto Card Game sets from v71 (sort_order 3, as it's
-- already out and Bandai's launch is June 2027). No images yet: Kayou's site
-- wasn't reachable when this was written, so these show the plain box icon.
--
-- Safe to re-run: an existing set or product is left alone.

insert into public.sets (name, set_type, sort_order, game)
values ('Kayou NRSA03 Chapter Jin (Series 3)', 'standard', 3, 'naruto')
on conflict (name) do nothing;

insert into public.products (set_id, name, sort_order)
select s.id, v.name, v.sort_order
  from public.sets s
  cross join (values ('Booster Box', 1), ('Collector Box', 2), ('Single Packs', 3)) as v(name, sort_order)
 where s.name = 'Kayou NRSA03 Chapter Jin (Series 3)'
on conflict (set_id, name) do nothing;
