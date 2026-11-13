-- The One Piece Card Game in the VVM, continued: Awakening of the New Era
-- (OP-05) and Wings of the Captain (OP-06), 305 cards with their parallels
-- (154 and 151), one wrapper each. As v96: cards from the official English card
-- list, art at /cards/<set>-<number>.webp, a reprint from another set keeping
-- its whole id ('op01-016_p4' in OP-05), rarities C, U, R, H (SR), S (SEC),
-- L (Leader) and P (any Parallel: alternate art, SP and Treasure Rare). Packs
-- open as v96's One Piece packs (open_pack reads vending_set_info.game).
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
op05|001|L|Sabo
op05|001_p1|P|Sabo
op05|002|L|Belo Betty
op05|002_p1|P|Belo Betty
op05|003|U|Inazuma
op05|004|U|Emporio.Ivankov
op05|005|R|Karasu
op05|006|H|Koala
op05|006_p1|P|Koala
op05|007|H|Sabo
op05|007_p1|P|Sabo
op05|008|U|Chaka
op05|009|C|Toh-Toh
op05|010|U|Nico Robin
op05|011|C|Bartholomew Kuma
op05|012|C|Hack
op05|013|C|Bunny Joe
op05|014|C|Pell
op05|015|R|Belo Betty
op05|015_p1|P|Belo Betty
op05|016|R|Morley
op05|017|R|Lindbergh
op05|018|C|Emporio Energy Hormone
op05|019|R|Fire Fist
op05|020|U|Four Thousand-Brick Fist
op05|021|U|Revolutionary Army HQ
op05|022|L|Donquixote Rosinante
op05|022_p1|P|Donquixote Rosinante
op05|023|R|Vergo
op05|024|C|Kuween
op05|025|C|Gladius
op05|026|C|Sarquiss
op05|027|U|Trafalgar Law
op05|028|C|Donquixote Doflamingo
op05|029|U|Donquixote Doflamingo
op05|030|R|Donquixote Rosinante
op05|031|C|Buffalo
op05|032|H|Pica
op05|032_p1|P|Pica
op05|033|C|Baby 5
op05|034|R|Baby 5
op05|034_p1|P|Baby 5
op05|035|C|Bellamy
op05|036|U|Monet
op05|037|R|Because the Side of Justice Will Be Whichever Side Wins!!
op05|038|C|Charlestone
op05|039|U|Stick-Stickem Meteora
op05|040|C|Birdcage
op05|041|L|Sakazuki
op05|041_p1|P|Sakazuki
op05|042|R|Issho
op05|043|H|Ulti
op05|043_p1|P|Ulti
op05|044|C|John Giant
op05|045|C|Stainless
op05|046|C|Dalmatian
op05|047|C|Basil Hawkins
op05|048|U|Bastille
op05|049|U|Haccha
op05|050|R|Hina
op05|051|H|Borsalino
op05|051_p1|P|Borsalino
op05|052|C|Maynard
op05|053|C|Mozambia
op05|054|U|Monkey.D.Garp
op05|055|R|X.Drake
op05|055_p1|P|X.Drake
op05|056|C|X.Barrels
op05|057|R|Hound Blaze
op05|058|C|It's a Waste of Human Life!!
op05|059|U|Let Us Begin the World of Violence!!!
op05|060|L|Monkey.D.Luffy
op05|060_p1|P|Monkey.D.Luffy
op05|061|U|Uso-Hachi
op05|062|U|O-Nami
op05|063|C|O-Robi
op05|064|R|Killer
op05|065|C|San-Gorou
op05|066|C|Jinbe
op05|067|R|Zoro-Juurou
op05|067_p1|P|Zoro-Juurou
op05|068|C|Chopa-Emon
op05|069|H|Trafalgar Law
op05|069_p1|P|Trafalgar Law
op05|069_p2|P|Trafalgar Law
op05|070|U|Fra-Nosuke
op05|071|R|Bepo
op05|072|C|Hone-Kichi
op05|073|U|Miss Doublefinger(Zala)
op05|074|H|Eustass"Captain"Kid
op05|074_p1|P|Eustass"Captain"Kid
op05|074_p2|P|Eustass"Captain"Kid
op05|075|C|Mr.1(Daz.Bonez)
op05|076|R|When You're at Sea You Fight against Pirates!!
op05|077|C|Gamma Knife
op05|078|U|Punk Rotten
op05|079|U|Viola
op05|080|U|Elizabello II
op05|081|U|One-Legged Toy Soldier
op05|082|R|Shirahoshi
op05|083|C|Sterry
op05|084|C|Saint Charlos
op05|085|U|Nefeltari Cobra
op05|086|R|Nefeltari Vivi
op05|087|C|Hakuba
op05|088|R|Mansherry
op05|088_p1|P|Mansherry
op05|089|C|Saint Mjosgard
op05|090|C|Riku Doldo III
op05|091|H|Rebecca
op05|091_p1|P|Rebecca
op05|092|C|Saint Rosward
op05|093|H|Rob Lucci
op05|093_p1|P|Rob Lucci
op05|094|R|Haute Couture Patch★Work
op05|095|C|Dragon Claw
op05|096|U|I Bid 500 Million!!
op05|097|C|Mary Geoise
op05|098|L|Enel
op05|098_p1|P|Enel
op05|099|U|Amazon
op05|100|H|Enel
op05|100_p1|P|Enel
op05|101|R|Ohm
op05|102|R|Gedatsu
op05|102_p1|P|Gedatsu
op05|103|U|Kotori
op05|104|U|Conis
op05|105|R|Satori
op05|106|R|Shura
op05|107|C|Lieutenant Spacey
op05|108|C|Nola
op05|109|C|Pagaya
op05|110|C|Holly
op05|111|U|Hotori
op05|112|C|Captain McKinley
op05|113|C|Yama
op05|114|U|El Thor
op05|115|R|Two-Hundred Million Volts Amaru
op05|116|C|Hino Bird Zap
op05|117|U|Upper Yard
op05|118|S|Kaido
op05|118_p1|P|Kaido
op05|119|S|Monkey.D.Luffy
op05|119_p1|P|Monkey.D.Luffy
op05|119_p2|P|Monkey.D.Luffy
op05|st01-012_p2|P|Monkey.D.Luffy
op05|st01-012_p3|P|Monkey.D.Luffy
op05|op01-016_p4|P|Nami
op05|op01-121_p2|P|Yamato
op05|op02-120_p2|P|Uta
op05|op03-092_p2|P|Rob Lucci
op05|op04-044_p2|P|Kaido
op05|100_p2|P|Enel
op06|001|L|Uta
op06|001_p1|P|Uta
op06|002|C|Inazuma
op06|003|U|Emporio.Ivankov
op06|004|C|Baron Omatsuri
op06|005|C|Gasparde
op06|006|U|Saga
op06|007|H|Shanks
op06|007_p1|P|Shanks
op06|008|C|Schneider
op06|009|H|Shuraiya
op06|009_p1|P|Shuraiya
op06|010|R|Douglas Bullet
op06|011|R|Tot Musica
op06|012|U|Bear.King
op06|013|R|Monkey.D.Luffy
op06|013_p1|P|Monkey.D.Luffy
op06|014|C|Ratchet
op06|015|C|Lily Carnation
op06|016|U|Raise Max
op06|017|C|Meteor-Strike of Love
op06|018|R|Gum-Gum King Kong Gatling
op06|019|U|Blue Dragon Seal Water Stream
op06|020|L|Hody Jones
op06|020_p1|P|Hody Jones
op06|021|L|Perona
op06|021_p1|P|Perona
op06|022|L|Yamato
op06|022_p1|P|Yamato
op06|023|R|Arlong
op06|024|U|Ikaros Much
op06|025|R|Camie
op06|025_p1|P|Camie
op06|026|C|Koushirou
op06|027|C|Gyro
op06|028|C|Zeo
op06|029|U|Daruma
op06|030|C|Dosun
op06|031|U|Hatchan
op06|032|C|Hammond
op06|033|R|Vander Decken IX
op06|034|U|Hyouzou
op06|035|H|Hody Jones
op06|035_p1|P|Hody Jones
op06|036|R|Ryuma
op06|037|C|Wadatsumi
op06|038|U|The Billion-fold World Trichiliocosm
op06|039|R|You Ain't Even Worth Killing Time!!
op06|040|C|Shark Arrows
op06|041|C|The Ark Noah
op06|042|L|Vinsmoke Reiju
op06|042_p1|P|Vinsmoke Reiju
op06|043|H|Aramaki
op06|043_p1|P|Aramaki
op06|044|U|Gion
op06|045|U|Kuzan
op06|046|U|Sakazuki
op06|047|R|Charlotte Pudding
op06|048|C|Zeff
op06|049|C|Sengoku
op06|050|R|Tashigi
op06|050_p1|P|Tashigi
op06|051|R|Tsuru
op06|052|C|Tokikake
op06|053|C|Jaguar.D.Saul
op06|054|U|Borsalino
op06|055|C|Monkey.D.Garp
op06|056|U|Ama no Murakumo Sword
op06|057|C|But I Will Never Doubt a Woman's Tears!!!!
op06|058|R|Gravity Blade Raging Tiger
op06|059|U|White Snake
op06|060|C|Vinsmoke Ichiji
op06|061|R|Vinsmoke Ichiji
op06|061_p1|P|Vinsmoke Ichiji
op06|062|H|Vinsmoke Judge
op06|062_p1|P|Vinsmoke Judge
op06|063|U|Vinsmoke Sora
op06|064|C|Vinsmoke Niji
op06|065|R|Vinsmoke Niji
op06|066|C|Vinsmoke Yonji
op06|067|R|Vinsmoke Yonji
op06|068|C|Vinsmoke Reiju
op06|069|H|Vinsmoke Reiju
op06|069_p1|P|Vinsmoke Reiju
op06|070|C|Eldoraggo
op06|071|U|Gild Tesoro
op06|072|C|Cosette
op06|073|U|Shiki
op06|074|R|Zephyr (Navy)
op06|075|C|Count Battler
op06|076|U|Hitokiri Kamazo
op06|077|R|Black Bug
op06|078|U|GERMA 66
op06|079|C|Kingdom of GERMA
op06|080|L|Gecko Moria
op06|080_p1|P|Gecko Moria
op06|081|R|Absalom
op06|081_p1|P|Absalom
op06|082|C|Inuppe
op06|083|U|Oars
op06|084|C|Jigoro of the Wind
op06|085|U|Kumacy
op06|086|H|Gecko Moria
op06|086_p1|P|Gecko Moria
op06|087|C|Cerberus
op06|088|U|Sai
op06|089|C|Taralan
op06|090|R|Dr. Hogback
op06|091|U|Victoria Cindry
op06|092|R|Brook
op06|093|H|Perona
op06|093_p1|P|Perona
op06|094|C|Lola
op06|095|U|Shadows Asgard
op06|096|C|...Nothing...at All!!!
op06|097|R|Negative Hollow
op06|098|C|Thriller Bark
op06|099|C|Aisa
op06|100|U|Inuarashi
op06|101|R|O-Nami
op06|101_p1|P|O-Nami
op06|102|C|Kamakiri
op06|103|C|Kawamatsu
op06|104|R|Kikunojo
op06|105|C|Genbo
op06|106|H|Kouzuki Hiyori
op06|106_p1|P|Kouzuki Hiyori
op06|107|H|Kouzuki Momonosuke
op06|107_p1|P|Kouzuki Momonosuke
op06|108|C|Tenguyama Hitetsu
op06|109|U|Denjiro
op06|110|U|Nekomamushi
op06|111|C|Braham
op06|112|C|Raizo
op06|113|C|Raki
op06|114|U|Wyper
op06|115|R|You're the One Who Should Disappear.
op06|116|R|Reject
op06|117|C|The Ark Maxim
op06|118|S|Roronoa Zoro
op06|118_p1|P|Roronoa Zoro
op06|118_p2|P|Roronoa Zoro
op06|119|S|Sanji
op06|119_p1|P|Sanji
op06|st01-007_p3|P|Nami
op06|op03-008_p1|P|Buggy
op06|op03-114_p2|P|Charlotte Linlin
op06|op04-024_p2|P|Sugar
op06|op04-064_p2|P|Ms. All Sunday
op06|op05-051_p2|P|Borsalino
op06|op05-091_p2|P|Rebecca
$cards$, E'\n')) as line
     where btrim(line, E' \t\r') <> ''
  ) t
on conflict (set_code, number) do nothing;

insert into public.vending_packs (set_name, pack_name, image_url, sort_order, is_active, set_code)
values
  ('Awakening of the New Era', 'OP-05', '/packs/one-piece-awakening-of-the-new-era.webp', 84, true, 'op05'),
  ('Wings of the Captain',     'OP-06', '/packs/one-piece-wings-of-the-captain.webp',     85, true, 'op06')
on conflict (set_name, pack_name) do update
  set image_url = excluded.image_url, sort_order = excluded.sort_order, is_active = excluded.is_active, set_code = excluded.set_code;

insert into public.vending_set_info (set_code, description, total_quantity, claimed_quantity, game)
values
('op05', 'A new era awakens.

Awakening of the New Era brings Sabo, Enel, Sakazuki and Gear 5 Luffy as Leaders, Borsalino, Law, Kid and Rob Lucci among the Super Rares, and Kaido and Luffy as the Secret Rares. 12 cards a pack: a Rare or better in every one, and a Leader or a Parallel art in some.', 0, 0, 'op'),
('op06', 'Captains take flight.

Wings of the Captain brings Uta, Yamato, Gecko Moria and Vinsmoke Reiju as Leaders, Shanks, Hody Jones and Perona among the Super Rares, and Zoro and Sanji as the Secret Rares. 12 cards a pack: a Rare or better in every one, and a Leader or a Parallel art in some.', 0, 0, 'op')
on conflict (set_code) do update set game = excluded.game;
