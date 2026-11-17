-- EX Ruby & Sapphire (ex1), the first set of the EX series, after Aquapolis.
--
-- 109 cards: 14 holo rares (1-14), 13 rares (15-24, and the Darkness, Metal
-- and Rainbow Energy at 93-95), 34 uncommons, 40 commons (the six basic
-- Energy, 104-109, among them) and the eight Pokémon-ex (96-103, Mewtwo ex,
-- Lapras ex, Scyther ex...). The ex are holos here (H), but open_pack (below)
-- makes one a quarter of the holo pulls: an ex 1 pack in 12 and another holo
-- 1 in 4, as in a real box. No secret rares. Rarities are pokemontcg.io's.
--
-- The usual eleven-card pack (7 commons, 3 uncommons, the rare slot), though
-- the real ones held nine, as with every set in the machine.
--
-- Art from pokemontcg.io at /cards/ex1-<number>.webp (image_url is a
-- generated column). Wrappers: the set's four, Sceptile, Mightyena, Manectric
-- and Lairon, through scripts/import-pack-art.mjs. Sorted after Aquapolis
-- (88-91).
--
-- Not stocked: the packs are active so the set shows up in /admin/vvm, and
-- vending_set_info starts at 0 of 0 to keep it out of the machine until
-- someone sets a quantity there. Safe to re-run.

-- number|rarity|name, one card per line.
insert into public.vending_cards (set_code, number, name, rarity)
select 'ex1', parts[1], parts[3], parts[2]::char(1)
  from (
    select string_to_array(btrim(line, E' \t\r'), '|') as parts
      from unnest(string_to_array($cards$
1|H|Aggron
2|H|Beautifly
3|H|Blaziken
4|H|Camerupt
5|H|Delcatty
6|H|Dustox
7|H|Gardevoir
8|H|Hariyama
9|H|Manectric
10|H|Mightyena
11|H|Sceptile
12|H|Slaking
13|H|Swampert
14|H|Wailord
15|R|Blaziken
16|R|Breloom
17|R|Donphan
18|R|Nosepass
19|R|Pelipper
20|R|Sceptile
21|R|Seaking
22|R|Sharpedo
23|R|Swampert
24|R|Weezing
25|U|Aron
26|U|Cascoon
27|U|Combusken
28|U|Combusken
29|U|Delcatty
30|U|Electrike
31|U|Grovyle
32|U|Grovyle
33|U|Hariyama
34|U|Kirlia
35|U|Kirlia
36|U|Lairon
37|U|Lairon
38|U|Linoone
39|U|Manectric
40|U|Marshtomp
41|U|Marshtomp
42|U|Mightyena
43|U|Silcoon
44|U|Skitty
45|U|Slakoth
46|U|Swellow
47|U|Vigoroth
48|U|Wailmer
49|C|Aron
50|C|Aron
51|C|Carvanha
52|C|Electrike
53|C|Electrike
54|C|Koffing
55|C|Goldeen
56|C|Makuhita
57|C|Makuhita
58|C|Makuhita
59|C|Mudkip
60|C|Mudkip
61|C|Numel
62|C|Phanpy
63|C|Poochyena
64|C|Poochyena
65|C|Poochyena
66|C|Ralts
67|C|Ralts
68|C|Ralts
69|C|Shroomish
70|C|Skitty
71|C|Skitty
72|C|Taillow
73|C|Torchic
74|C|Torchic
75|C|Treecko
76|C|Treecko
77|C|Wingull
78|C|Wurmple
79|C|Zigzagoon
80|U|Energy Removal 2
81|U|Energy Restore
82|U|Energy Switch
83|U|Lady Outing
84|U|Lum Berry
85|U|Oran Berry
86|U|Poké Ball
87|U|Pokémon Reversal
88|U|PokéNav
89|U|Professor Birch
90|C|Energy Search
91|C|Potion
92|C|Switch
93|R|Darkness Energy
94|R|Metal Energy
95|R|Rainbow Energy
96|H|Chansey ex
97|H|Electabuzz ex
98|H|Hitmonchan ex
99|H|Lapras ex
100|H|Magmar ex
101|H|Mewtwo ex
102|H|Scyther ex
103|H|Sneasel ex
104|C|Grass Energy
105|C|Fighting Energy
106|C|Water Energy
107|C|Psychic Energy
108|C|Fire Energy
109|C|Lightning Energy
$cards$, E'\n')) as line
     where btrim(line, E' \t\r') <> ''
  ) t
on conflict (set_code, number) do nothing;

insert into public.vending_packs (set_name, pack_name, image_url, sort_order, is_active, set_code)
values
  ('EX Ruby & Sapphire', 'Sceptile',  '/packs/ruby-sapphire-sceptile.webp',  92, true, 'ex1'),
  ('EX Ruby & Sapphire', 'Mightyena', '/packs/ruby-sapphire-mightyena.webp', 93, true, 'ex1'),
  ('EX Ruby & Sapphire', 'Manectric', '/packs/ruby-sapphire-manectric.webp', 94, true, 'ex1'),
  ('EX Ruby & Sapphire', 'Lairon',    '/packs/ruby-sapphire-lairon.webp',    95, true, 'ex1')
on conflict (set_name, pack_name) do update
  set image_url = excluded.image_url,
      sort_order = excluded.sort_order,
      is_active = excluded.is_active,
      set_code = excluded.set_code;

-- 0 of 0: nothing left to offer, so build_vending_stock skips it entirely.
insert into public.vending_set_info (set_code, description, total_quantity, claimed_quantity)
values
('ex1',
'Welcome to Hoenn.

EX Ruby & Sapphire opens the EX series with the new region''s Pokemon, Treecko, Torchic and Mudkip to Sceptile, Blaziken and Swampert, and brings back the old powerhouses as Pokemon-ex: Mewtwo, Lapras, Scyther, Hitmonchan and more, worth two Prize cards when they fall. Fourteen holos lead it, with Rainbow Energy and Professor Birch to back them up.',
  0, 0)
on conflict (set_code) do nothing;

-- open_pack as v96 left it, but in an EX set (any holo named '... ex') a holo
-- pull is a Pokémon-ex one time in four. The rare slot is a holo 1 pack in 3,
-- so that's an ex 1 in 12 and another holo 1 in 4: about 3 ex and 9 holos a
-- 36-pack box, as in the real EX Ruby & Sapphire. Every other set opens as before.
create or replace function public.open_pack(p_user_pack_id bigint)
 returns table(card_id bigint, name text, rarity character, number text, image_url text, slot integer, center_x smallint, center_y smallint, corners smallint, edges smallint, surface smallint, border_wear smallint, wear_seed integer, crease smallint, holes smallint, rips smallint)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare me uuid := auth.uid(); v_pack public.user_packs; v_code text; v_rare char(1); v_odds int; v_god boolean := false; v_size int; v_game text; v_bonus char(1); v_ex boolean;
begin
  select * into v_pack from public.user_packs where id = p_user_pack_id for update;
  if v_pack.id is null or v_pack.user_id <> me then raise exception 'That pack is not yours'; end if;
  if v_pack.market_listing_id is not null then raise exception 'That pack is listed for sale'; end if;
  if v_pack.opened_at is not null then raise exception 'That pack is already open'; end if;
  select p.set_code into v_code from public.vending_packs p where p.id = v_pack.pack_id;
  if v_code is null then raise exception 'That pack has no card pool'; end if;
  select si.pack_size, si.game into v_size, v_game from public.vending_set_info si where si.set_code = v_code;
  -- A One Piece pack: 7 Commons, 3 Uncommons, a Rare slot (SEC 1 in 40, SR 1 in 6, else R) and a bonus slot
  -- (a Parallel 1 in 12, a Leader 1 in 4, else a Common), those two turned over last, the better one last of all.
  if v_game = 'op' then
    v_rare := case when random() < 1.0 / 40 then 'S' when random() < 1.0 / 6 then 'H' else 'R' end;
    v_bonus := case when random() < 1.0 / 12 then 'P' when random() < 0.25 then 'L' else 'C' end;
    return query
    with picks as (
      -- A Common in the bonus slot is an eighth Common, so it's never one of the seven again.
      select id, 1 as grp from (select c.id from public.vending_cards c where c.set_code = v_code and c.rarity = 'C' order by random() limit case when v_bonus = 'C' then 8 else 7 end) a
      union all select id, 2 from (select c.id from public.vending_cards c where c.set_code = v_code and c.rarity = 'U' order by random() limit 3) b
      union all select id, 3 from (select c.id from public.vending_cards c where c.set_code = v_code and c.rarity = v_rare order by random() limit 1) d
      union all select id, 3 from (select c.id from public.vending_cards c where c.set_code = v_code and c.rarity = v_bonus and v_bonus <> 'C' order by random() limit 1) e),
    rolled as (select p.id, p.grp, r.center_x, r.center_y, r.corners, r.edges, r.surface, r.border_wear, r.wear_seed, r.crease, r.holes, r.rips
                 from picks p cross join lateral public.roll_card_condition(p.id) r),
    inserted as (insert into public.user_cards (user_id, card_id, user_pack_id, center_x, center_y, corners, edges, surface, border_wear, wear_seed, crease, holes, rips)
                 select me, x.id, p_user_pack_id, x.center_x, x.center_y, x.corners, x.edges, x.surface, x.border_wear, x.wear_seed, x.crease, x.holes, x.rips from rolled x
                 returning user_cards.card_id),
    marked as (update public.user_packs set opened_at = now() where id = p_user_pack_id returning 1)
    select c.id, c.name, c.rarity, c.number, c.image_url,
           row_number() over (order by x.grp, case when x.grp = 3 then position(c.rarity::text in 'CURLHPS') else 0 end, random())::int,
           x.center_x, x.center_y, x.corners, x.edges, x.surface, x.border_wear, x.wear_seed, x.crease, x.holes, x.rips
      from rolled x join public.vending_cards c on c.id = x.id
     where (select count(*) from inserted) > 0 and (select count(*) from marked) > 0;
    return;
  end if;
  -- A set with its own pack size: that many different cards from the whole set, no god packs.
  if v_size is not null then
    return query
    with picks as (select c.id, 3 as grp from public.vending_cards c where c.set_code = v_code order by random() limit v_size),
    rolled as (select p.id, p.grp, r.center_x, r.center_y, r.corners, r.edges, r.surface, r.border_wear, r.wear_seed, r.crease, r.holes, r.rips
                 from picks p cross join lateral public.roll_card_condition(p.id) r),
    inserted as (insert into public.user_cards (user_id, card_id, user_pack_id, center_x, center_y, corners, edges, surface, border_wear, wear_seed, crease, holes, rips)
                 select me, x.id, p_user_pack_id, x.center_x, x.center_y, x.corners, x.edges, x.surface, x.border_wear, x.wear_seed, x.crease, x.holes, x.rips from rolled x
                 returning user_cards.card_id),
    marked as (update public.user_packs set opened_at = now() where id = p_user_pack_id returning 1)
    select c.id, c.name, c.rarity, c.number, c.image_url, row_number() over (order by random())::int,
           x.center_x, x.center_y, x.corners, x.edges, x.surface, x.border_wear, x.wear_seed, x.crease, x.holes, x.rips
      from rolled x join public.vending_cards c on c.id = x.id
     where (select count(*) from inserted) > 0 and (select count(*) from marked) > 0;
    return;
  end if;
  select coalesce(s.god_pack_odds, 500) into v_odds from public.vending_settings s where s.id;
  if random() < 1.0 / greatest(v_odds, 1)
     and (select count(*) from public.vending_cards vc where vc.set_code = v_code and vc.rarity = 'H') >= 11 then
    v_god := true;
  end if;
  if v_god then
    update public.user_packs set god_pack = true where id = p_user_pack_id;
    return query
    with picks as (select c.id, 3 as grp from public.vending_cards c where c.set_code = v_code and c.rarity = 'H' order by random() limit 11),
    rolled as (select p.id, p.grp, r.center_x, r.center_y, r.corners, r.edges, r.surface, r.border_wear, r.wear_seed, r.crease, r.holes, r.rips
                 from picks p cross join lateral public.roll_god_condition(p.id) r),
    inserted as (insert into public.user_cards (user_id, card_id, user_pack_id, center_x, center_y, corners, edges, surface, border_wear, wear_seed, crease, holes, rips)
                 select me, x.id, p_user_pack_id, x.center_x, x.center_y, x.corners, x.edges, x.surface, x.border_wear, x.wear_seed, x.crease, x.holes, x.rips from rolled x
                 returning user_cards.card_id),
    marked as (update public.user_packs set opened_at = now() where id = p_user_pack_id returning 1)
    select c.id, c.name, c.rarity, c.number, c.image_url, row_number() over (order by random())::int,
           x.center_x, x.center_y, x.corners, x.edges, x.surface, x.border_wear, x.wear_seed, x.crease, x.holes, x.rips
      from rolled x join public.vending_cards c on c.id = x.id
     where (select count(*) from inserted) > 0 and (select count(*) from marked) > 0;
    return;
  end if;
  if random() < 0.02 and exists (select 1 from public.vending_cards vc where vc.set_code = v_code and vc.rarity = 'S') then v_rare := 'S';
  elsif random() < 0.3333 then v_rare := 'H';
  else v_rare := 'R';
  end if;
  -- An EX set's holo is a Pokémon-ex one time in four: an ex 1 pack in 12 and
  -- another holo 1 in 4, as in a real box. Other sets have no ex, so v_ex stays null.
  if v_rare = 'H' and exists (select 1 from public.vending_cards vc where vc.set_code = v_code and vc.rarity = 'H' and vc.name like '% ex') then
    v_ex := random() < 0.25;
  end if;
  return query
  with picks as (
    select id, 1 as grp from (select c.id from public.vending_cards c where c.set_code = v_code and c.rarity = 'C' order by random() limit 7) a
    union all select id, 2 from (select c.id from public.vending_cards c where c.set_code = v_code and c.rarity = 'U' order by random() limit 3) b
    union all select id, 3 from (select c.id from public.vending_cards c where c.set_code = v_code and c.rarity = v_rare
                                     and (v_ex is null or (c.name like '% ex') = v_ex) order by random() limit 1) d),
  rolled as (select p.id, p.grp, r.center_x, r.center_y, r.corners, r.edges, r.surface, r.border_wear, r.wear_seed, r.crease, r.holes, r.rips
               from picks p cross join lateral public.roll_card_condition(p.id) r),
  inserted as (insert into public.user_cards (user_id, card_id, user_pack_id, center_x, center_y, corners, edges, surface, border_wear, wear_seed, crease, holes, rips)
               select me, x.id, p_user_pack_id, x.center_x, x.center_y, x.corners, x.edges, x.surface, x.border_wear, x.wear_seed, x.crease, x.holes, x.rips from rolled x
               returning user_cards.card_id),
  marked as (update public.user_packs set opened_at = now() where id = p_user_pack_id returning 1)
  select c.id, c.name, c.rarity, c.number, c.image_url, row_number() over (order by x.grp, random())::int,
         x.center_x, x.center_y, x.corners, x.edges, x.surface, x.border_wear, x.wear_seed, x.crease, x.holes, x.rips
    from rolled x join public.vending_cards c on c.id = x.id
   where (select count(*) from inserted) > 0 and (select count(*) from marked) > 0;
end $function$;
