-- Gym Heroes (gym1), the fifth set: 132 cards, four wrappers.
--
-- The scans are the 1st Edition printing - pokemontcg.io's gym1 art carries
-- the EDITION 1 stamp under the art box - which is what the wrappers are.
--
-- Deliberately NOT stocked. The packs are active so the set appears in
-- /admin/vvm and its quantity can be set from there, but vending_set_info
-- starts at 0 of 0, and that is what keeps it out of the machine. Releasing
-- it is one number in the admin page, not another migration.

-- number|rarity|name, one card per line. The basic energies (127-132) go in
-- as commons: they have no rarity of their own in the printed set and they
-- are pack filler, which is how base1 and the rest already carry theirs.
-- image_url is a generated column (/cards/<set>-<number>.webp), which is
-- exactly where scripts/import-set.mjs puts the art, so it is left alone.
insert into public.vending_cards (set_code, number, name, rarity)
select 'gym1', parts[1], parts[3], parts[2]::char(1)
  from (
    -- Trimming \r as well as spaces: this file gets checked out with CRLF
    -- endings on Windows, and without it every name would keep a stray
    -- carriage return.
    select string_to_array(btrim(line, E' \t\r'), '|') as parts
      from unnest(string_to_array($cards$
1|H|Blaine's Moltres
2|H|Brock's Rhydon
3|H|Erika's Clefable
4|H|Erika's Dragonair
5|H|Erika's Vileplume
6|H|Lt. Surge's Electabuzz
7|H|Lt. Surge's Fearow
8|H|Lt. Surge's Magneton
9|H|Misty's Seadra
10|H|Misty's Tentacruel
11|H|Rocket's Hitmonchan
12|H|Rocket's Moltres
13|H|Rocket's Scyther
14|H|Sabrina's Gengar
15|H|Brock
16|H|Erika
17|H|Lt. Surge
18|H|Misty
19|H|The Rocket's Trap
20|R|Brock's Golem
21|R|Brock's Onix
22|R|Brock's Rhyhorn
23|R|Brock's Sandslash
24|R|Brock's Zubat
25|R|Erika's Clefairy
26|R|Erika's Victreebel
27|R|Lt. Surge's Electabuzz
28|R|Lt. Surge's Raichu
29|R|Misty's Cloyster
30|R|Misty's Goldeen
31|R|Misty's Poliwrath
32|R|Misty's Tentacool
33|R|Rocket's Snorlax
34|R|Sabrina's Venomoth
35|U|Blaine's Growlithe
36|U|Blaine's Kangaskhan
37|U|Blaine's Magmar
38|U|Brock's Geodude
39|U|Brock's Golbat
40|U|Brock's Graveler
41|U|Brock's Lickitung
42|U|Erika's Dratini
43|U|Erika's Exeggcute
44|U|Erika's Exeggutor
45|U|Erika's Gloom
46|U|Erika's Gloom
47|U|Erika's Oddish
48|U|Erika's Weepinbell
49|U|Erika's Weepinbell
50|U|Lt. Surge's Magnemite
51|U|Lt. Surge's Raticate
52|U|Lt. Surge's Spearow
53|U|Misty's Poliwhirl
54|U|Misty's Psyduck
55|U|Misty's Seaking
56|U|Misty's Starmie
57|U|Misty's Tentacool
58|U|Sabrina's Haunter
59|U|Sabrina's Jynx
60|U|Sabrina's Slowbro
61|C|Blaine's Charmander
62|C|Blaine's Growlithe
63|C|Blaine's Ponyta
64|C|Blaine's Tauros
65|C|Blaine's Vulpix
66|C|Brock's Geodude
67|C|Brock's Mankey
68|C|Brock's Mankey
69|C|Brock's Onix
70|C|Brock's Rhyhorn
71|C|Brock's Sandshrew
72|C|Brock's Sandshrew
73|C|Brock's Vulpix
74|C|Brock's Zubat
75|C|Erika's Bellsprout
76|C|Erika's Bellsprout
77|C|Erika's Exeggcute
78|C|Erika's Oddish
79|C|Erika's Tangela
80|C|Lt. Surge's Magnemite
81|C|Lt. Surge's Pikachu
82|C|Lt. Surge's Rattata
83|C|Lt. Surge's Spearow
84|C|Lt. Surge's Voltorb
85|C|Misty's Goldeen
86|C|Misty's Horsea
87|C|Misty's Poliwag
88|C|Misty's Seel
89|C|Misty's Shellder
90|C|Misty's Staryu
91|C|Sabrina's Abra
92|C|Sabrina's Drowzee
93|C|Sabrina's Gastly
94|C|Sabrina's Mr. Mime
95|C|Sabrina's Slowpoke
96|C|Sabrina's Venonat
97|R|Blaine's Quiz #1
98|R|Brock
99|R|Charity
100|R|Erika
101|R|Lt. Surge
102|R|Misty
103|R|No Removal Gym
104|R|The Rocket's Training Gym
105|U|Blaine's Last Resort
106|U|Brock's Training Method
107|U|Celadon City Gym
108|U|Cerulean City Gym
109|U|Erika's Maids
110|U|Erika's Perfume
111|U|Good Manners
112|U|Lt. Surge's Treaty
113|U|Minion of Team Rocket
114|U|Misty's Wrath
115|U|Pewter City Gym
116|U|Recall
117|U|Sabrina's ESP
118|U|Secret Mission
119|U|Tickling Machine
120|U|Vermilion City Gym
121|C|Blaine's Gamble
122|C|Energy Flow
123|C|Misty's Duel
124|C|Narrow Gym
125|C|Sabrina's Gaze
126|C|Trash Exchange
127|C|Fighting Energy
128|C|Fire Energy
129|C|Grass Energy
130|C|Lightning Energy
131|C|Psychic Energy
132|C|Water Energy
$cards$, E'\n')) as line
     where btrim(line, E' \t\r') <> ''
  ) t
on conflict (set_code, number) do nothing;

insert into public.vending_packs (set_name, pack_name, image_url, sort_order, is_active, set_code)
values
  ('Gym Heroes', 'Brock',     '/packs/gym-heroes-brock.webp',    41, true, 'gym1'),
  ('Gym Heroes', 'Misty',     '/packs/gym-heroes-misty.webp',    42, true, 'gym1'),
  ('Gym Heroes', 'Lt. Surge', '/packs/gym-heroes-lt-surge.webp', 43, true, 'gym1'),
  ('Gym Heroes', 'Erika',     '/packs/gym-heroes-erika.webp',    44, true, 'gym1')
on conflict (set_name, pack_name) do update
  set image_url = excluded.image_url,
      sort_order = excluded.sort_order,
      is_active = excluded.is_active,
      set_code = excluded.set_code;

-- 0 of 0: nothing left to offer, so build_vending_stock skips it entirely.
insert into public.vending_set_info (set_code, description, total_quantity, claimed_quantity)
values ('gym1',
'Take on the Gym Leaders!

The Gym Heroes expansion brings Brock, Misty, Lt. Surge, Erika, Blaine and Sabrina into the Pokemon trading card game, each with their own Pokemon and their own Gym. Build a deck around a Leader you grew up watching, and find out whether their badge was worth the walk.',
  0, 0)
on conflict (set_code) do nothing;

-- A set with nothing left should not appear even as a sold-out slot. The
-- in-stock branch has honoured remaining inventory since v24; this makes the
-- out-of-stock branch agree, so an exhausted - or not-yet-released - set is
-- absent rather than advertised as empty.
create or replace function public.build_vending_stock(p_cycle bigint, p_sold_out boolean)
returns void language plpgsql security definer set search_path to 'public' as $fn$
declare
  v_total int;
begin
  if p_sold_out then
    insert into public.vending_stock (cycle_no, set_code, display_pack_id, quantity)
    select p_cycle, s.set_code,
           (select vp.id from public.vending_packs vp
             where vp.set_code = s.set_code and vp.is_active
             order by random() limit 1),
           0
      from (select distinct set_code from public.vending_packs where is_active) s
      left join public.vending_set_info i on i.set_code = s.set_code
     where coalesce(i.total_quantity - i.claimed_quantity, 1) > 0
       and random() < 0.85
    on conflict (cycle_no, set_code) do nothing;
    return;
  end if;

  v_total := 1 + floor(random() * 5)::int;

  insert into public.vending_stock (cycle_no, set_code, display_pack_id, quantity)
  with sets as (
    -- Only sets with inventory left can be offered. A null total_quantity is
    -- unlimited, represented here as a very large remaining so the same
    -- comparison works for both.
    select vp.set_code,
           coalesce(i.total_quantity - i.claimed_quantity, 2147483647) as remaining,
           row_number() over (order by vp.set_code) as rn,
           count(*) over () as n
      from (select distinct set_code from public.vending_packs where is_active) vp
      left join public.vending_set_info i on i.set_code = vp.set_code
     where coalesce(i.total_quantity - i.claimed_quantity, 1) > 0
  ),
  units as (
    select 1 + floor(random() * (select n from sets limit 1))::int as pick
      from generate_series(1, v_total)
     where exists (select 1 from sets)
  ),
  agg as (
    select s.set_code, s.remaining, count(*)::int as qty
      from units u
      join sets s on s.rn = u.pick
     group by s.set_code, s.remaining
  )
  select p_cycle, a.set_code,
         (select vp.id from public.vending_packs vp
           where vp.set_code = a.set_code and vp.is_active
           order by random() limit 1),
         -- Never offer more than the set actually has left.
         least(a.qty, a.remaining)
    from agg a
   where least(a.qty, a.remaining) > 0
  on conflict (cycle_no, set_code) do nothing;

  insert into public.vending_ticket_stock (cycle_no, ticket_id, quantity)
  select p_cycle, t.id, 1
    from public.raffle_tickets t
   where t.is_active
     and (t.starts_at is null or now() >= t.starts_at)
     and (t.ends_at   is null or now() <  t.ends_at)
     and t.claimed_quantity < t.total_quantity
     and random() < public.raffle_rarity_chance(t.rarity)
  on conflict (cycle_no, ticket_id) do nothing;
end $fn$;
