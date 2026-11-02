-- Every item an evolution needs, in the machine's supply catalog. The battle
-- game had them all (Play mode's machine sold them; Gym Leaders and finds give
-- some), but the VVM in the app sold none, so a member could only wait for one
-- to turn up. Bought here they land in user_items like the other items, and
-- the game collects them into the Bag (battle_take_items; the game maps each
-- key below to its own).
--
--   Thunder Stone   Pikachu, Magneton, Eevee (Jolteon)
--   Water Stone     Eevee (Vaporeon), Poliwhirl, Staryu, Shellder
--   Fire Stone      Eevee (Flareon), Vulpix, Growlithe
--   Leaf Stone      Eevee (Leafeon), Gloom, Weepinbell, Exeggcute
--   Ice Stone       Eevee (Glaceon)
--   Moon Stone      Clefairy, Jigglypuff, Skitty, Nidorina, Nidorino
--   Sun Stone       Sunkern, Gloom (Bellossom)
--   Dusk Stone      Murkrow, Misdreavus
--   Shiny Stone     Roselia, Minccino, Floette, Togetic
--   Linking Cord    the trade evolutions: Kadabra, Machoke, Graveler, Haunter,
--                   Onix, Scyther, Porygon, Porygon2, Rhydon, Electabuzz,
--                   Magmar, Poliwhirl (Politoed), Slowpoke (Slowking), Seadra
--   Dragon Scale    Seadra holds it, with a Linking Cord, for Kingdra
--
-- On from the start, at Play mode's prices and rates (stones 1 token, the
-- Linking Cord 1.50; each on 4-10% of stocked taps); change any of them, and
-- their purchase limits (v86), in Admin -> VVM. Safe to re-run.
insert into public.vvm_supplies (key, kind, name, description, token_price, appearance_rate, is_active, sort_order) values
  ('thunder_stone', 'item', 'Thunder Stone', 'Evolves Pikachu, Magneton, Eevee',              1.00, 10, true, 86),
  ('water_stone',   'item', 'Water Stone',   'Evolves Eevee, Poliwhirl, Staryu, Shellder',     1.00,  8, true, 87),
  ('fire_stone',    'item', 'Fire Stone',    'Evolves Eevee, Vulpix, Growlithe',               1.00,  8, true, 88),
  ('leaf_stone',    'item', 'Leaf Stone',    'Evolves Eevee, Gloom, Weepinbell, Exeggcute',    1.00,  6, true, 89),
  ('ice_stone',     'item', 'Ice Stone',     'Evolves Eevee into Glaceon',                     1.00,  6, true, 90),
  ('moon_stone',    'item', 'Moon Stone',    'Evolves Clefairy, Jigglypuff, Skitty, the Nidos', 1.00, 6, true, 91),
  ('sun_stone',     'item', 'Sun Stone',     'Evolves Sunkern, Gloom (Bellossom)',             1.00,  5, true, 92),
  ('dusk_stone',    'item', 'Dusk Stone',    'Evolves Murkrow, Misdreavus',                    1.00,  5, true, 93),
  ('shiny_stone',   'item', 'Shiny Stone',   'Evolves Togetic, Roselia, Minccino, Floette',    1.00,  4, true, 94),
  ('linking_cord',  'item', 'Linking Cord',  'Trade evolutions: Kadabra, Machoke, Haunter...', 1.50,  8, true, 95),
  ('dragon_scale',  'item', 'Dragon Scale',  'Seadra holds it, with a Linking Cord, for Kingdra', 1.00, 5, true, 96)
on conflict (key) do nothing;
