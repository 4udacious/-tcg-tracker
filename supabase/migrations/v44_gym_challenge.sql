-- Gym Challenge (gym2), the sixth set: 132 cards, four wrappers.
--
-- Cards are the 1st Edition printing, same as gym1 - pokemontcg.io's gym2
-- art carries the EDITION 1 stamp under the art box.
--
-- The wrappers are NOT. The only Gym Challenge pack art available to scan was
-- the Unlimited print, which has no edition stamp above "11 ADDITIONAL GAME
-- CARDS" the way the Gym Heroes wrappers do. Swapping them is one run of
-- scripts/import-pack-art.mjs if 1st Edition photos turn up.
--
-- Not stocked, like gym1: the packs are active so the set shows up in
-- /admin/vvm, and vending_set_info starts at 0 of 0 to keep it out of the
-- machine until someone sets a quantity there.

-- number|rarity|name, one card per line. Energies (127-132) are commons, as
-- everywhere else here. 75 and 76 carry the Nidoran gender signs, which is
-- why this is UTF-8 text rather than an identifier-safe encoding.
--
-- image_url is a generated column (/cards/<set>-<number>.webp), which is
-- exactly where scripts/import-set.mjs puts the art, so it is left alone.
insert into public.vending_cards (set_code, number, name, rarity)
select 'gym2', parts[1], parts[3], parts[2]::char(1)
  from (
    select string_to_array(btrim(line, E' \t\r'), '|') as parts
      from unnest(string_to_array($cards$
1|H|Blaine's Arcanine
2|H|Blaine's Charizard
3|H|Brock's Ninetales
4|H|Erika's Venusaur
5|H|Giovanni's Gyarados
6|H|Giovanni's Machamp
7|H|Giovanni's Nidoking
8|H|Giovanni's Persian
9|H|Koga's Beedrill
10|H|Koga's Ditto
11|H|Lt. Surge's Raichu
12|H|Misty's Golduck
13|H|Misty's Gyarados
14|H|Rocket's Mewtwo
15|H|Rocket's Zapdos
16|H|Sabrina's Alakazam
17|H|Blaine
18|H|Giovanni
19|H|Koga
20|H|Sabrina
21|R|Blaine's Ninetales
22|R|Brock's Dugtrio
23|R|Giovanni's Nidoqueen
24|R|Giovanni's Pinsir
25|R|Koga's Arbok
26|R|Koga's Muk
27|R|Koga's Pidgeotto
28|R|Lt. Surge's Jolteon
29|R|Sabrina's Gengar
30|R|Sabrina's Golduck
31|U|Blaine's Charmeleon
32|U|Blaine's Dodrio
33|U|Blaine's Rapidash
34|U|Brock's Graveler
35|U|Brock's Primeape
36|U|Brock's Sandslash
37|U|Brock's Vulpix
38|U|Erika's Bellsprout
39|U|Erika's Bulbasaur
40|U|Erika's Clefairy
41|U|Erika's Ivysaur
42|U|Giovanni's Machoke
43|U|Giovanni's Meowth
44|U|Giovanni's Nidorina
45|U|Giovanni's Nidorino
46|U|Koga's Golbat
47|U|Koga's Kakuna
48|U|Koga's Koffing
49|U|Koga's Pidgey
50|U|Koga's Weezing
51|U|Lt. Surge's Eevee
52|U|Lt. Surge's Electrode
53|U|Lt. Surge's Raticate
54|U|Misty's Dewgong
55|U|Sabrina's Haunter
56|U|Sabrina's Hypno
57|U|Sabrina's Jynx
58|U|Sabrina's Kadabra
59|U|Sabrina's Mr. Mime
60|C|Blaine's Charmander
61|C|Blaine's Doduo
62|C|Blaine's Growlithe
63|C|Blaine's Mankey
64|C|Blaine's Ponyta
65|C|Blaine's Rhyhorn
66|C|Blaine's Vulpix
67|C|Brock's Diglett
68|C|Brock's Geodude
69|C|Erika's Jigglypuff
70|C|Erika's Oddish
71|C|Erika's Paras
72|C|Giovanni's Machop
73|C|Giovanni's Magikarp
74|C|Giovanni's Meowth
75|C|Giovanni's Nidoran ♀
76|C|Giovanni's Nidoran ♂
77|C|Koga's Ekans
78|C|Koga's Grimer
79|C|Koga's Koffing
80|C|Koga's Pidgey
81|C|Koga's Tangela
82|C|Koga's Weedle
83|C|Koga's Zubat
84|C|Lt. Surge's Pikachu
85|C|Lt. Surge's Rattata
86|C|Lt. Surge's Voltorb
87|C|Misty's Horsea
88|C|Misty's Magikarp
89|C|Misty's Poliwag
90|C|Misty's Psyduck
91|C|Misty's Seel
92|C|Misty's Staryu
93|C|Sabrina's Abra
94|C|Sabrina's Abra
95|C|Sabrina's Drowzee
96|C|Sabrina's Gastly
97|C|Sabrina's Gastly
98|C|Sabrina's Porygon
99|C|Sabrina's Psyduck
100|R|Blaine
101|R|Brock's Protection
102|R|Chaos Gym
103|R|Erika's Kindness
104|R|Giovanni
105|R|Giovanni's Last Resort
106|R|Koga
107|R|Lt. Surge's Secret Plan
108|R|Misty's Wish
109|R|Resistance Gym
110|R|Sabrina
111|U|Blaine's Quiz #2
112|U|Blaine's Quiz #3
113|U|Cinnabar City Gym
114|U|Fuchsia City Gym
115|U|Koga's Ninja Trick
116|U|Master Ball
117|U|Max Revive
118|U|Misty's Tears
119|U|Rocket's Minefield Gym
120|U|Rocket's Secret Experiment
121|U|Sabrina's Psychic Control
122|U|Saffron City Gym
123|U|Viridian City Gym
124|C|Fervor
125|C|Transparent Walls
126|C|Warp Point
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
  ('Gym Challenge', 'Blaine',   '/packs/gym-challenge-blaine.webp',   51, true, 'gym2'),
  ('Gym Challenge', 'Giovanni', '/packs/gym-challenge-giovanni.webp', 52, true, 'gym2'),
  ('Gym Challenge', 'Koga',     '/packs/gym-challenge-koga.webp',     53, true, 'gym2'),
  ('Gym Challenge', 'Sabrina',  '/packs/gym-challenge-sabrina.webp',  54, true, 'gym2')
on conflict (set_name, pack_name) do update
  set image_url = excluded.image_url,
      sort_order = excluded.sort_order,
      is_active = excluded.is_active,
      set_code = excluded.set_code;

-- 0 of 0: nothing left to offer, so build_vending_stock skips it entirely.
insert into public.vending_set_info (set_code, description, total_quantity, claimed_quantity)
values ('gym2',
'The badges get harder.

Gym Challenge closes the Gym series with Blaine, Giovanni, Koga and Sabrina, and the Pokemon they are not supposed to have. Blaine''s Charizard, Rocket''s Mewtwo, Giovanni''s Nidoking - the leaders who were waiting at the end of the road, with the decks to prove it.',
  0, 0)
on conflict (set_code) do nothing;
