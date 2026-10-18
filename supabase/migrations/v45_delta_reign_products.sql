-- Delta Reign (ME06, releasing November 6, 2026) on the interest check.
--
-- The four products every standard set carries here (Booster Box, Bundle,
-- Elite Trainer Box, Single Packs), plus the two others announced for it:
-- the Pokémon Center Elite Trainer Box and the Build & Battle Box. Cases,
-- blisters and art bundles are left out, as they are for the other sets.
--
-- Images are self-hosted in public/products, named by the same slug rule v8
-- uses (set name + product name, lowercased, non-alphanumerics collapsed to
-- one dash), so the path is derived rather than listed. They were taken from
-- TCGplayer's 200px product thumbnails (ids 712094, 712097, 712102, 712099,
-- 712104, 712101).
--
-- Safe to re-run: an existing set or product is left alone.

insert into public.sets (name, set_type)
values ('Delta Reign', 'standard')
on conflict (name) do nothing;

insert into public.products (set_id, name, image_url)
select s.id, v.name,
       '/products/'
       || trim(both '-' from lower(regexp_replace(s.name || ' ' || v.name, '[^a-zA-Z0-9]+', '-', 'g')))
       || '.jpg'
  from public.sets s,
       (values ('Booster Box'), ('Bundle'), ('Elite Trainer Box'), ('Single Packs'),
               ('Pokemon Center Elite Trainer Box'), ('Build & Battle Box')) as v(name)
 where s.name = 'Delta Reign'
on conflict (set_id, name) do nothing;
