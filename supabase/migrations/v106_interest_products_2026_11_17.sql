-- Weekly interest-check update (2026-11-17): four newly announced English sets
-- and fifteen product photos.
--
-- New sets (English release dates from the sources listed):
--
--   One Piece Card Game (Bandai), from each product page on en.onepiece-cardgame.com:
--     EB-06 East Blue                    Jan 29 2027  (EXTRA BOOSTER -EAST BLUE- [EB-06])
--                                        https://en.onepiece-cardgame.com/products/eb06.html
--     OP-19 Come In, World               Mar 5 2027, pre-release Feb 26 2027
--                                        (BOOSTER PACK -COME IN, WORLD- [OP-19])
--                                        https://en.onepiece-cardgame.com/products/op19.html
--     PEB-01 The Drawing of Your Dreams  Apr 23 2027  (PREMIUM EXTRA BOOSTER -THE DRAWING OF
--                                        YOUR DREAMS- [PEB-01], an all-holo $7.99 pack)
--                                        https://en.onepiece-cardgame.com/products/per01.html
--     No Double Pack Set has been announced with OP-19, so each gets Booster Box
--     and Single Packs.
--
--   Riftbound (Riot Games / UVS Games):
--     Riftbound: The Reckoning           Apr 30 2027 (Pre-Rift Apr 23-29), Riftbound's 7th set,
--                                        announced in Riot's August 2026 State of the Game and
--                                        now on pre-order. Booster Box and Single Packs, as the
--                                        other Riftbound sets have.
--                                        https://www.gamedeveloper.com/press-release/riot-maps-out-riftbound-s-next-act-in-state-of-the-game-update
--                                        https://icv2.com/articles/news/view/63805/riftbound-league-legends-tcg-the-reckoning-hits-preorder
--                                        (one retailer guide, samuraiswordtokyo.com, says June 30 2027;
--                                        Riot's roadmap and ICv2 say April 30)
--
-- Each new set takes a sort_order below the lowest one already in its game, so
-- it lists first (newest first: PEB-01, then OP-19, then EB-06).
--
-- Images (JPEG, 200 px wide, on white, named by the slug rule of v8/v45/v70):
--   From en.onepiece-cardgame.com (the product pages above; the EB-06 shots
--   carry Bandai's "SAMPLE" watermark):
--     OP-19 Come In, World: Booster Box, Single Packs
--     EB-06 East Blue: Booster Box, Single Packs
--   From www.gundam-gcg.com/en/products/deck-build-box.html:
--     GD05 Freedom Ascension: Deck Build Box (SC01)
--   From TCGplayer's product images (tcgplayer-cdn.tcgplayer.com, product id):
--     Star Trek: Play Booster Box (706138), Collector Booster Box (706142),
--       Bundle (706150), Single Packs (706136)
--     The Hobbit: Collector Booster Box (692963), Single Packs (692959, the
--       English Play Booster)
--     Marvel Super Heroes: Play Booster Box (675603), Bundle (675615),
--       Single Packs (675602)
--     Riftbound: Spiritforged: Single Packs (661954)
--
-- New products get image_url in their insert; existing products only get one
-- when theirs is still empty, so an image set from the admin catalog is never
-- replaced. Safe to re-run: an existing set or product is left alone.

-- New sets, below the lowest sort_order already in each game.
insert into public.sets (name, set_type, sort_order, game)
select v.name, v.set_type,
       (select coalesce(min(s.sort_order), 1) from public.sets s where s.game = v.game) - v.step,
       v.game
  from (values
    ('PEB-01 The Drawing of Your Dreams', 'special',  'one_piece', 3),
    ('OP-19 Come In, World',              'standard', 'one_piece', 2),
    ('EB-06 East Blue',                   'special',  'one_piece', 1),
    ('Riftbound: The Reckoning',          'standard', 'riftbound', 1)
  ) as v(name, set_type, game, step)
on conflict (name) do nothing;

-- Booster Box and Single Packs for each, with a photo where there is one.
insert into public.products (set_id, name, sort_order, image_url)
select s.id, v.product_name, v.sort_order,
       case when v.has_image then
         '/products/'
         || trim(both '-' from lower(regexp_replace(s.name || ' ' || v.product_name, '[^a-zA-Z0-9]+', '-', 'g')))
         || '.jpg'
       end
  from public.sets s
  join (values
    ('PEB-01 The Drawing of Your Dreams', 'Booster Box',  1, false),
    ('PEB-01 The Drawing of Your Dreams', 'Single Packs', 2, false),
    ('OP-19 Come In, World',              'Booster Box',  1, true),
    ('OP-19 Come In, World',              'Single Packs', 2, true),
    ('EB-06 East Blue',                   'Booster Box',  1, true),
    ('EB-06 East Blue',                   'Single Packs', 2, true),
    ('Riftbound: The Reckoning',          'Booster Box',  1, false),
    ('Riftbound: The Reckoning',          'Single Packs', 2, false)
  ) as v(set_name, product_name, sort_order, has_image)
    on s.name = v.set_name
on conflict (set_id, name) do nothing;

-- Photos for products already in the catalog; only fills an empty image_url.
update public.products p
   set image_url = '/products/'
       || trim(both '-' from lower(regexp_replace(s.name || ' ' || p.name, '[^a-zA-Z0-9]+', '-', 'g')))
       || '.jpg'
  from public.sets s, (values
    ('Star Trek', 'Play Booster Box'), ('Star Trek', 'Collector Booster Box'),
    ('Star Trek', 'Bundle'), ('Star Trek', 'Single Packs'),
    ('The Hobbit', 'Collector Booster Box'), ('The Hobbit', 'Single Packs'),
    ('Marvel Super Heroes', 'Play Booster Box'), ('Marvel Super Heroes', 'Bundle'),
    ('Marvel Super Heroes', 'Single Packs'),
    ('Riftbound: Spiritforged', 'Single Packs'),
    ('GD05 Freedom Ascension', 'Deck Build Box (SC01)')
  ) as v(set_name, product_name)
 where s.id = p.set_id
   and s.name = v.set_name
   and p.name = v.product_name
   and p.image_url is null;
