-- The One Piece Card Game's first two Extra Boosters: Memorial Collection
-- (EB-01, 80 cards with its parallels) and Anime 25th Collection (EB-02, 105:
-- its own 61 and 18 parallels, and 26 Special cards, the Leaders of EB-01 and
-- OP-05 to OP-08 again in anime art). As v104: cards from the official English
-- card list, art at /cards/<set>-<number>.webp, a reprint keeping its whole id
-- ('op05-001_p2' in EB-02), rarities C, R, H (SR), S (SEC), L (Leader) and P
-- (any Parallel, and the Special cards).
--
-- An Extra Booster has no Uncommons, so open_pack deals Rares in their place:
-- 7 Commons, 3 Rares, the Rare slot (SEC 1 in 40, SR 1 in 6, else a fourth
-- Rare) and the bonus slot, still 12 cards. A main set's pack is unchanged.
--
-- The game is 'op' (vending_set_info.game); the app reads eb codes as One Piece
-- too (lib/vending/games.ts), and so does the home feed (below), which calls a
-- One Piece pull a Super rare rather than a Holo rare.
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
eb01|001|L|Kouzuki Oden
eb01|001_p1|P|Kouzuki Oden
eb01|002|R|Izo
eb01|003|R|Kid & Killer
eb01|003_p1|P|Kid & Killer
eb01|004|C|Koza
eb01|005|C|Doma
eb01|006|H|Tony Tony.Chopper
eb01|006_p1|P|Tony Tony.Chopper
eb01|006_p2|P|Tony Tony.Chopper
eb01|007|C|Yamato
eb01|008|R|LittleOars Jr.
eb01|009|C|Just Shut Up and Come with Us!!!!
eb01|010|R|There's No Way You Could Defeat Me!!
eb01|011|C|Mini-Merry
eb01|012|H|Cavendish
eb01|012_p1|P|Cavendish
eb01|013|R|Kouzuki Hiyori
eb01|013_p1|P|Kouzuki Hiyori
eb01|014|R|Sanji
eb01|015|R|Scratchmen Apoo
eb01|016|C|Bingoh
eb01|017|C|Blueno
eb01|018|C|Mountain God
eb01|019|R|Off-White
eb01|020|C|Chambres
eb01|021|L|Hannyabal
eb01|021_p1|P|Hannyabal
eb01|022|H|Inazuma
eb01|022_p1|P|Inazuma
eb01|023|R|Edward Weevil
eb01|024|C|Hamlet
eb01|025|C|Fourtricks
eb01|026|C|Prince Bellett
eb01|027|R|Mr.1(Daz.Bonez)
eb01|027_p1|P|Mr.1(Daz.Bonez)
eb01|028|R|Gum-Gum Champion Rifle
eb01|029|C|Sorry. I'm a Goner.
eb01|030|C|Loguetown
eb01|031|R|Kalifa
eb01|031_p1|P|Kalifa
eb01|032|C|Army Wolves
eb01|033|R|Blueno
eb01|034|H|Ms. Wednesday
eb01|034_p1|P|Ms. Wednesday
eb01|035|C|Ms. Monday
eb01|036|C|Minochihuahua
eb01|037|C|Mr. 9
eb01|038|C|Oh Come My Way
eb01|039|R|Conquerer of Three Worlds Ragnaraku
eb01|040|L|Kyros
eb01|040_p1|P|Kyros
eb01|041|C|Crocus
eb01|042|R|Scarlet
eb01|043|R|Spandine
eb01|044|C|Funkfreed
eb01|045|C|Brook
eb01|046|H|Brook
eb01|046_p1|P|Brook
eb01|047|C|Laboon
eb01|048|H|Laboon
eb01|048_p1|P|Laboon
eb01|049|R|T-Bone
eb01|049_p1|P|T-Bone
eb01|050|C|...I Want to Live!!
eb01|051|R|Finger Pistol
eb01|052|H|Viola
eb01|052_p1|P|Viola
eb01|053|C|Gastino
eb01|054|R|Gan.Fall
eb01|055|C|Charlotte Compote
eb01|056|R|Charlotte Flampe
eb01|056_p1|P|Charlotte Flampe
eb01|057|H|Shirahoshi
eb01|057_p1|P|Shirahoshi
eb01|058|C|Mont Blanc Cricket
eb01|059|R|Kingdom Come
eb01|060|C|Did Someone Say...Kami?
eb01|061|S|Mr.2.Bon.Kurei(Bentham)
eb01|061_p1|P|Mr.2.Bon.Kurei(Bentham)
eb02|eb01-001_p2|P|Kouzuki Oden
eb02|eb01-021_p2|P|Hannyabal
eb02|eb01-040_p2|P|Kyros
eb02|001|C|Karoo
eb02|002|R|Sabo
eb02|003|R|Tony Tony.Chopper
eb02|003_p1|P|Tony Tony.Chopper
eb02|004|C|Don Accino
eb02|005|C|Fake Straw Hat Crew
eb02|006|H|Yamato
eb02|006_p1|P|Yamato
eb02|007|C|Cloven Rose Blizzard
eb02|008|R|The Peak
eb02|009|C|Thousand Sunny
eb02|010|L|Monkey.D.Luffy
eb02|010_p1|P|Monkey.D.Luffy
eb02|011|H|Arlong
eb02|011_p1|P|Arlong
eb02|012|C|Gaimon
eb02|013|C|Carrot
eb02|014|C|Sarfunkel
eb02|015|H|Jewelry Bonney
eb02|015_p1|P|Jewelry Bonney
eb02|016|C|Chopperman
eb02|017|R|Nami
eb02|017_p1|P|Nami
eb02|018|R|Buggy
eb02|019|R|Roronoa Zoro
eb02|020|R|We Are!
eb02|021|C|Gum-Gum Giant Pistol
eb02|022|R|Usopp
eb02|022_p1|P|Usopp
eb02|023|C|Crocodile
eb02|024|C|Sogeking
eb02|025|R|Donquixote Rosinante
eb02|026|H|Nefeltari Vivi
eb02|026_p1|P|Nefeltari Vivi
eb02|027|C|Vista
eb02|028|R|Portgas.D.Ace
eb02|029|C|Grandpa Ryu
eb02|030|C|And That's When Somebody Makes Fun of Their Friend's Dream!!!!
eb02|031|R|Hope
eb02|032|C|Iceburg
eb02|033|C|Klabautermann
eb02|034|C|Komei
eb02|035|H|Sanji & Pudding
eb02|035_p1|P|Sanji & Pudding
eb02|036|R|Nico Robin
eb02|036_p1|P|Nico Robin
eb02|037|R|Franky
eb02|038|C|Magellan
eb02|039|C|GERMA 66
eb02|040|R|BRAND NEW WORLD
eb02|041|R|Merry Go
eb02|042|C|All-Hunt Grount
eb02|043|C|Jonathan
eb02|044|H|Sengoku
eb02|044_p1|P|Sengoku
eb02|045|H|Trafalgar Law
eb02|045_p1|P|Trafalgar Law
eb02|046|C|Hildon
eb02|047|C|Blueno
eb02|048|R|Brook
eb02|048_p1|P|Brook
eb02|049|R|Monkey.D.Garp
eb02|050|R|Kokoro no Chizu
eb02|051|C|Three-Pace Hum Soul Notch Slash
eb02|052|H|Enel
eb02|052_p1|P|Enel
eb02|053|C|Myskina Olga
eb02|054|R|Sanji
eb02|054_p1|P|Sanji
eb02|055|R|Jinbe
eb02|056|H|Vegapunk
eb02|056_p1|P|Vegapunk
eb02|057|C|Mad Treasure
eb02|058|R|UUUUUS!
eb02|059|C|Without Your Help I Can't Become the King of the Pirates!!!!
eb02|060|C|Merry Go
eb02|061|S|Monkey.D.Luffy
eb02|061_p1|P|Monkey.D.Luffy
eb02|061_p2|P|Monkey.D.Luffy
eb02|op05-001_p2|P|Sabo
eb02|op05-002_p2|P|Belo Betty
eb02|op05-022_p2|P|Donquixote Rosinante
eb02|op05-060_p4|P|Monkey.D.Luffy
eb02|op05-098_p2|P|Enel
eb02|op06-001_p2|P|Uta
eb02|op06-020_p2|P|Hody Jones
eb02|op06-021_p2|P|Perona
eb02|op06-022_p2|P|Yamato
eb02|op06-042_p2|P|Vinsmoke Reiju
eb02|op06-080_p2|P|Gecko Moria
eb02|op07-001_p2|P|Monkey.D.Dragon
eb02|op07-019_p2|P|Jewelry Bonney
eb02|op07-038_p2|P|Boa Hancock
eb02|op07-059_p2|P|Foxy
eb02|op07-079_p2|P|Rob Lucci
eb02|op07-097_p2|P|Vegapunk
eb02|op08-001_p2|P|Tony Tony.Chopper
eb02|op08-002_p2|P|Marco
eb02|op08-021_p2|P|Carrot
eb02|op08-057_p2|P|King
eb02|op08-058_p2|P|Charlotte Pudding
eb02|op08-098_p2|P|Kalgara
$cards$, E'\n')) as line
     where btrim(line, E' \t\r') <> ''
  ) t
on conflict (set_code, number) do nothing;

insert into public.vending_packs (set_name, pack_name, image_url, sort_order, is_active, set_code)
values
  ('Memorial Collection',   'EB-01', '/packs/one-piece-memorial-collection.webp',   96, true, 'eb01'),
  ('Anime 25th Collection', 'EB-02', '/packs/one-piece-anime-25th-collection.webp', 97, true, 'eb02')
on conflict (set_name, pack_name) do update
  set image_url = excluded.image_url, sort_order = excluded.sort_order, is_active = excluded.is_active, set_code = excluded.set_code;

insert into public.vending_set_info (set_code, description, total_quantity, claimed_quantity, game)
values
('eb01', 'Old crews, new art.

Memorial Collection, the first Extra Booster, brings Kouzuki Oden, Hannyabal and Kyros as Leaders, Chopper, Cavendish, Brook, Laboon and Shirahoshi among the Super Rares, and Mr.2 Bon Kurei as the Secret Rare. 12 cards a pack: four Rares or better in every one, and a Leader or a Parallel art in some.', 0, 0, 'op'),
('eb02', 'Twenty-five years of the anime.

Anime 25th Collection brings Luffy as its Leader, Yamato, Arlong, Bonney, Vivi, Law, Enel and Vegapunk among the Super Rares, Luffy again as the Secret Rare, and 26 Special cards: Leaders from Sabo to Kalgara in scenes from the anime. 12 cards a pack: four Rares or better in every one, and a Leader, a Parallel art or a Special card in some.', 0, 0, 'op')
on conflict (set_code) do update set game = excluded.game;

-- open_pack as v106 left it, but a One Piece set with no Uncommons (an Extra
-- Booster) deals Rares in their place, never the same card twice: when the Rare
-- slot is a Rare too it's a fourth of them, the last turned over.
do $$
declare d text := pg_get_functiondef('public.open_pack(bigint)'::regprocedure);
  decl_a text := $q$v_bonus char(1); v_ex boolean;$q$;
  bonus_a text := $q$    v_bonus := case when random() < 1.0 / 12 then 'P' when random() < 0.25 then 'L' else 'C' end;
$q$;
  mid_a text := $q$      union all select id, 2 from (select c.id from public.vending_cards c where c.set_code = v_code and c.rarity = 'U' order by random() limit 3) b
      union all select id, 3 from (select c.id from public.vending_cards c where c.set_code = v_code and c.rarity = v_rare order by random() limit 1) d
$q$;
  note_a text := $q$  -- A One Piece pack: 7 Commons, 3 Uncommons, a Rare slot$q$;
begin
  if position('v_mid' in d) > 0 then return; end if;   -- already done
  if position(decl_a in d) = 0 or position(bonus_a in d) = 0 or position(mid_a in d) = 0 or position(note_a in d) = 0 then
    raise exception 'open_pack has changed: update v113 by hand';
  end if;
  d := replace(d, decl_a, $q$v_bonus char(1); v_ex boolean; v_mid char(1);$q$);
  d := replace(d, bonus_a, bonus_a || $q$    -- An Extra Booster has no Uncommons: Rares in their place (v113).
    v_mid := case when exists (select 1 from public.vending_cards u where u.set_code = v_code and u.rarity = 'U') then 'U' else 'R' end;
$q$);
  d := replace(d, mid_a, $q$      -- The Uncommons (or an Extra Booster's Rares); when the Rare slot is a Rare there too, it's a fourth, turned over last.
      union all select id, case when n > 3 then 3 else 2 end from (select x.id, row_number() over () as n from (select c.id from public.vending_cards c where c.set_code = v_code and c.rarity = v_mid order by random() limit case when v_rare = v_mid then 4 else 3 end) x) b
      union all select id, 3 from (select c.id from public.vending_cards c where c.set_code = v_code and c.rarity = v_rare and v_rare <> v_mid order by random() limit 1) d
$q$);
  d := replace(d, note_a, $q$  -- A One Piece pack: 7 Commons, 3 Uncommons (Rares in an Extra Booster), a Rare slot$q$);
  execute d;
end $$;

-- The home feed: an Extra Booster's pull is a One Piece one too (a Super rare, not a Holo rare).
do $$
declare d text := pg_get_functiondef('public.home_feed(timestamptz, integer)'::regprocedure);
  a text := $q$vc.set_code ~ '^op'$q$;
begin
  if position($q$'^(op|eb)$q$ in d) > 0 then return; end if;   -- already done
  if position(a in d) = 0 then raise exception 'home_feed has changed: update v113 by hand'; end if;
  d := replace(d, a, $q$vc.set_code ~ '^(op|eb)[0-9]'$q$);
  execute d;
end $$;
