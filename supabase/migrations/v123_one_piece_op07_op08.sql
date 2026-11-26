-- The One Piece Card Game in the VVM, continued: 500 Years in the Future
-- (OP-07) and Two Legends (OP-08), 302 cards with their parallels (151 each),
-- one wrapper each. As v104: cards from the official English card list, art at
-- /cards/<set>-<number>.webp, a reprint from another set keeping its whole id
-- ('op07-109_p2', the Treasure Rare Luffy in OP-08), rarities C, U, R, H (SR),
-- S (SEC), L (Leader) and P (any Parallel: alternate art, Special card and
-- Treasure Rare). Packs open as the other One Piece main sets' do.
--
-- Not stocked: the packs are active so the sets show up in /admin/vvm, and
-- vending_set_info starts at 0 of 0 to keep them out of the machine until
-- someone sets a quantity there. Safe to re-run.

-- set|number|rarity|name, one card per line.
insert into public.vending_cards (set_code, number, name, rarity)
select parts[1], parts[2], parts[4], parts[3]::char(1)
  from (
    select string_to_array(btrim(line, E' \t\r'), '|') as parts
      from unnest(string_to_array($cards$
op07|001|L|Monkey.D.Dragon
op07|001_p1|P|Monkey.D.Dragon
op07|002|R|Ain
op07|003|R|Outlook III
op07|004|R|Curly.Dadan
op07|005|R|Carina
op07|005_p1|P|Carina
op07|006|C|Sterry
op07|007|C|Dice
op07|008|U|Mr. Tanaka
op07|009|C|Dogura & Magura
op07|010|R|Baccarat
op07|011|C|Bluejam
op07|012|C|Porchemy
op07|013|U|Masked Deuce
op07|014|U|Moda
op07|015|H|Monkey.D.Dragon
op07|015_p1|P|Monkey.D.Dragon
op07|016|R|Galaxy Wink
op07|017|U|Dragon Breath
op07|018|C|KEEP OUT
op07|019|L|Jewelry Bonney
op07|019_p1|P|Jewelry Bonney
op07|020|C|Aladine
op07|021|R|Urouge
op07|022|R|Otama
op07|022_p1|P|Otama
op07|023|U|Caribou
op07|024|C|Koala
op07|025|C|Coribou
op07|026|H|Jewelry Bonney
op07|026_p1|P|Jewelry Bonney
op07|027|C|Jinbe
op07|028|C|Scratchmen Apoo
op07|029|H|Basil Hawkins
op07|029_p1|P|Basil Hawkins
op07|030|C|Pappag
op07|031|U|Bartolomeo
op07|032|R|Fisher Tiger
op07|033|U|Monkey.D.Luffy
op07|034|U|Roronoa Zoro
op07|035|C|Karmic Punishment
op07|036|R|Demonic Aura Nine-Sword Style Asura Demon Nine Flash
op07|037|U|More Pizza!!
op07|038|L|Boa Hancock
op07|038_p1|P|Boa Hancock
op07|039|C|Edward Weevil
op07|040|U|Crocodile
op07|041|U|Gloriosa (Grandma Nyon)
op07|042|C|Gecko Moria
op07|043|U|Salome
op07|044|C|Dracule Mihawk
op07|045|H|Jinbe
op07|045_p1|P|Jinbe
op07|046|R|Sengoku
op07|046_p1|P|Sengoku
op07|047|R|Trafalgar Law
op07|047_p1|P|Trafalgar Law
op07|048|U|Donquixote Doflamingo
op07|049|C|Buckin
op07|050|C|Boa Sandersonia
op07|051|H|Boa Hancock
op07|051_p1|P|Boa Hancock
op07|051_p2|P|Boa Hancock
op07|052|C|Boa Marigold
op07|053|R|Portgas.D.Ace
op07|054|R|Marguerite
op07|055|C|Snake Dance
op07|056|U|Slave Arrow
op07|057|R|Perfume Femur
op07|058|C|Island of Women
op07|059|L|Foxy
op07|059_p1|P|Foxy
op07|060|U|Itomimizu
op07|061|C|Vinsmoke Sanji
op07|062|C|Vinsmoke Reiju
op07|063|C|Capote
op07|064|H|Sanji
op07|064_p1|P|Sanji
op07|065|U|Gina
op07|066|R|Tony Tony.Chopper
op07|067|C|Tonjit
op07|068|U|Hamburg
op07|069|C|Pickles
op07|070|U|Big Bun
op07|071|R|Foxy
op07|071_p1|P|Foxy
op07|072|H|Porche
op07|072_p1|P|Porche
op07|073|R|Monkey.D.Luffy
op07|074|C|Monda
op07|075|U|Slow-Slow Beam
op07|076|C|Slow-Slow Beam Sword
op07|077|R|We're Going to Claim the One Piece!!!
op07|078|C|Megaton Nine-Tails Rush
op07|079|L|Rob Lucci
op07|079_p1|P|Rob Lucci
op07|080|R|Kaku
op07|081|C|Kalifa
op07|082|U|Captain John
op07|083|U|Gecko Moria
op07|084|C|Gismonda
op07|085|H|Stussy
op07|085_p1|P|Stussy
op07|086|C|Spandam
op07|087|C|Baskerville
op07|088|U|Hattori
op07|089|C|Maha
op07|090|C|Morgans
op07|091|R|Monkey.D.Luffy
op07|092|U|Joseph
op07|093|R|Rob Lucci
op07|094|U|Shave
op07|095|C|Iron Body
op07|096|R|Tempest Kick
op07|097|L|Vegapunk
op07|097_p1|P|Vegapunk
op07|098|U|Atlas
op07|099|C|Usopp
op07|100|C|Edison
op07|101|U|Shaka
op07|102|C|Jinbe
op07|103|C|Tony Tony.Chopper
op07|104|U|Nico Robin
op07|105|U|Pythagoras
op07|106|C|Fuza
op07|107|R|Franky
op07|107_p1|P|Franky
op07|108|C|Vega Force 01
op07|109|H|Monkey.D.Luffy
op07|109_p1|P|Monkey.D.Luffy
op07|110|C|York
op07|111|H|Lilith
op07|111_p1|P|Lilith
op07|112|R|Lucy
op07|113|U|Roronoa Zoro
op07|114|U|He Possesses the World's Most Brilliant Mind
op07|115|C|I Re-Quasar Helllp!!
op07|116|R|Blaze Slice
op07|117|C|Egghead
op07|118|S|Sabo
op07|118_p1|P|Sabo
op07|119|S|Portgas.D.Ace
op07|119_p1|P|Portgas.D.Ace
op07|st10-010_p2|P|Trafalgar Law
op07|op01-035_p2|P|Okiku
op07|op01-073_p2|P|Donquixote Doflamingo
op07|op03-003_p1|P|Izo
op07|op03-078_p2|P|Issho
op07|op05-074_p3|P|Eustass"Captain"Kid
op07|op06-101_p2|P|O-Nami
op08|op07-109_p2|P|Monkey.D.Luffy
op08|001|L|Tony Tony.Chopper
op08|001_p1|P|Tony Tony.Chopper
op08|002|L|Marco
op08|002_p1|P|Marco
op08|003|C|Twenty Doctors
op08|004|C|Kuromarimo
op08|005|C|Chess
op08|006|U|Chessmarimo
op08|007|H|Tony Tony.Chopper
op08|007_p1|P|Tony Tony.Chopper
op08|008|R|Dalton
op08|009|C|Maria Onion Bear
op08|010|U|Hiking Bear
op08|011|C|Musshuru
op08|012|U|Lapins
op08|013|U|Robson
op08|014|R|Wapol
op08|015|R|Dr.Kureha
op08|015_p1|P|Dr.Kureha
op08|016|R|Dr.Hiriluk
op08|017|C|I'd Never Shoot You!!!!
op08|018|R|Cloven Rose
op08|019|U|Munch-Munch Mutation
op08|020|C|Drum Kingdom
op08|021|L|Carrot
op08|021_p1|P|Carrot
op08|022|U|Inuarashi
op08|023|H|Carrot
op08|023_p1|P|Carrot
op08|024|U|Concelot
op08|025|C|Shishilian
op08|026|C|Giovanni
op08|027|C|Tristan
op08|028|U|Nekomamushi
op08|029|C|Pekoms
op08|030|R|Pedro
op08|030_p1|P|Pedro
op08|031|C|Miyagi
op08|032|U|Milky
op08|033|C|Roddy
op08|034|R|Wanda
op08|035|C|BB
op08|036|R|Electrical Luna
op08|037|U|Garchu
op08|038|C|We Would Never Sell a Comrade to an Enemy!!!
op08|039|R|Zou
op08|040|U|Atmos
op08|041|C|Aphelandra
op08|042|U|Edward Weevil
op08|043|H|Edward.Newgate
op08|043_p1|P|Edward.Newgate
op08|044|U|Kingdew
op08|045|U|Thatch
op08|046|R|Shakuyaku
op08|047|R|Jozu
op08|048|C|Sweetpea
op08|049|C|Speed Jil
op08|050|C|Namule
op08|051|C|Buckin
op08|052|R|Portgas.D.Ace
op08|052_p1|P|Portgas.D.Ace
op08|053|R|Thank You...for Loving Me!!
op08|054|C|You Can't Take Our King This Early in the Game.
op08|055|U|Phoenix Brand
op08|056|C|Moby Dick
op08|057|L|King
op08|057_p1|P|King
op08|058|L|Charlotte Pudding
op08|058_p1|P|Charlotte Pudding
op08|059|U|Alber
op08|060|R|King
op08|061|U|Charlotte Oven
op08|062|U|Charlotte Katakuri
op08|063|R|Charlotte Katakuri
op08|064|C|Charlotte Cracker
op08|065|C|Charlotte Smoothie
op08|066|U|Charlotte Brulee
op08|067|R|Charlotte Pudding
op08|067_p1|P|Charlotte Pudding
op08|068|C|Charlotte Perospero
op08|069|H|Charlotte Linlin
op08|069_p1|P|Charlotte Linlin
op08|070|C|Baron Tamago
op08|071|C|Count Niwatori
op08|072|C|Biscuit Warrior
op08|073|C|Viscount Hiyoko
op08|074|H|Black Maria
op08|074_p1|P|Black Maria
op08|075|C|Candy Maiden
op08|076|U|It's to Die For...
op08|077|R|Conquest of the Sea
op08|078|C|Ulti
op08|079|H|Kaido
op08|079_p1|P|Kaido
op08|080|R|Queen
op08|080_p1|P|Queen
op08|081|C|Guernica
op08|082|R|Sasaki
op08|083|U|Sheepshead
op08|084|H|Jack
op08|084_p1|P|Jack
op08|085|U|Jinbe
op08|086|C|Ginrummy
op08|087|U|Scratchmen Apoo
op08|088|U|Duval
op08|089|C|Basil Hawkins
op08|090|C|Hamlet
op08|091|R|Who's.Who
op08|092|R|Page One
op08|093|C|X.Drake
op08|094|R|Imperial Flame
op08|095|U|Iron Body Fang Flash
op08|096|C|People's Dreams Don't Ever End!!
op08|097|C|Heliceratops
op08|098|L|Kalgara
op08|098_p1|P|Kalgara
op08|099|C|Kalgara
op08|100|U|South Bird
op08|101|C|Charlotte Angel
op08|102|U|Charlotte Opera
op08|103|U|Charlotte Custard
op08|104|C|Charlotte Poire
op08|105|H|Jewelry Bonney
op08|105_p1|P|Jewelry Bonney
op08|106|H|Nami
op08|106_p1|P|Nami
op08|107|C|Nitro
op08|108|C|Mont Blanc Cricket
op08|109|R|Mont Blanc Noland
op08|110|R|Wyper
op08|110_p1|P|Wyper
op08|111|U|S-Shark
op08|112|H|S-Snake
op08|112_p1|P|S-Snake
op08|113|C|S-Bear
op08|114|R|S-Hawk
op08|115|R|The Earth Will Not Lose!
op08|116|C|Burn Bazooka
op08|117|U|Burn Blade
op08|118|S|Silvers Rayleigh
op08|118_p1|P|Silvers Rayleigh
op08|118_p2|P|Silvers Rayleigh
op08|119|S|Kaido & Linlin
op08|119_p1|P|Kaido & Linlin
op08|op02-013_p3|P|Portgas.D.Ace
op08|op03-112_p4|P|Charlotte Pudding
op08|st02-007_p2|P|Jewelry Bonney
op08|st03-004_p1|P|Gecko Moria
op08|st04-005_p1|P|Queen
op08|st06-006_p2|P|Tashigi
$cards$, E'\n')) as line
     where btrim(line, E' \t\r') <> ''
  ) t
on conflict (set_code, number) do nothing;

insert into public.vending_packs (set_name, pack_name, image_url, sort_order, is_active, set_code)
values
  ('500 Years in the Future', 'OP-07', '/packs/one-piece-500-years-in-the-future.webp', 99,  true, 'op07'),
  ('Two Legends',             'OP-08', '/packs/one-piece-two-legends.webp',             100, true, 'op08')
on conflict (set_name, pack_name) do update
  set image_url = excluded.image_url, sort_order = excluded.sort_order, is_active = excluded.is_active, set_code = excluded.set_code;

insert into public.vending_set_info (set_code, description, total_quantity, claimed_quantity, game)
values
('op07', 'Egghead awaits.

500 Years in the Future brings Monkey.D.Dragon, Jewelry Bonney, Boa Hancock, Foxy, Rob Lucci and Vegapunk as Leaders, Luffy, Jinbe, Sanji and Lilith among the Super Rares, and Sabo and Ace as the Secret Rares. 12 cards a pack: a Rare or better in every one, and a Leader, a Parallel art or a Special card in some.', 0, 0, 'op'),
('op08', 'Two legends, one sea.

Two Legends brings Chopper, Marco, Carrot, King, Charlotte Pudding and Kalgara as Leaders, Whitebeard, Big Mom, Kaido and Nami among the Super Rares, and Silvers Rayleigh and Kaido & Linlin as the Secret Rares. 12 cards a pack: a Rare or better in every one, and a Leader, a Parallel art or a Special card in some.', 0, 0, 'op')
on conflict (set_code) do update set game = excluded.game;
