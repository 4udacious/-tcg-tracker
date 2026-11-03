-- Neo Destiny (neo4), the tenth set: 105 cards and 8 Shining Pokémon as
-- secret rares (106-113, S: open_pack gives one its 2% chance like Neo
-- Revelation's). The usual eleven-card pack.
--
-- Art from pokemontcg.io at /cards/neo4-<number>.webp (image_url is a
-- generated column). Wrappers: Dark Espeon, Dark Tyranitar, Light Arcanine
-- and Light Dragonite, made from the set's logo and those holos' art (no pack
-- photos could be fetched); swap in photos with scripts/import-pack-art.mjs
-- under the same file names.
--
-- Not stocked: the packs are active so the set shows up in /admin/vvm, and
-- vending_set_info starts at 0 of 0 to keep it out of the machine until
-- someone sets a quantity there. Safe to re-run.

-- number|rarity|name, one card per line.
insert into public.vending_cards (set_code, number, name, rarity)
select 'neo4', parts[1], parts[3], parts[2]::char(1)
  from (
    select string_to_array(btrim(line, E' \t\r'), '|') as parts
      from unnest(string_to_array($cards$
1|H|Dark Ampharos
2|H|Dark Crobat
3|H|Dark Donphan
4|H|Dark Espeon
5|H|Dark Feraligatr
6|H|Dark Gengar
7|H|Dark Houndoom
8|H|Dark Porygon2
9|H|Dark Scizor
10|H|Dark Typhlosion
11|H|Dark Tyranitar
12|H|Light Arcanine
13|H|Light Azumarill
14|H|Light Dragonite
15|H|Light Togetic
16|H|Miracle Energy
17|R|Dark Ariados
18|R|Dark Magcargo
19|R|Dark Omastar
20|R|Dark Slowking
21|R|Dark Ursaring
22|R|Light Dragonair
23|R|Light Lanturn
24|R|Light Ledian
25|R|Light Machamp
26|R|Light Piloswine
27|R|Unown [G]
28|R|Unown [H]
29|R|Unown [W]
30|R|Unown [X]
31|U|Chansey
32|U|Dark Croconaw
33|U|Dark Exeggutor
34|U|Dark Flaaffy
35|U|Dark Forretress
36|U|Dark Haunter
37|U|Dark Omanyte
38|U|Dark Pupitar
39|U|Dark Quilava
40|U|Dark Wigglytuff
41|U|Heracross
42|U|Hitmonlee
43|U|Houndour
44|U|Jigglypuff
45|U|Light Dewgong
46|U|Light Flareon
47|U|Light Golduck
48|U|Light Jolteon
49|U|Light Machoke
50|U|Light Ninetales
51|U|Light Slowbro
52|U|Light Vaporeon
53|U|Light Venomoth
54|U|Light Wigglytuff
55|U|Scyther
56|U|Togepi
57|U|Unown [C]
58|U|Unown [P]
59|U|Unown [Q]
60|U|Unown [Z]
61|C|Cyndaquil
62|C|Dark Octillery
63|C|Dratini
64|C|Exeggcute
65|C|Gastly
66|C|Girafarig
67|C|Gligar
68|C|Growlithe
69|C|Hitmonchan
70|C|Larvitar
71|C|Ledyba
72|C|Light Sunflora
73|C|Machop
74|C|Mantine
75|C|Mareep
76|C|Phanpy
77|C|Pineco
78|C|Porygon
79|C|Psyduck
80|C|Remoraid
81|C|Seel
82|C|Slugma
83|C|Sunkern
84|C|Swinub
85|C|Totodile
86|C|Unown [L]
87|C|Unown [S]
88|C|Unown [T]
89|C|Unown [V]
90|C|Venonat
91|C|Vulpix
92|R|Broken Ground Gym
93|R|EXP.ALL
94|R|Impostor Professor Oak's Invention
95|R|Radio Tower
96|R|Thought Wave Machine
97|U|Counterattack Claws
98|U|Energy Amplifier
99|U|Energy Stadium
100|U|Lucky Stadium
101|U|Magnifier
102|U|Pokémon Personality Test
103|U|Team Rocket's Evil Deeds
104|C|Heal Powder
105|C|Mail from Bill
106|S|Shining Celebi
107|S|Shining Charizard
108|S|Shining Kabutops
109|S|Shining Mewtwo
110|S|Shining Noctowl
111|S|Shining Raichu
112|S|Shining Steelix
113|S|Shining Tyranitar
$cards$, E'\n')) as line
     where btrim(line, E' \t\r') <> ''
  ) t
on conflict (set_code, number) do nothing;

insert into public.vending_packs (set_name, pack_name, image_url, sort_order, is_active, set_code)
values
  ('Neo Destiny', 'Dark Espeon',     '/packs/neo-destiny-dark-espeon.webp',     74, true, 'neo4'),
  ('Neo Destiny', 'Dark Tyranitar',  '/packs/neo-destiny-dark-tyranitar.webp',  75, true, 'neo4'),
  ('Neo Destiny', 'Light Arcanine',  '/packs/neo-destiny-light-arcanine.webp',  76, true, 'neo4'),
  ('Neo Destiny', 'Light Dragonite', '/packs/neo-destiny-light-dragonite.webp', 77, true, 'neo4')
on conflict (set_name, pack_name) do update
  set image_url = excluded.image_url,
      sort_order = excluded.sort_order,
      is_active = excluded.is_active,
      set_code = excluded.set_code;

-- 0 of 0: nothing left to offer, so build_vending_stock skips it entirely.
insert into public.vending_set_info (set_code, description, total_quantity, claimed_quantity)
values
('neo4',
'Light and Dark.

Neo Destiny brings Light Pokemon, kind-hearted partners like Light Dragonite and Light Arcanine, to face Team Rocket''s Dark Pokemon: Dark Espeon, Dark Tyranitar, Dark Gengar and more among its sixteen holos. Past the printed number hide eight Shining Pokemon, Shining Charizard and Shining Mewtwo among them.',
  0, 0)
on conflict (set_code) do nothing;
