-- Neo Genesis (neo1), the seventh set: 111 cards, four wrappers.
--
-- Cards are the 1st Edition printing, like the Gym sets - pokemontcg.io's
-- neo1 art carries the EDITION 1 stamp at the left end of the flavour bar.
--
-- The four wrappers (Feraligatr, Lugia, Meganium, Typhlosion) are 1st
-- Edition too: Typhlosion from TCGplayer's product photo, the other three
-- photographed packs, run through scripts/import-pack-art.mjs.
--
-- Not stocked, like the Gym sets: the packs are active so the set shows up
-- in /admin/vvm, and vending_set_info starts at 0 of 0 to keep it out of the
-- machine until someone sets a quantity there.

-- number|rarity|name, one card per line. The basic energies (106-111) have
-- no printed rarity and go in as commons, as everywhere else here; Metal
-- Energy (19) is a real holo, and Darkness and Recycle Energy (104, 105) are
-- real rares. PokéGear, New Pokédex and Pokémon March keep their accents.
--
-- image_url is a generated column (/cards/<set>-<number>.webp), which is
-- exactly where scripts/import-set.mjs puts the art, so it is left alone.
insert into public.vending_cards (set_code, number, name, rarity)
select 'neo1', parts[1], parts[3], parts[2]::char(1)
  from (
    select string_to_array(btrim(line, E' \t\r'), '|') as parts
      from unnest(string_to_array($cards$
1|H|Ampharos
2|H|Azumarill
3|H|Bellossom
4|H|Feraligatr
5|H|Feraligatr
6|H|Heracross
7|H|Jumpluff
8|H|Kingdra
9|H|Lugia
10|H|Meganium
11|H|Meganium
12|H|Pichu
13|H|Skarmory
14|H|Slowking
15|H|Steelix
16|H|Togetic
17|H|Typhlosion
18|H|Typhlosion
19|H|Metal Energy
20|R|Cleffa
21|R|Donphan
22|R|Elekid
23|R|Magby
24|R|Murkrow
25|R|Sneasel
26|U|Aipom
27|U|Ariados
28|U|Bayleef
29|U|Bayleef
30|U|Clefairy
31|U|Croconaw
32|U|Croconaw
33|U|Electabuzz
34|U|Flaaffy
35|U|Furret
36|U|Gloom
37|U|Granbull
38|U|Lanturn
39|U|Ledian
40|U|Magmar
41|U|Miltank
42|U|Noctowl
43|U|Phanpy
44|U|Piloswine
45|U|Quagsire
46|U|Quilava
47|U|Quilava
48|U|Seadra
49|U|Skiploom
50|U|Sunflora
51|U|Togepi
52|U|Xatu
53|C|Chikorita
54|C|Chikorita
55|C|Chinchou
56|C|Cyndaquil
57|C|Cyndaquil
58|C|Girafarig
59|C|Gligar
60|C|Hoothoot
61|C|Hoppip
62|C|Horsea
63|C|Ledyba
64|C|Mantine
65|C|Mareep
66|C|Marill
67|C|Natu
68|C|Oddish
69|C|Onix
70|C|Pikachu
71|C|Sentret
72|C|Shuckle
73|C|Slowpoke
74|C|Snubbull
75|C|Spinarak
76|C|Stantler
77|C|Sudowoodo
78|C|Sunkern
79|C|Swinub
80|C|Totodile
81|C|Totodile
82|C|Wooper
83|R|Arcade Game
84|R|Ecogym
85|R|Energy Charge
86|R|Focus Band
87|R|Mary
88|R|PokéGear
89|R|Super Energy Retrieval
90|R|Time Capsule
91|U|Bill's Teleporter
92|U|Card-Flip Game
93|U|Gold Berry
94|U|Miracle Berry
95|U|New Pokédex
96|U|Professor Elm
97|U|Sprout Tower
98|U|Super Scoop Up
99|C|Berry
100|C|Double Gust
101|C|Moo-Moo Milk
102|C|Pokémon March
103|C|Super Rod
104|R|Darkness Energy
105|R|Recycle Energy
106|C|Fighting Energy
107|C|Fire Energy
108|C|Grass Energy
109|C|Lightning Energy
110|C|Psychic Energy
111|C|Water Energy
$cards$, E'\n')) as line
     where btrim(line, E' \t\r') <> ''
  ) t
on conflict (set_code, number) do nothing;

insert into public.vending_packs (set_name, pack_name, image_url, sort_order, is_active, set_code)
values
  ('Neo Genesis', 'Feraligatr', '/packs/neo-genesis-feraligatr.webp', 61, true, 'neo1'),
  ('Neo Genesis', 'Lugia',      '/packs/neo-genesis-lugia.webp',      62, true, 'neo1'),
  ('Neo Genesis', 'Meganium',   '/packs/neo-genesis-meganium.webp',   63, true, 'neo1'),
  ('Neo Genesis', 'Typhlosion', '/packs/neo-genesis-typhlosion.webp', 64, true, 'neo1')
on conflict (set_name, pack_name) do update
  set image_url = excluded.image_url,
      sort_order = excluded.sort_order,
      is_active = excluded.is_active,
      set_code = excluded.set_code;

-- 0 of 0: nothing left to offer, so build_vending_stock skips it entirely.
insert into public.vending_set_info (set_code, description, total_quantity, claimed_quantity)
values ('neo1',
'A new world opens.

Neo Genesis carries the game into Johto: the first Gold and Silver Pokemon, the babies, and two new types in Darkness and Metal. Lugia leads the holos with Typhlosion, Feraligatr and Meganium beside it, and a Pichu is waiting in the rare slot.',
  0, 0)
on conflict (set_code) do nothing;
