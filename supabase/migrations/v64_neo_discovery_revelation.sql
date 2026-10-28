-- Neo Discovery (neo2) and Neo Revelation (neo3), the eighth and ninth sets:
-- 75 and 66 cards, four wrappers each.
--
-- Like Neo Genesis (v48): 1st Edition art from pokemontcg.io, imported by
-- scripts/import-set.mjs to /cards/<set>-<number>.webp (image_url is a
-- generated column, so it is left alone).
--
-- Wrappers: Neo Discovery's Scizor, Smeargle, Xatu and Umbreon, and Neo
-- Revelation's Entei, Suicune, Raikou and Misdreavus, from Bulbagarden's pack
-- photos through scripts/import-pack-art.mjs.
--
-- Not stocked: the packs are active so both sets show up in /admin/vvm, and
-- vending_set_info starts at 0 of 0 to keep them out of the machine until
-- someone sets a quantity there.

-- number|rarity|name, one card per line. Neo Discovery has no secret cards.
-- Energy Ark (75) is a common Trainer.
insert into public.vending_cards (set_code, number, name, rarity)
select 'neo2', parts[1], parts[3], parts[2]::char(1)
  from (
    select string_to_array(btrim(line, E' \t\r'), '|') as parts
      from unnest(string_to_array($cards$
1|H|Espeon
2|H|Forretress
3|H|Hitmontop
4|H|Houndoom
5|H|Houndour
6|H|Kabutops
7|H|Magnemite
8|H|Politoed
9|H|Poliwrath
10|H|Scizor
11|H|Smeargle
12|H|Tyranitar
13|H|Umbreon
14|H|Unown [A]
15|H|Ursaring
16|H|Wobbuffet
17|H|Yanma
18|R|Beedrill
19|R|Butterfree
20|R|Espeon
21|R|Forretress
22|R|Hitmontop
23|R|Houndoom
24|R|Houndour
25|R|Kabutops
26|R|Magnemite
27|R|Politoed
28|R|Poliwrath
29|R|Scizor
30|R|Smeargle
31|R|Tyranitar
32|R|Umbreon
33|R|Unown [A]
34|R|Ursaring
35|R|Wobbuffet
36|R|Yanma
37|U|Corsola
38|U|Eevee
39|U|Houndour
40|U|Igglybuff
41|U|Kakuna
42|U|Metapod
43|U|Omastar
44|U|Poliwhirl
45|U|Pupitar
46|U|Scyther
47|U|Unown [D]
48|U|Unown [F]
49|U|Unown [M]
50|U|Unown [N]
51|U|Unown [U]
52|U|Xatu
53|C|Caterpie
54|C|Dunsparce
55|C|Hoppip
56|C|Kabuto
57|C|Larvitar
58|C|Mareep
59|C|Natu
60|C|Omanyte
61|C|Pineco
62|C|Poliwag
63|C|Sentret
64|C|Spinarak
65|C|Teddiursa
66|C|Tyrogue
67|C|Unown [E]
68|C|Unown [I]
69|C|Unown [O]
70|C|Weedle
71|C|Wooper
72|U|Fossil Egg
73|U|Hyper Devolution Spray
74|U|Ruin Wall
75|C|Energy Ark
$cards$, E'\n')) as line
     where btrim(line, E' \t\r') <> ''
  ) t
on conflict (set_code, number) do nothing;

-- Neo Revelation is numbered out of 64, with Shining Gyarados (65) and
-- Shining Magikarp (66) as secret rares (S): open_pack gives one its 2%
-- chance like any set with S cards.
insert into public.vending_cards (set_code, number, name, rarity)
select 'neo3', parts[1], parts[3], parts[2]::char(1)
  from (
    select string_to_array(btrim(line, E' \t\r'), '|') as parts
      from unnest(string_to_array($cards$
1|H|Ampharos
2|H|Blissey
3|H|Celebi
4|H|Crobat
5|H|Delibird
6|H|Entei
7|H|Ho-oh
8|H|Houndoom
9|H|Jumpluff
10|H|Magneton
11|H|Misdreavus
12|H|Porygon2
13|H|Raikou
14|H|Suicune
15|R|Aerodactyl
16|R|Celebi
17|R|Entei
18|R|Ho-oh
19|R|Kingdra
20|R|Lugia
21|R|Raichu
22|R|Raikou
23|R|Skarmory
24|R|Sneasel
25|R|Starmie
26|R|Sudowoodo
27|R|Suicune
28|U|Flaaffy
29|U|Golbat
30|U|Graveler
31|U|Jynx
32|U|Lanturn
33|U|Magcargo
34|U|Octillery
35|U|Parasect
36|U|Piloswine
37|U|Seaking
38|U|Stantler
39|U|Unown [B]
40|U|Unown [Y]
41|C|Aipom
42|C|Chinchou
43|C|Farfetch'd
44|C|Geodude
45|C|Goldeen
46|C|Murkrow
47|C|Paras
48|C|Quagsire
49|C|Qwilfish
50|C|Remoraid
51|C|Shuckle
52|C|Skiploom
53|C|Slugma
54|C|Smoochum
55|C|Snubbull
56|C|Staryu
57|C|Swinub
58|C|Unown [K]
59|C|Zubat
60|U|Balloon Berry
61|U|Healing Field
62|U|Pokémon Breeder Fields
63|U|Rocket's Hideout
64|C|Old Rod
65|S|Shining Gyarados
66|S|Shining Magikarp
$cards$, E'\n')) as line
     where btrim(line, E' \t\r') <> ''
  ) t
on conflict (set_code, number) do nothing;

insert into public.vending_packs (set_name, pack_name, image_url, sort_order, is_active, set_code)
values
  ('Neo Discovery',  'Scizor',     '/packs/neo-discovery-scizor.webp',      65, true, 'neo2'),
  ('Neo Discovery',  'Smeargle',   '/packs/neo-discovery-smeargle.webp',    66, true, 'neo2'),
  ('Neo Discovery',  'Umbreon',    '/packs/neo-discovery-umbreon.webp',     67, true, 'neo2'),
  ('Neo Discovery',  'Xatu',       '/packs/neo-discovery-xatu.webp',        68, true, 'neo2'),
  ('Neo Revelation', 'Entei',      '/packs/neo-revelation-entei.webp',      69, true, 'neo3'),
  ('Neo Revelation', 'Misdreavus', '/packs/neo-revelation-misdreavus.webp', 70, true, 'neo3'),
  ('Neo Revelation', 'Raikou',     '/packs/neo-revelation-raikou.webp',     71, true, 'neo3'),
  ('Neo Revelation', 'Suicune',    '/packs/neo-revelation-suicune.webp',    72, true, 'neo3')
on conflict (set_name, pack_name) do update
  set image_url = excluded.image_url,
      sort_order = excluded.sort_order,
      is_active = excluded.is_active,
      set_code = excluded.set_code;

-- 0 of 0: nothing left to offer, so build_vending_stock skips them entirely.
insert into public.vending_set_info (set_code, description, total_quantity, claimed_quantity)
values
('neo2',
'Unown in every corner.

Neo Discovery brings Johto''s Unown into the game, nine letters from A to U, alongside Espeon and Umbreon, Scizor, Tyranitar and Houndoom. Seventeen holos to chase, from Forretress to Politoed, each with a non-holo twin in the rare slot.',
  0, 0),
('neo3',
'The legends return.

Neo Revelation brings Ho-Oh, Lugia''s partner, with Entei, Raikou and Suicune and Celebi among the holos. Look for the first Shining Pokemon: a Shining Gyarados or Shining Magikarp hides past the set''s printed number.',
  0, 0)
on conflict (set_code) do nothing;
