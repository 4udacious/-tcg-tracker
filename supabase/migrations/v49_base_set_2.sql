-- Base Set 2 (base4): 130 cards, four wrappers.
--
-- A reprint set: Base Set and Jungle side by side under a new "2" symbol.
-- It was only ever printed Unlimited, so there is no edition to match, and
-- pokemontcg.io's base4 art is exactly that print.
--
-- Wrappers: Gyarados, Mewtwo, Pidgeot and Raichu - three flat scans from
-- Bulbagarden Archives and one photographed pack, run through
-- scripts/import-pack-art.mjs.
--
-- Sorted 25-28, between Fossil and Team Rocket, which is where it came out.
--
-- Not stocked, like the Gym sets: the packs are active so the set shows up
-- in /admin/vvm, and vending_set_info starts at 0 of 0 to keep it out of the
-- machine until someone sets a quantity there.

-- number|rarity|name, one card per line. The basic energies (125-130) have
-- no printed rarity and go in as commons, as everywhere else here; Double
-- Colorless Energy (124) is a real uncommon.
--
-- image_url is a generated column (/cards/<set>-<number>.webp), which is
-- exactly where scripts/import-set.mjs puts the art, so it is left alone.
insert into public.vending_cards (set_code, number, name, rarity)
select 'base4', parts[1], parts[3], parts[2]::char(1)
  from (
    select string_to_array(btrim(line, E' \t\r'), '|') as parts
      from unnest(string_to_array($cards$
1|H|Alakazam
2|H|Blastoise
3|H|Chansey
4|H|Charizard
5|H|Clefable
6|H|Clefairy
7|H|Gyarados
8|H|Hitmonchan
9|H|Magneton
10|H|Mewtwo
11|H|Nidoking
12|H|Nidoqueen
13|H|Ninetales
14|H|Pidgeot
15|H|Poliwrath
16|H|Raichu
17|H|Scyther
18|H|Venusaur
19|H|Wigglytuff
20|H|Zapdos
21|R|Beedrill
22|R|Dragonair
23|R|Dugtrio
24|R|Electabuzz
25|R|Electrode
26|R|Kangaskhan
27|R|Mr. Mime
28|R|Pidgeotto
29|R|Pinsir
30|R|Snorlax
31|R|Venomoth
32|R|Victreebel
33|U|Arcanine
34|U|Butterfree
35|U|Charmeleon
36|U|Dewgong
37|U|Dodrio
38|U|Dratini
39|U|Exeggutor
40|U|Farfetch'd
41|U|Fearow
42|U|Growlithe
43|U|Haunter
44|U|Ivysaur
45|U|Jynx
46|U|Kadabra
47|U|Kakuna
48|U|Lickitung
49|U|Machoke
50|U|Magikarp
51|U|Magmar
52|U|Marowak
53|U|Nidorina
54|U|Nidorino
55|U|Parasect
56|U|Persian
57|U|Poliwhirl
58|U|Raticate
59|U|Rhydon
60|U|Seaking
61|U|Seel
62|U|Tauros
63|U|Wartortle
64|U|Weepinbell
65|C|Abra
66|C|Bellsprout
67|C|Bulbasaur
68|C|Caterpie
69|C|Charmander
70|C|Cubone
71|C|Diglett
72|C|Doduo
73|C|Drowzee
74|C|Exeggcute
75|C|Gastly
76|C|Goldeen
77|C|Jigglypuff
78|C|Machop
79|C|Magnemite
80|C|Meowth
81|C|Metapod
82|C|Nidoran ♀
83|C|Nidoran ♂
84|C|Onix
85|C|Paras
86|C|Pidgey
87|C|Pikachu
88|C|Poliwag
89|C|Rattata
90|C|Rhyhorn
91|C|Sandshrew
92|C|Spearow
93|C|Squirtle
94|C|Starmie
95|C|Staryu
96|C|Tangela
97|C|Venonat
98|C|Voltorb
99|C|Vulpix
100|C|Weedle
101|R|Computer Search
102|R|Imposter Professor Oak
103|R|Item Finder
104|R|Lass
105|R|Pokémon Breeder
106|R|Pokémon Trader
107|R|Scoop Up
108|R|Super Energy Removal
109|U|Defender
110|U|Energy Retrieval
111|U|Full Heal
112|U|Maintenance
113|U|PlusPower
114|U|Pokémon Center
115|U|Pokédex
116|U|Professor Oak
117|U|Super Potion
118|C|Bill
119|C|Energy Removal
120|C|Gust of Wind
121|C|Poké Ball
122|C|Potion
123|C|Switch
124|U|Double Colorless Energy
125|C|Fighting Energy
126|C|Fire Energy
127|C|Grass Energy
128|C|Lightning Energy
129|C|Psychic Energy
130|C|Water Energy
$cards$, E'\n')) as line
     where btrim(line, E' \t\r') <> ''
  ) t
on conflict (set_code, number) do nothing;

insert into public.vending_packs (set_name, pack_name, image_url, sort_order, is_active, set_code)
values
  ('Base Set 2', 'Gyarados', '/packs/base-set-2-gyarados.webp', 25, true, 'base4'),
  ('Base Set 2', 'Mewtwo',   '/packs/base-set-2-mewtwo.webp',   26, true, 'base4'),
  ('Base Set 2', 'Pidgeot',  '/packs/base-set-2-pidgeot.webp',  27, true, 'base4'),
  ('Base Set 2', 'Raichu',   '/packs/base-set-2-raichu.webp',   28, true, 'base4')
on conflict (set_name, pack_name) do update
  set image_url = excluded.image_url,
      sort_order = excluded.sort_order,
      is_active = excluded.is_active,
      set_code = excluded.set_code;

-- 0 of 0: nothing left to offer, so build_vending_stock skips it entirely.
insert into public.vending_set_info (set_code, description, total_quantity, claimed_quantity)
values ('base4',
'Back where it all started.

Base Set 2 puts the originals in one box: Base Set and Jungle, reprinted together under a new 2 symbol. Charizard, Blastoise and Venusaur are back in the holo slot, with Scyther, Clefable and Wigglytuff over from the Jungle.',
  0, 0)
on conflict (set_code) do nothing;
