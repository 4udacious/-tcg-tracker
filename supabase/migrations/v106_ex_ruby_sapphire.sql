-- EX Ruby & Sapphire (ex1), the first set of the EX series, after Aquapolis.
--
-- 109 cards: 14 holo rares (1-14), 13 rares (15-24, and the Darkness, Metal
-- and Rainbow Energy at 93-95), 34 uncommons, 40 commons (the six basic
-- Energy, 104-109, among them) and the eight Pokémon-ex (96-103, Mewtwo ex,
-- Lapras ex, Scyther ex...). The ex are holos here (H), so the rare slot's
-- holo one time in three is an ex a little over a third of the time. No
-- secret rares. Rarities are pokemontcg.io's.
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
