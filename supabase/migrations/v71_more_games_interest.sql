-- Five more card games on the interest check: Riftbound, the Gundam Card
-- Game, Bandai's Naruto Card Game, Dragon Ball Super Card Game Fusion World
-- and Magic: The Gathering (all English).
--
-- `sets.game` (v68) widens to the new ids. The interest page's switch lists a
-- game once it has a set, and the admin catalog offers all of them for new sets.
--
-- Sets added (newest first in each game; sort_order 1 = newest, as v68 does
-- for One Piece), from the publishers' announced English release dates:
--
--   Riftbound (Riot)          Legacy Jan 29 2027 · Radiance Oct 23 2026 · Vendetta Jul 31 2026
--                             · Unleashed May 8 2026 · Spiritforged Feb 13 2026
--   Gundam Card Game (Bandai) EB02 Cosmic Crisis Feb 26 2027 · GD07 Blazing Fist Jan 29 2027
--                             · GD06 Stardust Trails Oct 30 2026 · GD05 Freedom Ascension Jul 24 2026
--                             (with the Deck Build Box SC01) · GD04 Phantom Aria Apr 24 2026
--                             · GD03 Steel Requiem Jan 30 2026
--   Naruto Card Game (Bandai) Enter: Naruto Uzumaki! and three Starter Decks (Naruto, Sasuke,
--                             Gaara), worldwide launch June 2027
--   Dragon Ball Super Card    FB12 Reach the God Dec 2026 · FB11 Brightness of Hope Oct 16 2026
--   Game Fusion World         · FB10 Cross Force Jun 12 2026 · FB09 Dual Evolution Mar 13 2026
--                             (FB12 Dec 18 2026)
--   Magic: The Gathering      2026: Lorwyn Eclipsed, Teenage Mutant Ninja Turtles, Secrets of
--                             Strixhaven, Marvel Super Heroes, The Hobbit, Reality Fracture,
--                             Star Trek (Nov 13). 2027: Nauctis: The Sunken Realm (Feb 5),
--                             Marvel: Darkhold Destiny (Apr 9), Kamigawa: Titanbreach (Jun 4),
--                             Zhalfir (Oct 1).
--
-- Booster sets get Booster Box and Single Packs, as the Pokémon and One Piece
-- sets do; Magic sets get Play Booster Box, Collector Booster Box, Bundle and
-- Single Packs.
--
-- Images, where the product has been shown: the Magic Play Booster boxes,
-- Collector Booster boxes and Bundles from magic.wizards.com (each set's
-- product page), the Gundam booster boxes and packs from www.gundam-gcg.com,
-- the Dragon Ball packs from www.dbs-cardgame.com, and the Riftbound displays
-- and packs from TCGplayer. Put on white, 200 px wide, named by the same slug
-- rule as v8, v45 and v70. The rest (Magic's Single Packs, Star Trek and the
-- 2027 Magic sets, Marvel Super Heroes' Play Booster box and Bundle, The
-- Hobbit's Collector box, Riftbound Legacy and the Spiritforged pack, Naruto,
-- the Dragon Ball boxes, GD04's box, GD07, EB02, SC01) shows the plain box
-- icon until an image is found.
--
-- Safe to re-run: an existing set or product is left alone.

alter table public.sets drop constraint if exists sets_game_check;
alter table public.sets add constraint sets_game_check
  check (game in ('pokemon', 'one_piece', 'riftbound', 'gundam', 'naruto', 'dragon_ball', 'mtg'));

insert into public.sets (name, set_type, sort_order, game)
values
  ('Riftbound: Legacy',                          'standard', 1, 'riftbound'),
  ('Riftbound: Radiance',                        'standard', 2, 'riftbound'),
  ('Riftbound: Vendetta',                        'standard', 3, 'riftbound'),
  ('Riftbound: Unleashed',                       'standard', 4, 'riftbound'),
  ('Riftbound: Spiritforged',                    'standard', 5, 'riftbound'),

  ('EB02 Cosmic Crisis',                         'special',  1, 'gundam'),
  ('GD07 Blazing Fist',                          'standard', 2, 'gundam'),
  ('GD06 Stardust Trails',                       'standard', 3, 'gundam'),
  ('GD05 Freedom Ascension',                     'standard', 4, 'gundam'),
  ('GD04 Phantom Aria',                          'standard', 5, 'gundam'),
  ('GD03 Steel Requiem',                         'standard', 6, 'gundam'),

  ('Enter: Naruto Uzumaki!',                     'standard', 1, 'naruto'),
  ('Naruto Card Game Starter Decks',             'special',  2, 'naruto'),

  ('FB12 Reach the God',                         'standard', 1, 'dragon_ball'),
  ('FB11 Brightness of Hope',                    'standard', 2, 'dragon_ball'),
  ('FB10 Cross Force',                           'standard', 3, 'dragon_ball'),
  ('FB09 Dual Evolution',                        'standard', 4, 'dragon_ball'),

  ('Zhalfir',                                    'standard', 1,  'mtg'),
  ('Kamigawa: Titanbreach',                      'standard', 2,  'mtg'),
  ('Marvel: Darkhold Destiny',                   'standard', 3,  'mtg'),
  ('Nauctis: The Sunken Realm',                  'standard', 4,  'mtg'),
  ('Star Trek',                                  'standard', 5,  'mtg'),
  ('Reality Fracture',                           'standard', 6,  'mtg'),
  ('The Hobbit',                                 'standard', 7,  'mtg'),
  ('Marvel Super Heroes',                        'standard', 8,  'mtg'),
  ('Secrets of Strixhaven',                      'standard', 9,  'mtg'),
  ('Teenage Mutant Ninja Turtles',               'standard', 10, 'mtg'),
  ('Lorwyn Eclipsed',                            'standard', 11, 'mtg')
on conflict (name) do nothing;

-- Booster Box and Single Packs for every booster set but Magic's.
insert into public.products (set_id, name, sort_order)
select s.id, v.name, v.sort_order
  from public.sets s
  cross join (values ('Booster Box', 1), ('Single Packs', 2)) as v(name, sort_order)
 where s.game in ('riftbound', 'gundam', 'naruto', 'dragon_ball')
   and s.name <> 'Naruto Card Game Starter Decks'
on conflict (set_id, name) do nothing;

insert into public.products (set_id, name, sort_order)
select s.id, 'Deck Build Box (SC01)', 3
  from public.sets s
 where s.name = 'GD05 Freedom Ascension'
on conflict (set_id, name) do nothing;

insert into public.products (set_id, name, sort_order)
select s.id, v.name, v.sort_order
  from public.sets s
  cross join (values ('Naruto Uzumaki Starter Deck', 1), ('Sasuke Uchiha Starter Deck', 2), ('Gaara Starter Deck', 3)) as v(name, sort_order)
 where s.name = 'Naruto Card Game Starter Decks'
on conflict (set_id, name) do nothing;

insert into public.products (set_id, name, sort_order)
select s.id, v.name, v.sort_order
  from public.sets s
  cross join (values ('Play Booster Box', 1), ('Collector Booster Box', 2), ('Bundle', 3), ('Single Packs', 4)) as v(name, sort_order)
 where s.game = 'mtg'
on conflict (set_id, name) do nothing;

-- Official product photos (see the header); only fills an empty image_url.
update public.products p
   set image_url = '/products/'
       || trim(both '-' from lower(regexp_replace(s.name || ' ' || p.name, '[^a-zA-Z0-9]+', '-', 'g')))
       || '.jpg'
  from public.sets s, (values
    ('GD03 Steel Requiem', 'Booster Box'), ('GD03 Steel Requiem', 'Single Packs'),
    ('GD04 Phantom Aria', 'Single Packs'),
    ('GD05 Freedom Ascension', 'Booster Box'), ('GD05 Freedom Ascension', 'Single Packs'),
    ('GD06 Stardust Trails', 'Booster Box'), ('GD06 Stardust Trails', 'Single Packs'),
    ('FB09 Dual Evolution', 'Single Packs'), ('FB10 Cross Force', 'Single Packs'),
    ('FB11 Brightness of Hope', 'Single Packs'), ('FB12 Reach the God', 'Single Packs'),
    ('Riftbound: Radiance', 'Booster Box'), ('Riftbound: Radiance', 'Single Packs'),
    ('Riftbound: Vendetta', 'Booster Box'), ('Riftbound: Vendetta', 'Single Packs'),
    ('Riftbound: Unleashed', 'Booster Box'), ('Riftbound: Unleashed', 'Single Packs'),
    ('Riftbound: Spiritforged', 'Booster Box'),
    ('Lorwyn Eclipsed', 'Play Booster Box'), ('Lorwyn Eclipsed', 'Collector Booster Box'), ('Lorwyn Eclipsed', 'Bundle'),
    ('Teenage Mutant Ninja Turtles', 'Play Booster Box'), ('Teenage Mutant Ninja Turtles', 'Collector Booster Box'), ('Teenage Mutant Ninja Turtles', 'Bundle'),
    ('Secrets of Strixhaven', 'Play Booster Box'), ('Secrets of Strixhaven', 'Collector Booster Box'), ('Secrets of Strixhaven', 'Bundle'),
    ('Marvel Super Heroes', 'Collector Booster Box'),
    ('The Hobbit', 'Play Booster Box'), ('The Hobbit', 'Bundle'),
    ('Reality Fracture', 'Play Booster Box'), ('Reality Fracture', 'Collector Booster Box'), ('Reality Fracture', 'Bundle')
  ) as v(set_name, product_name)
 where s.id = p.set_id
   and s.name = v.set_name
   and p.name = v.product_name
   and p.image_url is null;
