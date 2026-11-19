-- The battle game's second region: Hoenn and Sinnoh's gyms and Leagues pay
-- out and post to the home feed like Johto's and Kanto's.
--
-- Milestone keys (battle_award_milestone, v77), each paid once per account:
--   gym:16 … gym:23          Hoenn's Gym Leaders (Roxanne ... Juan)       8 each
--   gym:24 … gym:31          Sinnoh's (Roark ... Volkner)                 10 each, Volkner 20
--   hoenn:SIDNEY … DRAKE     the Hoenn Elite Four                         6 each
--   hoenn:WALLACE            Hoenn's Champion                             20
--   sinnoh:AARON … LUCIAN    the Sinnoh Elite Four                        10 each
--   sinnoh:CYNTHIA           Sinnoh's Champion                            30
-- (the game's own numbers: public/rpg/game.js, HS_GYM_LIST, HOENN_ELITE,
-- SINNOH_ELITE). Gym Summons for these gyms are summon:16 … summon:31 in the
-- game's Bag, which one_gym_summon (v84) already counts.
--
-- And the DAWN STONE (Kirlia -> Gallade, Snorunt -> Froslass) in the machine's
-- supplies, like v88's stones (1 token, on 4% of stocked taps), and bought
-- back like them (vvm_sell_price, v103).
--
-- Safe to re-run.

create or replace function public.battle_milestone_amount(p_key text)
returns numeric
language sql immutable as $$
  select case
    when p_key in ('gym:0','gym:1','gym:2','gym:3','gym:4','gym:5','gym:6','gym:7') then 8
    when p_key in ('gym:8','gym:9','gym:10','gym:11','gym:12','gym:13','gym:14') then 10
    when p_key = 'gym:15' then 20
    when p_key in ('gym:16','gym:17','gym:18','gym:19','gym:20','gym:21','gym:22','gym:23') then 8
    when p_key in ('gym:24','gym:25','gym:26','gym:27','gym:28','gym:29','gym:30') then 10
    when p_key = 'gym:31' then 20
    when p_key in ('elite:WILL','elite:KOGA','elite:BRUNO','elite:KAREN') then 6
    when p_key = 'elite:LANCE' then 20
    when p_key in ('kanto:LORELEI','kanto:BRUNO','kanto:AGATHA','kanto:LANCE') then 10
    when p_key = 'kanto:RED' then 30
    when p_key in ('hoenn:SIDNEY','hoenn:PHOEBE','hoenn:GLACIA','hoenn:DRAKE') then 6
    when p_key = 'hoenn:WALLACE' then 20
    when p_key in ('sinnoh:AARON','sinnoh:BERTHA','sinnoh:FLINT','sinnoh:LUCIAN') then 10
    when p_key = 'sinnoh:CYNTHIA' then 30
    when p_key = 'rival:0' then 3
    when p_key = 'rival:1' then 4
    when p_key = 'rival:2' then 5
    when p_key = 'rival:3' then 6
    when p_key = 'rival:4' then 8
    when p_key = 'rival:5' then 12
    when p_key = 'rival:6' then 20
    when p_key = 'herb:0' then 2.5
    when p_key = 'herb:1' then 4
    when p_key = 'herb:2' then 7
    when p_key = 'herb:3' then 10
    when p_key = 'paul:0' then 3
    when p_key = 'paul:1' then 6
    when p_key = 'paul:2' then 8
    when p_key = 'paul:3' then 12
  end::numeric;
$$;
revoke all on function public.battle_milestone_amount(text) from public, anon, authenticated;

-- The feed's words and picture for each milestone (v81), with the new region's.
create or replace function public.battle_feed_label(p_key text)
returns table (title text, detail text, image_url text, big boolean)
language sql immutable as $$
  with g(i, leader, face, badge) as (values
    (0, 'Falkner', 'falkner', 'zephyr'), (1, 'Bugsy', 'bugsy', 'hive'), (2, 'Whitney', 'whitney', 'plain'), (3, 'Morty', 'morty', 'fog'),
    (4, 'Chuck', 'chuck', 'storm'), (5, 'Jasmine', 'jasmine', 'mineral'), (6, 'Pryce', 'pryce', 'glacier'), (7, 'Clair', 'clair', 'rising'),
    (8, 'Brock', 'brock', 'boulder'), (9, 'Misty', 'misty', 'cascade'), (10, 'Lt. Surge', 'lt_surge', 'thunder'), (11, 'Erika', 'erika', 'rainbow'),
    (12, 'Janine', 'janine', 'soul'), (13, 'Sabrina', 'sabrina', 'marsh'), (14, 'Blaine', 'blaine', 'volcano'), (15, 'Blue', 'blue', 'earth'),
    (16, 'Roxanne', 'roxanne', 'stone'), (17, 'Brawly', 'brawly', 'knuckle'), (18, 'Wattson', 'wattson', 'dynamo'), (19, 'Flannery', 'flannery', 'heat'),
    (20, 'Norman', 'norman', 'balance'), (21, 'Winona', 'winona', 'feather'), (22, 'Tate & Liza', 'tateliza', 'mind'), (23, 'Juan', 'juan', 'rain'),
    (24, 'Roark', 'roark', 'coal'), (25, 'Gardenia', 'gardenia', 'forest'), (26, 'Maylene', 'maylene', 'cobble'), (27, 'Crasher Wake', 'crasherwake', 'fen'),
    (28, 'Fantina', 'fantina', 'relic'), (29, 'Byron', 'byron', 'mine'), (30, 'Candice', 'candice', 'icicle'), (31, 'Volkner', 'volkner', 'beacon')
  ), k as (select split_part(p_key, ':', 1) as kind, split_part(p_key, ':', 2) as arg)
  select
    case
      when k.kind = 'gym' then 'won the ' || upper(g.badge) || ' BADGE'
      when p_key = 'elite:LANCE' then 'became Johto Champion!'
      when k.kind = 'elite' then 'beat Elite Four ' || initcap(k.arg)
      when p_key = 'kanto:RED' then 'beat Red on Mt. Silver!'
      when k.kind = 'kanto' then 'beat Kanto Elite Four ' || initcap(k.arg)
      when p_key = 'hoenn:WALLACE' then 'became Hoenn Champion!'
      when k.kind = 'hoenn' then 'beat Hoenn Elite Four ' || initcap(k.arg)
      when p_key = 'sinnoh:CYNTHIA' then 'became Sinnoh Champion!'
      when k.kind = 'sinnoh' then 'beat Sinnoh Elite Four ' || initcap(k.arg)
      when p_key = 'rival:6' then 'beat Alex and entered the Hall of Fame!'
      when k.kind = 'rival' then 'beat their rival Alex'
      when k.kind in ('herb', 'paul') then 'stopped ' || initcap(k.kind) || '''s glitch racket'
    end,
    case
      when k.kind = 'gym' then 'Gym Leader ' || g.leader || ' · ' || (array['Johto', 'Kanto', 'Hoenn', 'Sinnoh'])[g.i / 8 + 1] || ' badge ' || (g.i % 8 + 1) || ' of 8'
      when p_key = 'elite:LANCE' then 'The Elite Four and Champion Lance'
      when k.kind = 'elite' then 'Johto League'
      when p_key = 'kanto:RED' then 'The legend himself'
      when k.kind = 'kanto' then 'Kanto League'
      when p_key = 'hoenn:WALLACE' then 'The Elite Four and Champion Wallace'
      when k.kind = 'hoenn' then 'Hoenn League'
      when p_key = 'sinnoh:CYNTHIA' then 'The Elite Four and Champion Cynthia'
      when k.kind = 'sinnoh' then 'Sinnoh League'
      when p_key = 'rival:6' then 'The last battle, and Mewtwo'
      when k.kind = 'rival' then 'Rival battle ' || (k.arg::int + 1) || ' of 7'
      when k.kind in ('herb', 'paul') then 'Glitcher battle ' || (k.arg::int + 1) || ' of 4'
    end,
    case
      when k.kind = 'gym' then '/rpg/a/badges/' || g.badge || '.png'
      when k.kind in ('elite', 'kanto', 'hoenn', 'sinnoh') then '/rpg/a/gym-' || lower(k.arg) || '-face.jpg'
      when k.kind = 'rival' then '/rpg/a/rival-' || (array[1, 1, 1, 2, 2, 3, 3])[k.arg::int + 1] || '-face.jpg'
      when k.kind in ('herb', 'paul') then '/rpg/a/' || k.kind || '-face.jpg'
    end,
    p_key in ('elite:LANCE', 'kanto:RED', 'rival:6', 'hoenn:WALLACE', 'sinnoh:CYNTHIA')
  from k left join g on k.kind = 'gym' and g.i::text = k.arg
$$;

revoke all on function public.battle_feed_label(text) from public, anon;

-- The Dawn Stone, for sale.
insert into public.vvm_supplies (key, kind, name, description, token_price, appearance_rate, is_active, sort_order) values
  ('dawn_stone', 'item', 'Dawn Stone', 'Evolves Kirlia (Gallade), Snorunt (Froslass)', 1.00, 4, true, 97)
on conflict (key) do nothing;

-- What a Bag item sells back for (v103), knowing the Dawn Stone.
create or replace function public.vvm_sell_price(p_bag_key text)
returns numeric language sql stable security definer set search_path to 'public' as $$
  with k as (
    select case
      when p_bag_key like 'disc:%' then 'move_disc'
      else (select e.key from jsonb_each_text(jsonb_build_object(
        'potion', 'potion', 'super_potion', 'super', 'hyper_potion', 'hyper', 'revive', 'revive', 'max_revive', 'maxrevive',
        'poke_ball', 'ball', 'great_ball', 'great', 'ultra_ball', 'ultra', 'rare_candy', 'rarecandy', 'full_heal', 'fullheal',
        'thunder_stone', 'thunderstone', 'water_stone', 'waterstone', 'fire_stone', 'firestone', 'leaf_stone', 'leafstone',
        'ice_stone', 'icestone', 'moon_stone', 'moonstone', 'sun_stone', 'sunstone', 'dusk_stone', 'duskstone',
        'shiny_stone', 'shinystone', 'dawn_stone', 'dawnstone', 'linking_cord', 'linkcable', 'dragon_scale', 'dragonscale')) e where e.value = p_bag_key)
    end as supply
  ), base as (
    select coalesce(
      (select s.token_price from public.vvm_supplies s, k where s.key = k.supply and s.kind = 'item'),
      (jsonb_build_object('antidote', 0.15, 'parlyz', 0.20, 'burnheal', 0.20, 'iceheal', 0.20) ->> p_bag_key)::numeric) as price
  )
  select (floor(b.price * public.vvm_sell_rate() * 100) / 100)::numeric(12,2) from base b
   where b.price is not null
     and p_bag_key not like 'summon:%' and p_bag_key not like 'rematch:%' and p_bag_key not in ('summon', 'elite', 'expshare', 'disc')
$$;
revoke all on function public.vvm_sell_price(text) from public, anon, authenticated;
