-- The One Piece Card Game in the VVM: Romance Dawn (OP-01), Paramount War
-- (OP-02), Pillars of Strength (OP-03) and Kingdoms of Intrigue (OP-04), 611
-- cards with their parallels, one wrapper each.
--
-- Cards: from the official English card list (en.onepiece-cardgame.com),
-- art at /cards/<set>-<number>.webp like every set (image_url is generated).
-- A card's number is its own set's number ('001'), a parallel's with its
-- suffix ('001_p1'), and an SP card reprinted from another set keeps its whole
-- id ('op01-016_p2' in OP-03).
--
-- Rarity letters, shared with Pokémon: C, U (UC) and R as they are, H for a
-- Super Rare (SR), S for a Secret Rare (SEC); and two new ones, L for a Leader
-- and P for a Parallel (an alternate art or an SP card).
--
-- A set's game: vending_set_info.game, 'pkm' or 'op'. The app also reads it
-- from the set code (op01...).
--
-- A One Piece pack (open_pack): 12 cards, no god packs. 7 Commons, 3
-- Uncommons, a Rare slot (a Secret Rare 1 in 40, a Super Rare 1 in 6, else a
-- Rare) and a bonus slot (a Parallel 1 in 12, a Leader 1 in 4, else a Common),
-- the two of them turned over last, the better one last of all.
--
-- The home feed calls One Piece pulls by their names (Super rare, Secret rare,
-- Parallel) and counts a Parallel as a pull worth posting.
--
-- Not stocked: the packs are active so the sets show up in /admin/vvm, and
-- vending_set_info starts at 0 of 0 to keep them out of the machine until
-- someone sets a quantity there. Safe to re-run.

alter table public.vending_cards drop constraint if exists vending_cards_rarity_check;
alter table public.vending_cards add constraint vending_cards_rarity_check
  check (rarity = any (array['C', 'U', 'R', 'H', 'S', 'L', 'P']::bpchar[]));

alter table public.vending_set_info add column if not exists game text not null default 'pkm'
  check (game in ('pkm', 'op'));

-- set|number|rarity|name, one card per line.
insert into public.vending_cards (set_code, number, name, rarity)
select parts[1], parts[2], parts[4], parts[3]::char(1)
  from (
    select string_to_array(btrim(line, E' \t\r'), '|') as parts
      from unnest(string_to_array($cards$
op01|001|L|Roronoa Zoro
op01|001_p1|P|Roronoa Zoro
op01|002|L|Trafalgar Law
op01|002_p1|P|Trafalgar Law
op01|003|L|Monkey.D.Luffy
op01|003_p1|P|Monkey.D.Luffy
op01|004|R|Usopp
op01|005|R|Uta
op01|006|U|Otama
op01|007|C|Caribou
op01|008|C|Cavendish
op01|008_p1|P|Cavendish
op01|009|C|Carrot
op01|010|C|Komachiyo
op01|011|U|Gordon
op01|012|C|Sai
op01|013|R|Sanji
op01|013_p1|P|Sanji
op01|014|U|Jinbe
op01|015|U|Tony Tony.Chopper
op01|016|R|Nami
op01|016_p1|P|Nami
op01|017|R|Nico Robin
op01|018|C|Hajrudin
op01|019|C|Bartolomeo
op01|020|C|Hyogoro
op01|021|U|Franky
op01|022|U|Brook
op01|023|C|Marco
op01|024|H|Monkey.D.Luffy
op01|024_p1|P|Monkey.D.Luffy
op01|025|H|Roronoa Zoro
op01|025_p1|P|Roronoa Zoro
op01|026|R|Gum-Gum Fire-Fist Pistol Red Hawk
op01|027|C|Round Table
op01|028|C|Green Star Rafflesia
op01|029|U|Radical Beam!!
op01|030|U|In Two Years!! At the Sabaody Archipelago!!
op01|031|L|Kouzuki Oden
op01|031_p1|P|Kouzuki Oden
op01|032|U|Ashura Doji
op01|033|U|Izo
op01|034|C|Inuarashi
op01|034_p1|P|Inuarashi
op01|035|R|Okiku
op01|036|C|Otsuru
op01|037|C|Kawamatsu
op01|038|C|Kanjuro
op01|039|U|Killer
op01|040|H|Kin'emon
op01|040_p1|P|Kin'emon
op01|041|R|Kouzuki Momonosuke
op01|042|U|Komurasaki
op01|043|C|Shinobu
op01|044|C|Shachi
op01|045|C|Jean Bart
op01|046|R|Denjiro
op01|047|H|Trafalgar Law
op01|047_p1|P|Trafalgar Law
op01|048|C|Nekomamushi
op01|048_p1|P|Nekomamushi
op01|049|R|Bepo
op01|050|C|Penguin
op01|051|H|Eustass"Captain"Kid
op01|051_p1|P|Eustass"Captain"Kid
op01|052|U|Raizo
op01|053|C|Wire
op01|054|R|X.Drake
op01|055|C|You Can Be My Samurai!!
op01|056|U|Demon Face
op01|057|U|Paradise Waterfall
op01|058|R|Punk Gibson
op01|059|C|BE-BENG!!
op01|060|L|Donquixote Doflamingo
op01|060_p1|P|Donquixote Doflamingo
op01|061|L|Kaido
op01|061_p1|P|Kaido
op01|062|L|Crocodile
op01|062_p1|P|Crocodile
op01|063|U|Arlong
op01|064|C|Alvida
op01|064_p1|P|Alvida
op01|065|C|Vergo
op01|066|C|Krieg
op01|067|H|Crocodile
op01|067_p1|P|Crocodile
op01|068|R|Gecko Moria
op01|069|R|Caesar Clown
op01|070|H|Dracule Mihawk
op01|070_p1|P|Dracule Mihawk
op01|071|R|Jinbe
op01|072|C|Smiley
op01|073|R|Donquixote Doflamingo
op01|073_p1|P|Donquixote Doflamingo
op01|074|R|Bartholomew Kuma
op01|075|C|Pacifista
op01|076|C|Bellamy
op01|077|U|Perona
op01|077_p1|P|Perona
op01|078|H|Boa Hancock
op01|078_p1|P|Boa Hancock
op01|079|R|Ms. All Sunday
op01|080|C|Miss Doublefinger(Zala)
op01|081|C|Mocha
op01|082|C|Monet
op01|083|U|Mr.1(Daz.Bonez)
op01|084|U|Mr.2.Bon.Kurei(Bentham)
op01|085|U|Mr.3(Galdino)
op01|086|R|Overheat
op01|087|C|Officer Agents
op01|088|U|Desert Spada
op01|089|C|Crescent Cutlass
op01|090|U|Baroque Works
op01|091|L|King
op01|091_p1|P|King
op01|092|C|Urashima
op01|093|R|Ulti
op01|093_p1|P|Ulti
op01|094|H|Kaido
op01|094_p1|P|Kaido
op01|095|U|Kyoshirou
op01|096|H|King
op01|096_p1|P|King
op01|097|R|Queen
op01|097_p1|P|Queen
op01|098|U|Kurozumi Orochi
op01|099|C|Kurozumi Semimaru
op01|100|C|Kurozumi Higurashi
op01|101|U|Sasaki
op01|102|R|Jack
op01|102_p1|P|Jack
op01|103|C|Scratchmen Apoo
op01|104|C|Speed
op01|105|C|Bao Huang
op01|106|U|Basil Hawkins
op01|107|C|Babanuki
op01|108|U|Hitokiri Kamazo
op01|109|U|Who's.Who
op01|109_p1|P|Who's.Who
op01|110|C|Fukurokuju
op01|111|R|Black Maria
op01|112|R|Page One
op01|113|C|Holedem
op01|114|R|X.Drake
op01|115|C|Elephant's Marchoo
op01|116|U|Artificial Devil Fruit SMILE
op01|117|C|Sheep's Horn
op01|118|U|Ulti-Mortar
op01|119|R|Thunder Bagua
op01|120|S|Shanks
op01|120_p1|P|Shanks
op01|120_p2|P|Shanks
op01|121|S|Yamato
op01|121_p1|P|Yamato
op02|001|L|Edward.Newgate
op02|001_p1|P|Edward.Newgate
op02|002|L|Monkey.D.Garp
op02|002_p1|P|Monkey.D.Garp
op02|003|C|Atmos
op02|004|H|Edward.Newgate
op02|004_p1|P|Edward.Newgate
op02|005|U|Curly.Dadan
op02|006|C|Kingdew
op02|007|C|Thatch
op02|008|R|Jozu
op02|009|U|Squard
op02|009_p1|P|Squard
op02|010|C|Dogura
op02|011|R|Vista
op02|012|C|Blenheim
op02|013|H|Portgas.D.Ace
op02|013_p1|P|Portgas.D.Ace
op02|013_p2|P|Portgas.D.Ace
op02|014|U|Whitey Bay
op02|015|U|Makino
op02|016|C|Magura
op02|017|R|Masked Deuce
op02|017_p1|P|Masked Deuce
op02|018|R|Marco
op02|018_p1|P|Marco
op02|019|U|Rakuyo
op02|020|C|LittleOars Jr.
op02|021|R|Seaquake
op02|022|U|Whitebeard Pirates
op02|023|C|You May Be a Fool...but I Still Love You
op02|024|C|Moby Dick
op02|025|L|Kin'emon
op02|025_p1|P|Kin'emon
op02|026|L|Sanji
op02|026_p1|P|Sanji
op02|027|U|Inuarashi
op02|028|C|Usopp
op02|029|R|Carrot
op02|030|H|Kouzuki Oden
op02|030_p1|P|Kouzuki Oden
op02|031|U|Kouzuki Toki
op02|031_p1|P|Kouzuki Toki
op02|032|U|Shishilian
op02|033|C|Jinbe
op02|034|U|Tony Tony.Chopper
op02|035|C|Trafalgar Law
op02|036|H|Nami
op02|036_p1|P|Nami
op02|037|U|Nico Robin
op02|038|C|Nekomamushi
op02|039|C|Franky
op02|040|R|Brook
op02|041|R|Monkey.D.Luffy
op02|041_p1|P|Monkey.D.Luffy
op02|042|R|Yamato
op02|043|C|Roronoa Zoro
op02|044|C|Wanda
op02|045|C|Three Sword Style Oni Giri
op02|046|U|Diable Jambe Venaison Shoot
op02|047|R|Paradise Totsuka
op02|048|C|Land of Wano
op02|049|L|Emporio.Ivankov
op02|049_p1|P|Emporio.Ivankov
op02|050|R|Inazuma
op02|051|H|Emporio.Ivankov
op02|051_p1|P|Emporio.Ivankov
op02|052|C|Cabaji
op02|053|C|Crocodile
op02|054|C|Gecko Moria
op02|055|C|Dracule Mihawk
op02|056|U|Donquixote Doflamingo
op02|057|U|Bartholomew Kuma
op02|058|R|Buggy
op02|058_p1|P|Buggy
op02|059|U|Boa Hancock
op02|059_p1|P|Boa Hancock
op02|060|C|Mohji
op02|061|U|Morley
op02|062|H|Monkey.D.Luffy
op02|062_p1|P|Monkey.D.Luffy
op02|063|U|Mr.1(Daz.Bonez)
op02|064|R|Mr.2.Bon.Kurei(Bentham)
op02|065|R|Mr.3(Galdino)
op02|066|C|Impel Down All Stars
op02|067|U|Arabesque Brick Fist
op02|068|R|Gum-Gum Rain
op02|069|C|DEATH WINK
op02|070|C|New Kama Land
op02|071|L|Magellan
op02|071_p1|P|Magellan
op02|072|L|Zephyr
op02|072_p1|P|Zephyr
op02|073|R|Little Sadi
op02|073_p1|P|Little Sadi
op02|074|C|Saldeath
op02|075|R|Shiki
op02|076|R|Shiryu
op02|077|C|Solitaire
op02|078|U|Daifugo
op02|079|U|Douglas Bullet
op02|080|C|Dobon
op02|081|C|Domino
op02|082|U|Byrnndi World
op02|083|R|Hannyabal
op02|084|C|Blugori
op02|085|H|Magellan
op02|085_p1|P|Magellan
op02|086|U|Minokoala
op02|086_p1|P|Minokoala
op02|087|U|Minotaur
op02|088|C|Sphinx
op02|089|R|Judgment of Hell
op02|090|U|Hydra
op02|091|C|Venom Road
op02|092|C|Impel Down
op02|093|L|Smoker
op02|093_p1|P|Smoker
op02|094|U|Isuka
op02|095|U|Onigumo
op02|096|H|Kuzan
op02|096_p1|P|Kuzan
op02|097|C|Komille
op02|098|R|Koby
op02|099|H|Sakazuki
op02|099_p1|P|Sakazuki
op02|100|C|Jango
op02|101|C|Strawberry
op02|102|R|Smoker
op02|103|R|Sengoku
op02|104|C|Sentomaru
op02|105|C|Tashigi
op02|105_p1|P|Tashigi
op02|106|U|Tsuru
op02|107|C|Doberman
op02|108|C|Donquixote Rosinante
op02|108_p1|P|Donquixote Rosinante
op02|109|C|Jaguar.D.Saul
op02|110|R|Hina
op02|111|C|Fullbody
op02|112|U|Bell-mère
op02|113|U|Helmeppo
op02|114|H|Borsalino
op02|114_p1|P|Borsalino
op02|115|R|Monkey.D.Garp
op02|115_p1|P|Monkey.D.Garp
op02|116|C|Yamakaji
op02|117|U|Ice Age
op02|118|C|Yasakani Sacred Jewel
op02|119|R|Meteor Volcano
op02|120|S|Uta
op02|120_p1|P|Uta
op02|121|S|Kuzan
op02|121_p1|P|Kuzan
op03|001|L|Portgas.D.Ace
op03|001_p1|P|Portgas.D.Ace
op03|002|U|Adio
op03|003|R|Izo
op03|004|C|Curiel
op03|005|U|Thatch
op03|006|C|Speed Jil
op03|007|C|Namule
op03|008|U|Buggy
op03|009|C|Haruta
op03|010|C|Fossa
op03|011|U|Blamenco
op03|012|R|Marshall.D.Teach
op03|013|H|Marco
op03|013_p1|P|Marco
op03|014|U|Monkey.D.Garp
op03|015|U|Lim
op03|016|R|Flame Emperor
op03|017|U|Cross Fire
op03|018|R|Fire Fist
op03|018_p1|P|Fire Fist
op03|019|C|Fiery Doll
op03|020|C|Striker
op03|021|L|Kuro
op03|021_p1|P|Kuro
op03|022|L|Arlong
op03|022_p1|P|Arlong
op03|023|C|Alvida
op03|024|R|Gin
op03|024_p1|P|Gin
op03|025|H|Krieg
op03|025_p1|P|Krieg
op03|026|U|Kuroobi
op03|027|C|Sham
op03|028|R|Jango
op03|029|U|Chew
op03|030|R|Nami
op03|031|C|Pearl
op03|032|C|Buggy
op03|033|U|Hatchan
op03|034|U|Buchi
op03|035|C|Momoo
op03|036|C|Out-of-the-Bag
op03|037|C|Tooth Attack
op03|038|R|Deathly Poison Gas Bomb MH5
op03|039|U|One, Two, Jango
op03|040|L|Nami
op03|040_p1|P|Nami
op03|041|H|Usopp
op03|041_p1|P|Usopp
op03|042|C|Usopp's Pirate Crew
op03|043|C|Gaimon
op03|044|R|Kaya
op03|045|U|Carne
op03|046|C|Genzo
op03|047|R|Zeff
op03|047_p1|P|Zeff
op03|048|U|Nojiko
op03|049|U|Patty
op03|050|U|Boodle
op03|051|R|Bell-mère
op03|052|C|Merry
op03|053|C|Yosaku & Johnny
op03|054|C|Usopp's Rubber Band of Doom!!!
op03|055|C|Gum-Gum Giant Gavel
op03|056|U|Sanji's Pilaf
op03|057|R|Three Thousand Worlds
op03|058|L|Iceburg
op03|058_p1|P|Iceburg
op03|059|U|Kaku
op03|060|U|Kalifa
op03|061|C|Kiwi & Mozu
op03|062|R|Kokoro
op03|063|U|Zambai
op03|064|C|Tilestone
op03|065|C|Chimney & Gonbe
op03|066|H|Paulie
op03|066_p1|P|Paulie
op03|067|U|Peepley Lulu
op03|068|C|Minozebra
op03|069|C|Minorhinoceros
op03|070|R|Monkey.D.Luffy
op03|071|R|Rob Lucci
op03|072|R|Gum-Gum Jet Gatling
op03|073|C|Hull Dismantler Slash
op03|074|U|Top Knot
op03|075|C|Galley-La Company
op03|076|L|Rob Lucci
op03|076_p1|P|Rob Lucci
op03|077|L|Charlotte Linlin
op03|077_p1|P|Charlotte Linlin
op03|078|H|Issho
op03|078_p1|P|Issho
op03|079|U|Vergo
op03|080|H|Kaku
op03|080_p1|P|Kaku
op03|081|R|Kalifa
op03|081_p1|P|Kalifa
op03|082|C|Kumadori
op03|083|C|Corgy
op03|084|C|Jerry
op03|085|C|Jabra
op03|086|R|Spandam
op03|086_p1|P|Spandam
op03|087|C|Nero
op03|088|U|Fukurou
op03|089|R|Brannew
op03|090|R|Blueno
op03|091|C|Helmeppo
op03|092|H|Rob Lucci
op03|092_p1|P|Rob Lucci
op03|093|U|Wanze
op03|094|U|Air Door
op03|095|C|Soap Sheep
op03|096|U|Tempest Kick Sky Slicer
op03|097|R|Six King Pistol
op03|098|C|Enies Lobby
op03|099|L|Charlotte Katakuri
op03|099_p1|P|Charlotte Katakuri
op03|100|C|Kingbaum
op03|101|C|Camie
op03|102|R|Sanji
op03|103|C|Bobbin the Disposer
op03|104|U|Shirley
op03|105|U|Charlotte Oven
op03|106|C|Charlotte Opera
op03|107|C|Charlotte Galette
op03|108|H|Charlotte Cracker
op03|108_p1|P|Charlotte Cracker
op03|109|C|Charlotte Chiffon
op03|110|R|Charlotte Smoothie
op03|111|C|Charlotte Praline
op03|112|R|Charlotte Pudding
op03|112_p1|P|Charlotte Pudding
op03|113|H|Charlotte Perospero
op03|113_p1|P|Charlotte Perospero
op03|114|H|Charlotte Linlin
op03|114_p1|P|Charlotte Linlin
op03|115|R|Streusen
op03|116|U|Shirahoshi
op03|117|U|Napoleon
op03|118|U|Ikoku Sovereignty
op03|119|R|Buzz Cut Mochi
op03|120|C|Tropical Torment
op03|121|C|Thunder Bolt
op03|122|S|Sogeking
op03|122_p1|P|Sogeking
op03|122_p2|P|Sogeking
op03|123|S|Charlotte Katakuri
op03|123_p1|P|Charlotte Katakuri
op03|op01-051_p2|P|Eustass"Captain"Kid
op03|st01-012_p1|P|Monkey.D.Luffy
op03|st03-009_p1|P|Donquixote Doflamingo
op03|st04-003_p1|P|Kaido
op04|001|L|Nefeltari Vivi
op04|001_p1|P|Nefeltari Vivi
op04|002|R|Igaram
op04|003|U|Usopp
op04|004|C|Karoo
op04|005|C|Kung Fu Jugon
op04|006|U|Koza
op04|007|C|Sanji
op04|008|R|Chaka
op04|009|U|Super Spot-Billed Duck Troops
op04|010|C|Tony Tony.Chopper
op04|011|C|Nami
op04|012|C|Nefeltari Cobra
op04|013|H|Pell
op04|013_p1|P|Pell
op04|014|U|Monkey.D.Luffy
op04|015|R|Roronoa Zoro
op04|016|R|Bad Manners Kick Course
op04|017|C|Happiness Punch
op04|018|U|Enchanting Vertigo Dance
op04|019|L|Donquixote Doflamingo
op04|019_p1|P|Donquixote Doflamingo
op04|020|L|Issho
op04|020_p1|P|Issho
op04|021|C|Viola
op04|022|U|Eric
op04|023|C|Kuro
op04|024|H|Sugar
op04|024_p1|P|Sugar
op04|025|C|Giolla
op04|026|R|Senor Pink
op04|027|C|Daddy Masterson
op04|028|R|Diamante
op04|028_p1|P|Diamante
op04|029|C|Dellinger
op04|030|R|Trebol
op04|030_p1|P|Trebol
op04|031|H|Donquixote Doflamingo
op04|031_p1|P|Donquixote Doflamingo
op04|032|U|Baby 5
op04|033|U|Machvise
op04|034|U|Lao.G
op04|035|R|Spiderweb
op04|036|C|Donquixote Family
op04|037|U|Flapping Thread
op04|038|C|The Weak Do Not Have the Right to Choose How They Die!!!
op04|039|L|Rebecca
op04|039_p1|P|Rebecca
op04|040|L|Queen
op04|040_p1|P|Queen
op04|041|C|Apis
op04|042|C|Ipponmatsu
op04|043|R|Ulti
op04|044|H|Kaido
op04|044_p1|P|Kaido
op04|045|R|King
op04|046|U|Queen
op04|047|C|Ice Oni
op04|048|U|Sasaki
op04|049|U|Jack
op04|050|C|Hanger
op04|051|R|Who's.Who
op04|051_p1|P|Who's.Who
op04|052|C|Black Maria
op04|053|U|Page One
op04|054|C|Rokki
op04|055|C|Plague Rounds
op04|056|R|Gum-Gum Red Roc
op04|057|U|Dragon Twister Demolition Breath
op04|058|L|Crocodile
op04|058_p1|P|Crocodile
op04|059|U|Iceburg
op04|060|H|Crocodile
op04|060_p1|P|Crocodile
op04|061|C|Tom
op04|062|C|Bananagator
op04|063|R|Franky
op04|064|H|Ms. All Sunday
op04|064_p1|P|Ms. All Sunday
op04|065|C|Miss.Goldenweek(Marianne)
op04|066|R|Miss.Valentine(Mikita)
op04|067|C|Miss.MerryChristmas(Drophy)
op04|068|C|Yokozuna
op04|069|U|Mr.2.Bon.Kurei(Bentham)
op04|070|U|Mr.3(Galdino)
op04|071|U|Mr.4(Babe)
op04|072|R|Mr.5(Gem)
op04|072_p1|P|Mr.5(Gem)
op04|073|C|Mr.13 & Ms.Friday
op04|074|R|Colors Trap
op04|075|U|Nez-Palm Cannon
op04|076|C|Weakness...Is an Unforgivable Sin.
op04|077|C|Ideo
op04|078|C|Oimo & Kashii
op04|079|C|Orlumbus
op04|080|U|Gyats
op04|081|R|Cavendish
op04|082|R|Kyros
op04|082_p1|P|Kyros
op04|083|H|Sabo
op04|083_p1|P|Sabo
op04|083_p2|P|Sabo
op04|084|C|Stussy
op04|085|U|Suleiman
op04|086|C|Chinjao
op04|087|C|Trafalgar Law
op04|088|U|Hajrudin
op04|089|R|Bartolomeo
op04|090|H|Monkey.D.Luffy
op04|090_p1|P|Monkey.D.Luffy
op04|091|U|Leo
op04|092|R|Rebecca
op04|093|U|Gum-Gum King Kong Gun
op04|094|R|Trueno Bastardo
op04|095|C|Barrier!!
op04|096|C|Corrida Coliseum
op04|097|C|Otama
op04|098|U|Toko
op04|099|R|Olin
op04|100|R|Capone"Gang"Bege
op04|100_p1|P|Capone"Gang"Bege
op04|101|C|Carmel
op04|102|R|Kin'emon
op04|103|U|Kouzuki Hiyori
op04|104|H|Sanji
op04|104_p1|P|Sanji
op04|105|R|Charlotte Amande
op04|106|C|Charlotte Bavarois
op04|107|C|Charlotte Perospero
op04|108|U|Charlotte Moscato
op04|109|C|Tonoyasu
op04|110|C|Pound
op04|111|U|Hera
op04|112|H|Yamato
op04|112_p1|P|Yamato
op04|113|C|Rabiyan
op04|114|C|Randolph
op04|115|C|Gun Modoki
op04|116|U|Diable Jambe Joue Shot
op04|117|R|Heavenly Fire
op04|118|S|Nefeltari Vivi
op04|118_p1|P|Nefeltari Vivi
op04|119|S|Donquixote Rosinante
op04|119_p1|P|Donquixote Rosinante
op04|op01-047_p2|P|Trafalgar Law
op04|op01-078_p2|P|Boa Hancock
op04|op02-004_p2|P|Edward.Newgate
op04|op02-085_p2|P|Magellan
op04|op02-099_p2|P|Sakazuki
$cards$, E'\n')) as line
     where btrim(line, E' \t\r') <> ''
  ) t
on conflict (set_code, number) do nothing;

insert into public.vending_packs (set_name, pack_name, image_url, sort_order, is_active, set_code)
values
  ('Romance Dawn',         'OP-01', '/packs/one-piece-romance-dawn.webp',         80, true, 'op01'),
  ('Paramount War',        'OP-02', '/packs/one-piece-paramount-war.webp',        81, true, 'op02'),
  ('Pillars of Strength',  'OP-03', '/packs/one-piece-pillars-of-strength.webp',  82, true, 'op03'),
  ('Kingdoms of Intrigue', 'OP-04', '/packs/one-piece-kingdoms-of-intrigue.webp', 83, true, 'op04')
on conflict (set_name, pack_name) do update
  set image_url = excluded.image_url, sort_order = excluded.sort_order, is_active = excluded.is_active, set_code = excluded.set_code;

insert into public.vending_set_info (set_code, description, total_quantity, claimed_quantity, game)
values
('op01', 'The One Piece Card Game begins.

Romance Dawn sets sail with Luffy, Zoro and Law as Leaders beside Kaido and Doflamingo, Mihawk and Boa Hancock among the Super Rares, and Shanks and Yamato as the Secret Rares. 12 cards a pack: a Rare or better in every one, and a Leader or a Parallel art in some.', 0, 0, 'op'),
('op02', 'War at Marineford.

Paramount War brings Whitebeard, Garp and Smoker as Leaders, Ace, Luffy and the Admirals among the Super Rares, and Uta and Kuzan as the Secret Rares. 12 cards a pack: a Rare or better in every one, and a Leader or a Parallel art in some.', 0, 0, 'op'),
('op03', 'The strongest of the crews.

Pillars of Strength brings Big Mom, Katakuri and Rob Lucci as Leaders, Marco and Fujitora among the Super Rares, and Katakuri and Sogeking as the Secret Rares. 12 cards a pack: a Rare or better in every one, and a Leader, a Parallel art or an SP card in some.', 0, 0, 'op'),
('op04', 'Dressrosa and Alabasta.

Kingdoms of Intrigue brings Doflamingo, Crocodile and Vivi as Leaders, Sabo and Yamato among the Super Rares, and Rosinante and Vivi as the Secret Rares. 12 cards a pack: a Rare or better in every one, and a Leader, a Parallel art or an SP card in some.', 0, 0, 'op')
on conflict (set_code) do update set game = excluded.game;

-- open_pack as v91 left it, with a One Piece branch (vending_set_info.game = 'op').
create or replace function public.open_pack(p_user_pack_id bigint)
 returns table(card_id bigint, name text, rarity character, number text, image_url text, slot integer, center_x smallint, center_y smallint, corners smallint, edges smallint, surface smallint, border_wear smallint, wear_seed integer, crease smallint, holes smallint, rips smallint)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare me uuid := auth.uid(); v_pack public.user_packs; v_code text; v_rare char(1); v_odds int; v_god boolean := false; v_size int; v_game text; v_bonus char(1);
begin
  select * into v_pack from public.user_packs where id = p_user_pack_id for update;
  if v_pack.id is null or v_pack.user_id <> me then raise exception 'That pack is not yours'; end if;
  if v_pack.market_listing_id is not null then raise exception 'That pack is listed for sale'; end if;
  if v_pack.opened_at is not null then raise exception 'That pack is already open'; end if;
  select p.set_code into v_code from public.vending_packs p where p.id = v_pack.pack_id;
  if v_code is null then raise exception 'That pack has no card pool'; end if;
  select si.pack_size, si.game into v_size, v_game from public.vending_set_info si where si.set_code = v_code;
  -- A One Piece pack: 7 Commons, 3 Uncommons, a Rare slot (SEC 1 in 40, SR 1 in 6, else R) and a bonus slot
  -- (a Parallel 1 in 12, a Leader 1 in 4, else a Common), those two turned over last, the better one last of all.
  if v_game = 'op' then
    v_rare := case when random() < 1.0 / 40 then 'S' when random() < 1.0 / 6 then 'H' else 'R' end;
    v_bonus := case when random() < 1.0 / 12 then 'P' when random() < 0.25 then 'L' else 'C' end;
    return query
    with picks as (
      -- A Common in the bonus slot is an eighth Common, so it's never one of the seven again.
      select id, 1 as grp from (select c.id from public.vending_cards c where c.set_code = v_code and c.rarity = 'C' order by random() limit case when v_bonus = 'C' then 8 else 7 end) a
      union all select id, 2 from (select c.id from public.vending_cards c where c.set_code = v_code and c.rarity = 'U' order by random() limit 3) b
      union all select id, 3 from (select c.id from public.vending_cards c where c.set_code = v_code and c.rarity = v_rare order by random() limit 1) d
      union all select id, 3 from (select c.id from public.vending_cards c where c.set_code = v_code and c.rarity = v_bonus and v_bonus <> 'C' order by random() limit 1) e),
    rolled as (select p.id, p.grp, r.center_x, r.center_y, r.corners, r.edges, r.surface, r.border_wear, r.wear_seed, r.crease, r.holes, r.rips
                 from picks p cross join lateral public.roll_card_condition(p.id) r),
    inserted as (insert into public.user_cards (user_id, card_id, user_pack_id, center_x, center_y, corners, edges, surface, border_wear, wear_seed, crease, holes, rips)
                 select me, x.id, p_user_pack_id, x.center_x, x.center_y, x.corners, x.edges, x.surface, x.border_wear, x.wear_seed, x.crease, x.holes, x.rips from rolled x
                 returning user_cards.card_id),
    marked as (update public.user_packs set opened_at = now() where id = p_user_pack_id returning 1)
    select c.id, c.name, c.rarity, c.number, c.image_url,
           row_number() over (order by x.grp, case when x.grp = 3 then position(c.rarity::text in 'CURLHPS') else 0 end, random())::int,
           x.center_x, x.center_y, x.corners, x.edges, x.surface, x.border_wear, x.wear_seed, x.crease, x.holes, x.rips
      from rolled x join public.vending_cards c on c.id = x.id
     where (select count(*) from inserted) > 0 and (select count(*) from marked) > 0;
    return;
  end if;
  -- A set with its own pack size: that many different cards from the whole set, no god packs.
  if v_size is not null then
    return query
    with picks as (select c.id, 3 as grp from public.vending_cards c where c.set_code = v_code order by random() limit v_size),
    rolled as (select p.id, p.grp, r.center_x, r.center_y, r.corners, r.edges, r.surface, r.border_wear, r.wear_seed, r.crease, r.holes, r.rips
                 from picks p cross join lateral public.roll_card_condition(p.id) r),
    inserted as (insert into public.user_cards (user_id, card_id, user_pack_id, center_x, center_y, corners, edges, surface, border_wear, wear_seed, crease, holes, rips)
                 select me, x.id, p_user_pack_id, x.center_x, x.center_y, x.corners, x.edges, x.surface, x.border_wear, x.wear_seed, x.crease, x.holes, x.rips from rolled x
                 returning user_cards.card_id),
    marked as (update public.user_packs set opened_at = now() where id = p_user_pack_id returning 1)
    select c.id, c.name, c.rarity, c.number, c.image_url, row_number() over (order by random())::int,
           x.center_x, x.center_y, x.corners, x.edges, x.surface, x.border_wear, x.wear_seed, x.crease, x.holes, x.rips
      from rolled x join public.vending_cards c on c.id = x.id
     where (select count(*) from inserted) > 0 and (select count(*) from marked) > 0;
    return;
  end if;
  select coalesce(s.god_pack_odds, 500) into v_odds from public.vending_settings s where s.id;
  if random() < 1.0 / greatest(v_odds, 1)
     and (select count(*) from public.vending_cards vc where vc.set_code = v_code and vc.rarity = 'H') >= 11 then
    v_god := true;
  end if;
  if v_god then
    update public.user_packs set god_pack = true where id = p_user_pack_id;
    return query
    with picks as (select c.id, 3 as grp from public.vending_cards c where c.set_code = v_code and c.rarity = 'H' order by random() limit 11),
    rolled as (select p.id, p.grp, r.center_x, r.center_y, r.corners, r.edges, r.surface, r.border_wear, r.wear_seed, r.crease, r.holes, r.rips
                 from picks p cross join lateral public.roll_god_condition(p.id) r),
    inserted as (insert into public.user_cards (user_id, card_id, user_pack_id, center_x, center_y, corners, edges, surface, border_wear, wear_seed, crease, holes, rips)
                 select me, x.id, p_user_pack_id, x.center_x, x.center_y, x.corners, x.edges, x.surface, x.border_wear, x.wear_seed, x.crease, x.holes, x.rips from rolled x
                 returning user_cards.card_id),
    marked as (update public.user_packs set opened_at = now() where id = p_user_pack_id returning 1)
    select c.id, c.name, c.rarity, c.number, c.image_url, row_number() over (order by random())::int,
           x.center_x, x.center_y, x.corners, x.edges, x.surface, x.border_wear, x.wear_seed, x.crease, x.holes, x.rips
      from rolled x join public.vending_cards c on c.id = x.id
     where (select count(*) from inserted) > 0 and (select count(*) from marked) > 0;
    return;
  end if;
  if random() < 0.02 and exists (select 1 from public.vending_cards vc where vc.set_code = v_code and vc.rarity = 'S') then v_rare := 'S';
  elsif random() < 0.3333 then v_rare := 'H';
  else v_rare := 'R';
  end if;
  return query
  with picks as (
    select id, 1 as grp from (select c.id from public.vending_cards c where c.set_code = v_code and c.rarity = 'C' order by random() limit 7) a
    union all select id, 2 from (select c.id from public.vending_cards c where c.set_code = v_code and c.rarity = 'U' order by random() limit 3) b
    union all select id, 3 from (select c.id from public.vending_cards c where c.set_code = v_code and c.rarity = v_rare order by random() limit 1) d),
  rolled as (select p.id, p.grp, r.center_x, r.center_y, r.corners, r.edges, r.surface, r.border_wear, r.wear_seed, r.crease, r.holes, r.rips
               from picks p cross join lateral public.roll_card_condition(p.id) r),
  inserted as (insert into public.user_cards (user_id, card_id, user_pack_id, center_x, center_y, corners, edges, surface, border_wear, wear_seed, crease, holes, rips)
               select me, x.id, p_user_pack_id, x.center_x, x.center_y, x.corners, x.edges, x.surface, x.border_wear, x.wear_seed, x.crease, x.holes, x.rips from rolled x
               returning user_cards.card_id),
  marked as (update public.user_packs set opened_at = now() where id = p_user_pack_id returning 1)
  select c.id, c.name, c.rarity, c.number, c.image_url, row_number() over (order by x.grp, random())::int,
         x.center_x, x.center_y, x.corners, x.edges, x.surface, x.border_wear, x.wear_seed, x.crease, x.holes, x.rips
    from rolled x join public.vending_cards c on c.id = x.id
   where (select count(*) from inserted) > 0 and (select count(*) from marked) > 0;
end $function$;

-- The home feed: One Piece pulls by their own names, and a Parallel counts as a pull worth posting.
do $$
declare d text := pg_get_functiondef('public.home_feed(timestamptz, integer)'::regprocedure);
  a text := $q$case vc.rarity when 'S' then 'Secret rare' else 'Holo rare' end$q$;
  b text := $q$where vc.rarity in ('H', 'S') and not up.god_pack$q$;
begin
  if position('Parallel' in d) > 0 then return; end if;   -- already done
  if position(a in d) = 0 or position(b in d) = 0 then raise exception 'home_feed has changed: update v96 by hand'; end if;
  d := replace(d, a, $q$case when vc.rarity = 'S' then 'Secret rare' when vc.rarity = 'P' then 'Parallel' when vc.set_code ~ '^op' then 'Super rare' else 'Holo rare' end$q$);
  d := replace(d, b, $q$where vc.rarity in ('H', 'S', 'P') and not up.god_pack$q$);
  execute d;
end $$;
