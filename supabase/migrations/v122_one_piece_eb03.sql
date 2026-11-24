-- The One Piece Card Game's third Extra Booster: ONE PIECE Heroines Edition
-- (EB-03, 90 cards: its own 62, 19 Parallel arts and 9 Special cards). As v113:
-- cards from the official English card list, art at /cards/eb03-<number>.webp,
-- rarities C, R, H (SR), S (SEC), L (Leader) and P (any Parallel, and the
-- Special cards).
--
-- An Extra Booster has no Uncommons: open_pack already deals Rares in their
-- place (v113), and the home feed already reads eb codes as One Piece. So this
-- only adds the cards, the pack and the set.
--
-- EB-04 isn't here: in English its cards come inside the OP-14 and OP-15
-- boosters rather than a pack of its own.
--
-- Not stocked: the pack is active so the set shows up in /admin/vvm, and
-- vending_set_info starts at 0 of 0 to keep it out of the machine until
-- someone sets a quantity there (which also puts it on the machine's idle
-- screen, v120). Safe to re-run.

-- set|number|rarity|name, one card per line.
insert into public.vending_cards (set_code, number, name, rarity)
select parts[1], parts[2], parts[4], parts[3]::char(1)
  from (
    select string_to_array(btrim(line, E' \t\r'), '|') as parts
      from unnest(string_to_array($cards$
eb03|001|L|Nefeltari Vivi
eb03|001_p1|P|Nefeltari Vivi
eb03|002|C|Ain
eb03|003|H|Uta
eb03|003_p1|P|Uta
eb03|004|C|Carina
eb03|005|R|Sugar
eb03|006|R|Nami
eb03|007|C|Baccarat
eb03|008|R|Hibari
eb03|008_p1|P|Hibari
eb03|009|C|Makino
eb03|010|R|Monet
eb03|011|C|But If We Ever See Each Other Again... Will You Call Me Your Shipmate?!!
eb03|012|R|Otama
eb03|013|R|Carrot
eb03|013_p1|P|Carrot
eb03|014|C|Kuina
eb03|015|C|Camie
eb03|016|C|Kouzuki Hiyori
eb03|017|R|Jewelry Bonney
eb03|018|H|Tashigi
eb03|018_p1|P|Tashigi
eb03|019|C|Wanda
eb03|020|C|There You Are, Sore Loser!
eb03|021|C|Alvida
eb03|022|R|Isuka
eb03|023|C|Kaya
eb03|024|H|Nefeltari Vivi
eb03|024_p1|P|Nefeltari Vivi
eb03|025|R|Hina
eb03|025_p1|P|Hina
eb03|026|H|Boa Hancock
eb03|026_p1|P|Boa Hancock
eb03|027|R|Marguerite
eb03|028|C|Yu
eb03|029|C|Insolent Fool!! Stand Down!!
eb03|030|C|Viola
eb03|031|H|Vinsmoke Reiju
eb03|031_p1|P|Vinsmoke Reiju
eb03|032|C|Charlotte Flampe
eb03|033|C|Charlotte Brulee
eb03|034|R|Charlotte Linlin
eb03|034_p1|P|Charlotte Linlin
eb03|035|R|Charlotte Pudding
eb03|036|C|Baby 5
eb03|037|R|Lim
eb03|038|C|Thanks for the Treat. ♡
eb03|039|R|Ulti
eb03|040|C|Kalifa
eb03|041|R|Kujyaku
eb03|041_p1|P|Kujyaku
eb03|042|H|Koala
eb03|042_p1|P|Koala
eb03|043|R|Stussy
eb03|044|C|Black Maria
eb03|045|H|Perona
eb03|045_p1|P|Perona
eb03|046|C|Miss Doublefinger(Zala)
eb03|047|C|Miss.Valentine(Mikita)
eb03|048|R|Rebecca
eb03|049|C|I Knew You People Were Behind This.
eb03|050|C|Conis
eb03|051|C|Charlotte Smoothie
eb03|052|R|Shirahoshi
eb03|053|H|Nami
eb03|053_p1|P|Nami
eb03|054|C|Nico Robin
eb03|055|H|Nico Robin
eb03|055_p1|P|Nico Robin
eb03|056|C|Belo Betty
eb03|057|R|Yamato
eb03|057_p1|P|Yamato
eb03|058|R|Lilith
eb03|059|R|S-Snake
eb03|060|C|Will You Be My Servant?
eb03|061|S|Uta
eb03|061_p1|P|Uta
eb03|061_p2|P|Uta
eb03|062|S|Trafalgar Law
eb03|062_p1|P|Trafalgar Law
eb03|003_p2|P|Uta
eb03|018_p2|P|Tashigi
eb03|024_p2|P|Nefeltari Vivi
eb03|026_p2|P|Boa Hancock
eb03|031_p2|P|Vinsmoke Reiju
eb03|042_p2|P|Koala
eb03|045_p2|P|Perona
eb03|053_p2|P|Nami
eb03|055_p2|P|Nico Robin
$cards$, E'\n')) as line
     where btrim(line, E' \t\r') <> ''
  ) t
on conflict (set_code, number) do nothing;

insert into public.vending_packs (set_name, pack_name, image_url, sort_order, is_active, set_code)
values
  ('Heroines Edition', 'EB-03', '/packs/one-piece-heroines-edition.webp', 98, true, 'eb03')
on conflict (set_name, pack_name) do update
  set image_url = excluded.image_url, sort_order = excluded.sort_order, is_active = excluded.is_active, set_code = excluded.set_code;

insert into public.vending_set_info (set_code, description, total_quantity, claimed_quantity, game)
values
('eb03', 'The heroines take the stage.

Heroines Edition brings Nefeltari Vivi as its Leader, Uta, Tashigi, Vivi, Boa Hancock, Vinsmoke Reiju, Koala, Perona, Nami and Nico Robin among the Super Rares, Uta and Trafalgar Law as the Secret Rares, and nine Special cards of those Super Rare heroines in new art. 12 cards a pack: four Rares or better in every one, and a Leader, a Parallel art or a Special card in some.', 0, 0, 'op')
on conflict (set_code) do update set game = excluded.game;
