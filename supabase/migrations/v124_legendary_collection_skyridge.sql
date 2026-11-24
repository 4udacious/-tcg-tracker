-- Legendary Collection (base6, May 2002) and Skyridge (ecard3, May 2003): the
-- two gaps before EX Ruby & Sapphire.
--
-- Legendary Collection: 110 cards, reprints from Base Set to Team Rocket: 19
-- holo rares (1-19), 19 rares, 36 uncommons and 36 commons. Its reverse holos
-- aren't separate cards here.
-- Skyridge: as Aquapolis (v102), 144 numbered cards plus 32 holos numbered
-- H1-H32 (each also printed as a plain rare, 1-32), and six Crystal Pokemon
-- (Celebi, Charizard, Crobat, Golem, Ho-oh, Kabutops, 145-150) as secret
-- rares: S, so open_pack gives one its 2% chance as in Aquapolis.
--
-- Both open as every Pokemon set in the machine does (7 commons, 3 uncommons,
-- a rare slot that's a holo one time in three). Rarities are pokemontcg.io's.
--
-- Art from pokemontcg.io at /cards/base6-<number>.webp and
-- /cards/ecard3-<number>.webp (image_url is a generated column). Wrappers
-- through scripts/import-pack-art.mjs: Legendary Collection's four (the
-- legendary birds, Mewtwo, Charizard and the Eeveelutions) and Skyridge's
-- Ho-Oh. Sorted at the end of the list (101-105).
--
-- Not stocked: the packs are active so the sets show up in /admin/vvm, and
-- vending_set_info starts at 0 of 0 to keep them out of the machine until
-- someone sets a quantity there. Safe to re-run.

-- number|rarity|name, one card per line.
insert into public.vending_cards (set_code, number, name, rarity)
select 'base6', parts[1], parts[3], parts[2]::char(1)
  from (
    select string_to_array(btrim(line, E' \t\r'), '|') as parts
      from unnest(string_to_array($cards$
1|H|Alakazam
2|H|Articuno
3|H|Charizard
4|H|Dark Blastoise
5|H|Dark Dragonite
6|H|Dark Persian
7|H|Dark Raichu
8|H|Dark Slowbro
9|H|Dark Vaporeon
10|H|Flareon
11|H|Gengar
12|H|Gyarados
13|H|Hitmonlee
14|H|Jolteon
15|H|Machamp
16|H|Muk
17|H|Ninetales
18|H|Venusaur
19|H|Zapdos
20|R|Beedrill
21|R|Butterfree
22|R|Electrode
23|R|Exeggutor
24|R|Golem
25|R|Hypno
26|R|Jynx
27|R|Kabutops
28|R|Magneton
29|R|Mewtwo
30|R|Moltres
31|R|Nidoking
32|R|Nidoqueen
33|R|Pidgeot
34|R|Pidgeotto
35|R|Rhydon
36|U|Arcanine
37|U|Charmeleon
38|U|Dark Dragonair
39|U|Dark Wartortle
40|U|Dewgong
41|U|Dodrio
42|U|Fearow
43|U|Golduck
44|U|Graveler
45|U|Growlithe
46|U|Haunter
47|U|Ivysaur
48|U|Kabuto
49|U|Kadabra
50|U|Kakuna
51|U|Machoke
52|U|Magikarp
53|U|Meowth
54|U|Metapod
55|U|Nidorina
56|U|Nidorino
57|U|Omanyte
58|U|Omastar
59|U|Primeape
60|U|Rapidash
61|U|Raticate
62|U|Sandslash
63|U|Seadra
64|U|Snorlax
65|U|Tauros
66|U|Tentacruel
67|C|Abra
68|C|Bulbasaur
69|C|Caterpie
70|C|Charmander
71|C|Doduo
72|C|Dratini
73|C|Drowzee
74|C|Eevee
75|C|Exeggcute
76|C|Gastly
77|C|Geodude
78|C|Grimer
79|C|Machop
80|C|Magnemite
81|C|Mankey
82|C|Nidoran ♀
83|C|Nidoran ♂
84|C|Onix
85|C|Pidgey
86|C|Pikachu
87|C|Ponyta
88|C|Psyduck
89|C|Rattata
90|C|Rhyhorn
91|C|Sandshrew
92|C|Seel
93|C|Slowpoke
94|C|Spearow
95|C|Squirtle
96|C|Tentacool
97|C|Voltorb
98|C|Vulpix
99|C|Weedle
100|U|Full Heal Energy
101|U|Potion Energy
102|R|Pokémon Breeder
103|R|Pokémon Trader
104|R|Scoop Up
105|U|The Boss's Way
106|U|Challenge!
107|U|Energy Retrieval
108|C|Bill
109|C|Mysterious Fossil
110|C|Potion
$cards$, E'\n')) as line
     where btrim(line, E' \t\r') <> ''
  ) t
on conflict (set_code, number) do nothing;

insert into public.vending_cards (set_code, number, name, rarity)
select 'ecard3', parts[1], parts[3], parts[2]::char(1)
  from (
    select string_to_array(btrim(line, E' \t\r'), '|') as parts
      from unnest(string_to_array($cards$
1|R|Aerodactyl
2|R|Alakazam
3|R|Arcanine
4|R|Articuno
5|R|Beedrill
6|R|Crobat
7|R|Dewgong
8|R|Flareon
9|R|Forretress
10|R|Gengar
11|R|Gyarados
12|R|Houndoom
13|R|Jolteon
14|R|Kabutops
15|R|Ledian
16|R|Machamp
17|R|Magcargo
18|R|Magcargo
19|R|Magneton
20|R|Magneton
21|R|Moltres
22|R|Nidoqueen
23|R|Omastar
24|R|Piloswine
25|R|Politoed
26|R|Poliwrath
27|R|Raichu
28|R|Raikou
29|R|Rhydon
30|R|Starmie
31|R|Steelix
32|R|Umbreon
33|R|Vaporeon
34|R|Wigglytuff
35|R|Xatu
36|U|Electrode
37|U|Kabuto
38|U|Machoke
39|U|Misdreavus
40|U|Noctowl
41|U|Omanyte
42|U|Persian
43|U|Piloswine
44|U|Starmie
45|U|Wobbuffet
46|C|Abra
47|C|Buried Fossil
48|C|Cleffa
49|C|Delibird
50|C|Diglett
51|C|Ditto
52|C|Dugtrio
53|C|Dunsparce
54|C|Eevee
55|C|Farfetch'd
56|C|Forretress
57|C|Gastly
58|C|Girafarig
59|C|Gligar
60|C|Golbat
61|C|Granbull
62|C|Growlithe
63|C|Haunter
64|C|Heracross
65|C|Hoothoot
66|C|Houndour
67|C|Igglybuff
68|C|Jigglypuff
69|C|Kadabra
70|C|Kakuna
71|C|Lapras
72|C|Ledyba
73|C|Ledyba
74|C|Machop
75|C|Magikarp
76|C|Magnemite
77|C|Mantine
78|C|Meowth
79|C|Murkrow
80|C|Natu
81|C|Nidoran ♀
82|C|Nidoran ♀
83|C|Nidorina
84|C|Pikachu
85|C|Pineco
86|C|Pineco
87|C|Poliwag
88|C|Poliwhirl
89|C|Raticate
90|C|Rattata
91|C|Rhyhorn
92|C|Sandshrew
93|C|Sandslash
94|C|Seel
95|C|Seel
96|C|Shuckle
97|C|Skarmory
98|C|Slugma
99|C|Slugma
100|C|Snorlax
101|C|Snubbull
102|C|Stantler
103|C|Staryu
104|C|Staryu
105|C|Sunflora
106|C|Sunkern
107|C|Swinub
108|C|Swinub
109|C|Teddiursa
110|C|Ursaring
111|C|Venomoth
112|C|Venonat
113|C|Voltorb
114|C|Weedle
115|C|Weedle
116|C|Yanma
117|C|Zubat
118|C|Zubat
119|U|Ancient Ruins
120|U|Relic Hunter
121|U|Apricorn Maker
122|U|Crystal Shard
123|U|Desert Shaman
124|U|Fast Ball
125|U|Fisherman
126|U|Friend Ball
127|U|Hyper Potion
128|U|Lure Ball
129|U|Miracle Sphere α
130|U|Miracle Sphere β
131|U|Miracle Sphere γ
132|U|Mirage Stadium
133|U|Mystery Plate α
134|U|Mystery Plate β
135|U|Mystery Plate γ
136|U|Mystery Plate δ
137|U|Mystery Zone
138|U|Oracle
139|U|Star Piece
140|U|Underground Expedition
141|U|Underground Lake
142|U|Bounce Energy
143|U|Cyclone Energy
144|U|Retro Energy
145|S|Celebi
146|S|Charizard
147|S|Crobat
148|S|Golem
149|S|Ho-oh
150|S|Kabutops
H1|H|Alakazam
H2|H|Arcanine
H3|H|Articuno
H4|H|Beedrill
H5|H|Crobat
H6|H|Dewgong
H7|H|Flareon
H8|H|Forretress
H9|H|Gengar
H10|H|Gyarados
H11|H|Houndoom
H12|H|Jolteon
H13|H|Kabutops
H14|H|Ledian
H15|H|Machamp
H16|H|Magcargo
H17|H|Magcargo
H18|H|Magneton
H19|H|Magneton
H20|H|Moltres
H21|H|Nidoqueen
H22|H|Piloswine
H23|H|Politoed
H24|H|Poliwrath
H25|H|Raichu
H26|H|Raikou
H27|H|Rhydon
H28|H|Starmie
H29|H|Steelix
H30|H|Umbreon
H31|H|Vaporeon
H32|H|Xatu
$cards$, E'\n')) as line
     where btrim(line, E' \t\r') <> ''
  ) t
on conflict (set_code, number) do nothing;

insert into public.vending_packs (set_name, pack_name, image_url, sort_order, is_active, set_code)
values
  ('Legendary Collection', 'Legendary Birds', '/packs/legendary-collection-birds.webp',        101, true, 'base6'),
  ('Legendary Collection', 'Mewtwo',          '/packs/legendary-collection-mewtwo.webp',       102, true, 'base6'),
  ('Legendary Collection', 'Charizard',       '/packs/legendary-collection-charizard.webp',    103, true, 'base6'),
  ('Legendary Collection', 'Eeveelutions',    '/packs/legendary-collection-eeveelutions.webp', 104, true, 'base6'),
  ('Skyridge',             'Ho-Oh',           '/packs/skyridge-ho-oh.webp',                    105, true, 'ecard3')
on conflict (set_name, pack_name) do update
  set image_url = excluded.image_url, sort_order = excluded.sort_order, is_active = excluded.is_active, set_code = excluded.set_code;

insert into public.vending_set_info (set_code, description, total_quantity, claimed_quantity)
values
('base6',
'The classics, together again.

Legendary Collection gathers the best of Base Set, Jungle, Fossil and Team Rocket in a fresh printing: nineteen holos, Charizard, Venusaur, Gengar, Gyarados, Zapdos and Dark Raichu among them, with Mewtwo, Moltres and the rest of the old favourites alongside.',
  0, 0),
('ecard3',
'The last of the e-Cards.

Skyridge closes the e-Card series high above the clouds: thirty-two holos with their own H numbers, Raikou, Moltres, Gengar and Umbreon among them, and six Crystal Pokemon, Celebi, Charizard, Crobat, Golem, Ho-oh and Kabutops, hiding past the printed number.',
  0, 0)
on conflict (set_code) do nothing;
