-- Expedition Base Set (ecard1) and Aquapolis (ecard2), the first two e-Card
-- sets, after Neo Destiny.
--
-- Expedition: 165 cards, the 32 holo rares numbered 1-32 (each also printed
-- as a plain rare; here the holo stands for both), 40 rares, 38 uncommons,
-- 49 commons and the six basic Energy (as commons). No secret rares.
-- Aquapolis: 150 numbered cards plus 32 holos numbered H1-H32, and three
-- Crystal Pokémon (Kingdra, Lugia, Nidoking, 148-150) as secret rares: S, so
-- open_pack gives one its 2% chance as in Neo Revelation and Destiny.
--
-- Both use the usual eleven-card pack (7 commons, 3 uncommons, a rare slot
-- that's a holo one time in three), though the real ones held nine: every
-- set in the machine opens the same way. Rarities are pokemontcg.io's.
--
-- Art from pokemontcg.io at /cards/ecard1-<number>.webp and
-- /cards/ecard2-<number>.webp (H1-H32 included; image_url is a generated
-- column). Wrappers: Expedition's Blastoise and Aquapolis's Arcanine, from
-- pack photos through scripts/import-pack-art.mjs.
--
-- Not stocked: the packs are active so the sets show up in /admin/vvm, and
-- vending_set_info starts at 0 of 0 to keep them out of the machine until
-- someone sets a quantity there. Safe to re-run.

-- number|rarity|name, one card per line.
insert into public.vending_cards (set_code, number, name, rarity)
select 'ecard1', parts[1], parts[3], parts[2]::char(1)
  from (
    select string_to_array(btrim(line, E' \t\r'), '|') as parts
      from unnest(string_to_array($cards$
1|H|Alakazam
2|H|Ampharos
3|H|Arbok
4|H|Blastoise
5|H|Butterfree
6|H|Charizard
7|H|Clefable
8|H|Cloyster
9|H|Dragonite
10|H|Dugtrio
11|H|Fearow
12|H|Feraligatr
13|H|Gengar
14|H|Golem
15|H|Kingler
16|H|Machamp
17|H|Magby
18|H|Meganium
19|H|Mew
20|H|Mewtwo
21|H|Ninetales
22|H|Pichu
23|H|Pidgeot
24|H|Poliwrath
25|H|Raichu
26|H|Rapidash
27|H|Skarmory
28|H|Typhlosion
29|H|Tyranitar
30|H|Venusaur
31|H|Vileplume
32|H|Weezing
33|R|Alakazam
34|R|Ampharos
35|R|Arbok
36|R|Blastoise
37|R|Blastoise
38|R|Butterfree
39|R|Charizard
40|R|Charizard
41|R|Clefable
42|R|Cloyster
43|R|Dragonite
44|R|Dugtrio
45|R|Fearow
46|R|Feraligatr
47|R|Feraligatr
48|R|Gengar
49|R|Golem
50|R|Kingler
51|R|Machamp
52|R|Magby
53|R|Meganium
54|R|Meganium
55|R|Mew
56|R|Mewtwo
57|R|Ninetales
58|R|Pichu
59|R|Pidgeot
60|R|Poliwrath
61|R|Raichu
62|R|Rapidash
63|R|Skarmory
64|R|Typhlosion
65|R|Typhlosion
66|R|Tyranitar
67|R|Venusaur
68|R|Venusaur
69|R|Vileplume
70|R|Weezing
71|U|Bayleef
72|U|Chansey
73|U|Charmeleon
74|U|Croconaw
75|U|Dragonair
76|U|Electabuzz
77|U|Flaaffy
78|U|Gloom
79|U|Graveler
80|U|Haunter
81|U|Hitmonlee
82|U|Ivysaur
83|U|Jynx
84|U|Kadabra
85|U|Machoke
86|U|Magmar
87|U|Metapod
88|U|Pidgeotto
89|U|Poliwhirl
90|U|Pupitar
91|U|Quilava
92|U|Wartortle
93|C|Abra
94|C|Bulbasaur
95|C|Bulbasaur
96|C|Caterpie
97|C|Charmander
98|C|Charmander
99|C|Chikorita
100|C|Chikorita
101|C|Clefairy
102|C|Corsola
103|C|Cubone
104|C|Cyndaquil
105|C|Cyndaquil
106|C|Diglett
107|C|Dratini
108|C|Ekans
109|C|Gastly
110|C|Geodude
111|C|Goldeen
112|C|Hoppip
113|C|Houndour
114|C|Koffing
115|C|Krabby
116|C|Larvitar
117|C|Machop
118|C|Magikarp
119|C|Mareep
120|C|Marill
121|C|Meowth
122|C|Oddish
123|C|Pidgey
124|C|Pikachu
125|C|Poliwag
126|C|Ponyta
127|C|Qwilfish
128|C|Rattata
129|C|Shellder
130|C|Spearow
131|C|Squirtle
132|C|Squirtle
133|C|Tauros
134|C|Totodile
135|C|Totodile
136|C|Vulpix
137|U|Bill's Maintenance
138|U|Copycat
139|U|Dual Ball
140|U|Energy Removal 2
141|U|Energy Restore
142|U|Mary's Impulse
143|U|Master Ball
144|U|Multi Technical Machine 01
145|U|Pokémon Nurse
146|U|Pokémon Reversal
147|U|Power Charge
148|U|Professor Elm's Training Method
149|U|Professor Oak's Research
150|U|Strength Charm
151|U|Super Scoop Up
152|U|Warp Point
153|C|Energy Search
154|C|Full Heal
155|C|Moo-Moo Milk
156|C|Potion
157|C|Switch
158|R|Darkness Energy
159|R|Metal Energy
160|C|Fighting Energy
161|C|Fire Energy
162|C|Grass Energy
163|C|Lightning Energy
164|C|Psychic Energy
165|C|Water Energy
$cards$, E'\n')) as line
     where btrim(line, E' \t\r') <> ''
  ) t
on conflict (set_code, number) do nothing;

insert into public.vending_cards (set_code, number, name, rarity)
select 'ecard2', parts[1], parts[3], parts[2]::char(1)
  from (
    select string_to_array(btrim(line, E' \t\r'), '|') as parts
      from unnest(string_to_array($cards$
1|R|Ampharos
2|R|Arcanine
3|R|Ariados
4|R|Azumarill
5|R|Bellossom
6|R|Blissey
7|R|Donphan
8|R|Electrode
9|R|Elekid
10|R|Entei
11|R|Espeon
12|R|Exeggutor
13|R|Exeggutor
14|R|Houndoom
15|R|Houndoom
16|R|Hypno
17|R|Jumpluff
18|R|Jynx
19|R|Kingdra
20|R|Lanturn
21|R|Lanturn
22|R|Magneton
23|R|Muk
24|R|Nidoking
25|R|Ninetales
26|R|Octillery
27|R|Parasect
28|R|Porygon2
29|R|Primeape
30|R|Quagsire
31|R|Rapidash
32|R|Scizor
33|R|Slowbro
34|R|Slowking
35|R|Steelix
36|R|Sudowoodo
37|R|Suicune
38|R|Tentacruel
39|R|Togetic
40|R|Tyranitar
41|R|Umbreon
42|R|Victreebel
43|R|Vileplume
44|R|Zapdos
45|U|Bellsprout
46|U|Dodrio
47|U|Flaaffy
48|U|Furret
49|U|Gloom
50|U|Golduck
51|U|Growlithe
52|U|Magnemite
53|U|Marill
54|U|Marowak
55|U|Nidorino
56|U|Pupitar
57|U|Scyther
58|U|Seadra
59|U|Seaking
60|U|Skiploom
61|U|Smoochum
62|U|Spinarak
63|U|Tyrogue
64|U|Voltorb
65|U|Weepinbell
66|U|Wooper
67|C|Aipom
68|C|Bellsprout
69|C|Chansey
70|C|Chinchou
71|C|Chinchou
72|C|Cubone
73|C|Doduo
74|C|Drowzee
75|C|Eevee
76|C|Exeggcute
77|C|Exeggcute
78|C|Goldeen
79|C|Grimer
80|C|Growlithe
81|C|Hitmonchan
82|C|Hitmontop
83|C|Hoppip
84|C|Horsea
85|C|Horsea
86|C|Houndour
87|C|Houndour
88|C|Kangaskhan
89|C|Larvitar
90|C|Lickitung
91|C|Magnemite
92|C|Mankey
93|C|Mareep
94|C|Miltank
95|C|Mr. Mime
96|C|Nidoran ♂
97|C|Oddish
98|C|Onix
99|C|Paras
100|C|Phanpy
101|C|Pinsir
102|C|Ponyta
103|C|Porygon
104|C|Psyduck
105|C|Remoraid
106|C|Scyther
107|C|Sentret
108|C|Slowpoke
109|C|Smeargle
110|C|Sneasel
111|C|Spinarak
112|C|Tangela
113|C|Tentacool
114|C|Togepi
115|C|Voltorb
116|C|Vulpix
117|C|Wooper
118|R|Apricorn Forest
119|U|Darkness Cube 01
120|U|Energy Switch
121|U|Fighting Cube 01
122|U|Fire Cube 01
123|U|Forest Guardian
124|U|Grass Cube 01
125|U|Healing Berry
126|U|Juggler
127|U|Lightning Cube 01
128|U|Memory Berry
129|U|Metal Cube 01
130|U|Pokémon Fan Club
131|U|Pokémon Park
132|U|Psychic Cube 01
133|U|Seer
134|U|Super Energy Removal 2
135|U|Time Shard
136|U|Town Volunteers
137|U|Traveling Salesman
138|U|Undersea Ruins
139|U|Power Plant
140|U|Water Cube 01
141|U|Weakness Guard
142|R|Darkness Energy
143|R|Metal Energy
144|R|Rainbow Energy
145|U|Boost Energy
146|U|Crystal Energy
147|U|Warp Energy
148|S|Kingdra
149|S|Lugia
150|S|Nidoking
H1|H|Ampharos
H2|H|Arcanine
H3|H|Ariados
H4|H|Azumarill
H5|H|Bellossom
H6|H|Blissey
H7|H|Electrode
H8|H|Entei
H9|H|Espeon
H10|H|Exeggutor
H11|H|Houndoom
H12|H|Hypno
H13|H|Jumpluff
H14|H|Kingdra
H15|H|Lanturn
H16|H|Magneton
H17|H|Muk
H18|H|Nidoking
H19|H|Ninetales
H20|H|Octillery
H21|H|Scizor
H22|H|Slowking
H23|H|Steelix
H24|H|Sudowoodo
H25|H|Suicune
H26|H|Tentacruel
H27|H|Togetic
H28|H|Tyranitar
H29|H|Umbreon
H30|H|Victreebel
H31|H|Vileplume
H32|H|Zapdos
$cards$, E'\n')) as line
     where btrim(line, E' \t\r') <> ''
  ) t
on conflict (set_code, number) do nothing;

insert into public.vending_packs (set_name, pack_name, image_url, sort_order, is_active, set_code)
values
  ('Expedition', 'Blastoise', '/packs/expedition-blastoise.webp', 78, true, 'ecard1'),
  ('Aquapolis',  'Arcanine',  '/packs/aquapolis-arcanine.webp',   79, true, 'ecard2')
on conflict (set_name, pack_name) do update
  set image_url = excluded.image_url,
      sort_order = excluded.sort_order,
      is_active = excluded.is_active,
      set_code = excluded.set_code;

-- 0 of 0: nothing left to offer, so build_vending_stock skips them entirely.
insert into public.vending_set_info (set_code, description, total_quantity, claimed_quantity)
values
('ecard1',
'The e-Card era begins.

Expedition Base Set rebuilt the game for the e-Reader: every card carries a dot-code strip along its edge, and the Pokemon return in a fresh, painterly style. Thirty-two holos lead it, Charizard, Blastoise, Venusaur, Mewtwo and Ninetales among them, with Pokemon Trainers like Professor Oak''s Research to back them up.',
  0, 0),
('ecard2',
'Beneath the waves.

Aquapolis takes the e-Card series into a city under the sea: thirty-two holos with their own H numbers, Lugia, Suicune, Entei and Tyranitar among them, and the first Crystal Pokemon, Kingdra, Lugia and Nidoking, hiding past the printed number.',
  0, 0)
on conflict (set_code) do nothing;
