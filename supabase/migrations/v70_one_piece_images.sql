-- Official product photos for the One Piece sets added in v68 (booster box and
-- booster pack for each, and the Double Pack Set 13), from Bandai's English
-- One Piece Card Game site (en.onepiece-cardgame.com, each set's product
-- page). Self-hosted in public/products like the Pokémon ones: trimmed,
-- flattened onto white and resized to 200 px wide, named by the same slug
-- rule v8 and v45 use (set name + product name, lowercased, non-alphanumerics
-- collapsed to one dash).
--
-- Only fills an empty image_url, so an image set from the admin catalog is
-- never replaced. Safe to re-run.

update public.products p
   set image_url = '/products/'
       || trim(both '-' from lower(regexp_replace(s.name || ' ' || p.name, '[^a-zA-Z0-9]+', '-', 'g')))
       || '.jpg'
  from public.sets s
 where s.id = p.set_id
   and s.game = 'one_piece'
   and s.name in ('OP-18 The Dominance of God', 'EB-05 Heroines Edition Vol. 2', 'OP-17 The World''s Strongest Warriors',
                  'OP-16 The Time of Battle', 'OP15-EB04 Adventure on Kami''s Island', 'OP14-EB04 The Azure Sea''s Seven')
   and p.name in ('Booster Box', 'Single Packs', 'Double Pack Set Vol. 13 (DP-13)')
   and p.image_url is null;
