-- Weekly interest-check update (2026-11-23): four new products and fifteen
-- product photos. No new sets this week.
--
-- New products (English release dates from the sources listed):
--
--   Pokémon TCG:
--     Flowing Fists (ME07, added in v69)       Feb 6 2027, prereleases Jan 23-31 2027.
--       The Pokémon Company officially announced the set on Nov 19 2026 with its
--       product lineup; this adds the two products beyond the four v69 carries:
--         Pokemon Center Elite Trainer Box (Pokémon Center exclusive, 2 extra packs)
--         Build & Battle Box
--       https://www.pokebeach.com/2026/11/flowing-fists-tcg-set-officially-revealed-for-february-full-product-lineup-revealed
--       https://icv2.com/articles/news/view/63927/the-pokemon-company-announced-mega-evolution-flowing-fists
--       https://www.tcgplayer.com/product/735049 (the Pokémon Center ETB listing)
--       (PokeBeach's October report and TCGplayer's listings give Feb 5 2027;
--       the official announcement says Feb 6, as sets now release on Saturdays.)
--     Special Collections: 2027 Pokemon Day Collection   Jan 29 2027, US$14.99
--       (Pikachu promo with the Pokémon Day 2027 stamp, a coin, three packs)
--       https://www.pokeguardian.com/3447074_pokemon-day-2027-collection-revealed
--       https://godisageek.com/2026/11/pokemon-day-2027-collection/
--
--   One Piece Card Game:
--     EB-05 Heroines Edition Vol. 2: Gift Collection (GC-2026)   Nov 20 2026, US$44.99
--       (2 EB-05 packs, 10 promo cards, sleeves), from the official product page:
--       https://en.onepiece-cardgame.com/products/gift-collection.html
--
-- Images (JPEG, 200 px wide, on white, named by the slug rule of v8/v45/v70):
--   From en.onepiece-cardgame.com (the product page above):
--     EB-05 Heroines Edition Vol. 2: Gift Collection (GC-2026)
--   From TCGplayer's product images (tcgplayer-cdn.tcgplayer.com, product id):
--     Flowing Fists: Booster Box (735045), Bundle (735066), Elite Trainer Box
--       (735050), Single Packs (735046), Pokemon Center Elite Trainer Box
--       (735049), Build & Battle Box (735069)
--     Nauctis: The Sunken Realm: Play Booster Box (733551, "Booster Display"),
--       Collector Booster Box (733554), Bundle (733559), Single Packs (733550)
--     Marvel: Darkhold Destiny: Play Booster Box (723263, "Booster Display"),
--       Collector Booster Box (723266), Bundle (723269), Single Packs (723262)
--
-- New products get image_url in their insert; existing products only get one
-- when theirs is still empty, so an image set from the admin catalog is never
-- replaced. Safe to re-run: an existing product is left alone.

-- New products, after the ones already in each set.
insert into public.products (set_id, name, sort_order, image_url)
select s.id, v.product_name,
       (select coalesce(max(p.sort_order), 0) from public.products p where p.set_id = s.id) + v.step,
       case when v.has_image then
         '/products/'
         || trim(both '-' from lower(regexp_replace(s.name || ' ' || v.product_name, '[^a-zA-Z0-9]+', '-', 'g')))
         || '.jpg'
       end
  from public.sets s
  join (values
    ('Flowing Fists',                 'Pokemon Center Elite Trainer Box', 1, true),
    ('Flowing Fists',                 'Build & Battle Box',               2, true),
    ('Special Collections',           '2027 Pokemon Day Collection',      1, false),
    ('EB-05 Heroines Edition Vol. 2', 'Gift Collection (GC-2026)',        1, true)
  ) as v(set_name, product_name, step, has_image)
    on s.name = v.set_name
on conflict (set_id, name) do nothing;

-- Photos for products already in the catalog; only fills an empty image_url.
update public.products p
   set image_url = '/products/'
       || trim(both '-' from lower(regexp_replace(s.name || ' ' || p.name, '[^a-zA-Z0-9]+', '-', 'g')))
       || '.jpg'
  from public.sets s, (values
    ('Flowing Fists', 'Booster Box'), ('Flowing Fists', 'Bundle'),
    ('Flowing Fists', 'Elite Trainer Box'), ('Flowing Fists', 'Single Packs'),
    ('Flowing Fists', 'Pokemon Center Elite Trainer Box'), ('Flowing Fists', 'Build & Battle Box'),
    ('Nauctis: The Sunken Realm', 'Play Booster Box'), ('Nauctis: The Sunken Realm', 'Collector Booster Box'),
    ('Nauctis: The Sunken Realm', 'Bundle'), ('Nauctis: The Sunken Realm', 'Single Packs'),
    ('Marvel: Darkhold Destiny', 'Play Booster Box'), ('Marvel: Darkhold Destiny', 'Collector Booster Box'),
    ('Marvel: Darkhold Destiny', 'Bundle'), ('Marvel: Darkhold Destiny', 'Single Packs'),
    ('EB-05 Heroines Edition Vol. 2', 'Gift Collection (GC-2026)')
  ) as v(set_name, product_name)
 where s.id = p.set_id
   and s.name = v.set_name
   and p.name = v.product_name
   and p.image_url is null;
