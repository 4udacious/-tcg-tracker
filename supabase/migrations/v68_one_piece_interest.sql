-- One Piece TCG (English) on the interest check.
--
-- Sets gain a `game`: 'pokemon' (every set so far) or 'one_piece'. The
-- interest page has a switch between the two, so a set picker only lists one
-- game's sets; everyone's lists and the By Person tab show both.
--
-- The English sets released this year and announced through November 2026
-- (Bandai's English release schedule, as reported by its official channels):
--   OP14-EB04  The Azure Sea's Seven           Jan 16 2026
--   OP15-EB04  Adventure on Kami's Island      Apr 3 2026
--   OP-16      The Time of Battle              Jun 12 2026
--   OP-17      The World's Strongest Warriors  Aug 2026
--   EB-05      Heroines Edition Vol. 2         Oct 30 2026
--   OP-18      The Dominance of God            Nov 20 2026 (with Double Pack Set Vol. 13, DP-13)
-- Each has a Booster Box and Single Packs, as the Pokémon sets do; OP-18 also
-- the Double Pack Set released alongside it. More can be added from the admin
-- catalog, which now asks which game a new set is for.
--
-- No images yet (the official product photos weren't reachable when this was
-- written): the interest page shows its plain box icon until image_url is set.
--
-- Safe to re-run: an existing set or product is left alone.

alter table public.sets
  add column if not exists game text not null default 'pokemon'
    check (game in ('pokemon', 'one_piece'));

insert into public.sets (name, set_type, sort_order, game)
values
  ('OP-18 The Dominance of God',              'standard', 1, 'one_piece'),
  ('EB-05 Heroines Edition Vol. 2',           'special',  2, 'one_piece'),
  ('OP-17 The World''s Strongest Warriors',   'standard', 3, 'one_piece'),
  ('OP-16 The Time of Battle',                'standard', 4, 'one_piece'),
  ('OP15-EB04 Adventure on Kami''s Island',   'standard', 5, 'one_piece'),
  ('OP14-EB04 The Azure Sea''s Seven',        'standard', 6, 'one_piece')
on conflict (name) do nothing;

insert into public.products (set_id, name, sort_order)
select s.id, v.name, v.sort_order
  from public.sets s
  cross join (values ('Booster Box', 1), ('Single Packs', 2)) as v(name, sort_order)
 where s.name in ('OP-18 The Dominance of God', 'EB-05 Heroines Edition Vol. 2', 'OP-17 The World''s Strongest Warriors',
                  'OP-16 The Time of Battle', 'OP15-EB04 Adventure on Kami''s Island', 'OP14-EB04 The Azure Sea''s Seven')
on conflict (set_id, name) do nothing;

insert into public.products (set_id, name, sort_order)
select s.id, 'Double Pack Set Vol. 13 (DP-13)', 3
  from public.sets s
 where s.name = 'OP-18 The Dominance of God'
on conflict (set_id, name) do nothing;
