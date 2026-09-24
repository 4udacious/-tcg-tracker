-- Virtual vending machine, phase 4: card catalog, pack opening, collection.
--
-- Pack contents follow the real 1999 ratio: 11 cards made up of 7 commons,
-- 3 uncommons and one rare slot, where the rare is holo roughly one time in
-- three. Team Rocket's Dark Raichu is a secret rare and sits behind a much
-- longer shot, which is what it was.
--
-- Opening is a single SECURITY DEFINER function that locks the pack row, so
-- a double-tap or two tabs cannot open the same pack twice and mint duplicate
-- cards. The pack's `opened_at` is both the record and the guard.
--
-- Cards are picked without replacement within a pack (one query per rarity
-- with `order by random() limit n`), so a pack never contains the same card
-- twice - matching how real packs collated.

-- ----------------------------------------------------------------- catalog

create table if not exists public.vending_cards (
  id        bigint generated always as identity primary key,
  set_code  text not null,
  number    text not null,
  name      text not null,
  -- C common, U uncommon, R rare, H rare holo, S secret rare
  rarity    char(1) not null check (rarity in ('C','U','R','H','S')),
  image_url text generated always as ('/cards/' || set_code || '-' || number || '.webp') stored,
  unique (set_code, number)
);

-- Which card pool a pack draws from.
alter table public.vending_packs add column if not exists set_code text;

update public.vending_packs
   set set_code = case set_name
                    when 'Base Set'    then 'base1'
                    when 'Jungle'      then 'base2'
                    when 'Fossil'      then 'base3'
                    when 'Team Rocket' then 'base5'
                  end
 where set_code is null;

-- ------------------------------------------------------------ owned cards

create table if not exists public.user_cards (
  id           bigint generated always as identity primary key,
  user_id      uuid   not null references public.profiles(id) on delete cascade,
  card_id      bigint not null references public.vending_cards(id),
  user_pack_id bigint references public.user_packs(id) on delete set null,
  acquired_at  timestamptz not null default now()
);

create index if not exists user_cards_user_idx on public.user_cards (user_id, acquired_at desc);

-- ---------------------------------------------------------------- opening

create or replace function public.open_pack(p_user_pack_id bigint)
returns table (card_id bigint, name text, rarity char(1), number text, image_url text, slot int)
language plpgsql security definer set search_path to 'public' as $$
declare
  me       uuid := auth.uid();
  v_pack   public.user_packs;
  v_code   text;
  v_rare   char(1);
begin
  -- Locking the row is what makes a double-tap safe: the second call waits,
  -- then sees opened_at already set.
  select * into v_pack from public.user_packs where id = p_user_pack_id for update;

  if v_pack.id is null or v_pack.user_id <> me then
    raise exception 'That pack is not yours';
  end if;
  if v_pack.opened_at is not null then
    raise exception 'That pack is already open';
  end if;

  select p.set_code into v_code from public.vending_packs p where p.id = v_pack.pack_id;
  if v_code is null then
    raise exception 'That pack has no card pool';
  end if;

  -- The rare slot. Secret rares are a long shot; holos about one in three.
  if random() < 0.02
     -- Qualified: an unaliased `rarity` here collides with this function's
     -- OUT parameter of the same name.
     and exists (select 1 from public.vending_cards vc
                  where vc.set_code = v_code and vc.rarity = 'S') then
    v_rare := 'S';
  elsif random() < 0.3333 then
    v_rare := 'H';
  else
    v_rare := 'R';
  end if;

  return query
  with picks as (
    select id, 1 as grp from (
      select c.id from public.vending_cards c
       where c.set_code = v_code and c.rarity = 'C' order by random() limit 7) a
    union all
    select id, 2 from (
      select c.id from public.vending_cards c
       where c.set_code = v_code and c.rarity = 'U' order by random() limit 3) b
    union all
    select id, 3 from (
      select c.id from public.vending_cards c
       where c.set_code = v_code and c.rarity = v_rare order by random() limit 1) d
  ),
  inserted as (
    insert into public.user_cards (user_id, card_id, user_pack_id)
    select me, p.id, p_user_pack_id from picks p
    returning card_id
  ),
  marked as (
    update public.user_packs set opened_at = now() where id = p_user_pack_id returning 1
  )
  select c.id, c.name, c.rarity, c.number, c.image_url,
         -- Reveal order: commons first, the rare last.
         row_number() over (order by p.grp, random())::int
    from picks p
    join public.vending_cards c on c.id = p.id
   where (select count(*) from inserted) > 0
     and (select count(*) from marked) > 0;
end $$;

-- ------------------------------------------------------------- collection

-- security_invoker so the caller's RLS applies and nobody can read another
-- member's collection through the view.
create or replace view public.v_user_collection
with (security_invoker = true) as
  select uc.user_id,
         c.id as card_id,
         c.set_code,
         c.number,
         c.name,
         c.rarity,
         c.image_url,
         count(*)::int as copies,
         min(uc.acquired_at) as first_acquired
    from public.user_cards uc
    join public.vending_cards c on c.id = uc.card_id
   group by uc.user_id, c.id, c.set_code, c.number, c.name, c.rarity, c.image_url;

-- ------------------------------------------------------------------- RLS

alter table public.vending_cards enable row level security;
alter table public.user_cards    enable row level security;

drop policy if exists vending_cards_read on public.vending_cards;
create policy vending_cards_read on public.vending_cards
  for select using (auth.uid() is not null);

drop policy if exists user_cards_read_own on public.user_cards;
create policy user_cards_read_own on public.user_cards
  for select using (user_id = auth.uid() or public.is_mod());

grant select on public.v_user_collection to authenticated;

-- ---------------------------------------------------------------- seed
-- 311 cards across the four WOTC sets. Rarities are explicit rather than
-- derived from card number: Base Set trainers break that pattern (70-79 are
-- rare, 80-90 uncommon), so a range rule would mis-rank them.

insert into public.vending_cards (set_code, number, name, rarity) values
  ('base1','1','Alakazam','H'),
  ('base1','2','Blastoise','H'),
  ('base1','3','Chansey','H'),
  ('base1','4','Charizard','H'),
  ('base1','5','Clefairy','H'),
  ('base1','6','Gyarados','H'),
  ('base1','7','Hitmonchan','H'),
  ('base1','8','Machamp','H'),
  ('base1','9','Magneton','H'),
  ('base1','10','Mewtwo','H'),
  ('base1','11','Nidoking','H'),
  ('base1','12','Ninetales','H'),
  ('base1','13','Poliwrath','H'),
  ('base1','14','Raichu','H'),
  ('base1','15','Venusaur','H'),
  ('base1','16','Zapdos','H'),
  ('base1','17','Beedrill','R'),
  ('base1','18','Dragonair','R'),
  ('base1','19','Dugtrio','R'),
  ('base1','20','Electabuzz','R'),
  ('base1','21','Electrode','R'),
  ('base1','22','Pidgeotto','R'),
  ('base1','23','Arcanine','U'),
  ('base1','24','Charmeleon','U'),
  ('base1','25','Dewgong','U'),
  ('base1','26','Dratini','U'),
  ('base1','27','Farfetch''d','U'),
  ('base1','28','Growlithe','U'),
  ('base1','29','Haunter','U'),
  ('base1','30','Ivysaur','U'),
  ('base1','31','Jynx','U'),
  ('base1','32','Kadabra','U'),
  ('base1','33','Kakuna','U'),
  ('base1','34','Machoke','U'),
  ('base1','35','Magikarp','U'),
  ('base1','36','Magmar','U'),
  ('base1','37','Nidorino','U'),
  ('base1','38','Poliwhirl','U'),
  ('base1','39','Porygon','U'),
  ('base1','40','Raticate','U'),
  ('base1','41','Seel','U'),
  ('base1','42','Wartortle','U'),
  ('base1','43','Abra','C'),
  ('base1','44','Bulbasaur','C'),
  ('base1','45','Caterpie','C'),
  ('base1','46','Charmander','C'),
  ('base1','47','Diglett','C'),
  ('base1','48','Doduo','C'),
  ('base1','49','Drowzee','C'),
  ('base1','50','Gastly','C'),
  ('base1','51','Koffing','C'),
  ('base1','52','Machop','C'),
  ('base1','53','Magnemite','C'),
  ('base1','54','Metapod','C'),
  ('base1','55','Nidoran ♂','C'),
  ('base1','56','Onix','C'),
  ('base1','57','Pidgey','C'),
  ('base1','58','Pikachu','C'),
  ('base1','59','Poliwag','C'),
  ('base1','60','Ponyta','C'),
  ('base1','61','Rattata','C'),
  ('base1','62','Sandshrew','C'),
  ('base1','63','Squirtle','C'),
  ('base1','64','Starmie','C'),
  ('base1','65','Staryu','C'),
  ('base1','66','Tangela','C'),
  ('base1','67','Voltorb','C'),
  ('base1','68','Vulpix','C'),
  ('base1','69','Weedle','C'),
  ('base1','70','Clefairy Doll','R'),
  ('base1','71','Computer Search','R'),
  ('base1','72','Devolution Spray','R'),
  ('base1','73','Impostor Professor Oak','R'),
  ('base1','74','Item Finder','R'),
  ('base1','75','Lass','R'),
  ('base1','76','Pokémon Breeder','R'),
  ('base1','77','Pokémon Trader','R'),
  ('base1','78','Scoop Up','R'),
  ('base1','79','Super Energy Removal','R'),
  ('base1','80','Defender','U'),
  ('base1','81','Energy Retrieval','U'),
  ('base1','82','Full Heal','U'),
  ('base1','83','Maintenance','U'),
  ('base1','84','PlusPower','U'),
  ('base1','85','Pokémon Center','U'),
  ('base1','86','Pokémon Flute','U'),
  ('base1','87','Pokédex','U'),
  ('base1','88','Professor Oak','U'),
  ('base1','89','Revive','U'),
  ('base1','90','Super Potion','U'),
  ('base1','91','Bill','C'),
  ('base1','92','Energy Removal','C'),
  ('base1','93','Gust of Wind','C'),
  ('base1','94','Potion','C'),
  ('base1','95','Switch','C'),
  ('base1','96','Double Colorless Energy','U'),
  ('base1','97','Fighting Energy','C'),
  ('base1','98','Fire Energy','C'),
  ('base1','99','Grass Energy','C'),
  ('base1','100','Lightning Energy','C'),
  ('base1','101','Psychic Energy','C'),
  ('base1','102','Water Energy','C'),
  ('base2','1','Clefable','H'),
  ('base2','2','Electrode','H'),
  ('base2','3','Flareon','H'),
  ('base2','4','Jolteon','H'),
  ('base2','5','Kangaskhan','H'),
  ('base2','6','Mr. Mime','H'),
  ('base2','7','Nidoqueen','H'),
  ('base2','8','Pidgeot','H'),
  ('base2','9','Pinsir','H'),
  ('base2','10','Scyther','H'),
  ('base2','11','Snorlax','H'),
  ('base2','12','Vaporeon','H'),
  ('base2','13','Venomoth','H'),
  ('base2','14','Victreebel','H'),
  ('base2','15','Vileplume','H'),
  ('base2','16','Wigglytuff','H'),
  ('base2','17','Clefable','R'),
  ('base2','18','Electrode','R'),
  ('base2','19','Flareon','R'),
  ('base2','20','Jolteon','R'),
  ('base2','21','Kangaskhan','R'),
  ('base2','22','Mr. Mime','R'),
  ('base2','23','Nidoqueen','R'),
  ('base2','24','Pidgeot','R'),
  ('base2','25','Pinsir','R'),
  ('base2','26','Scyther','R'),
  ('base2','27','Snorlax','R'),
  ('base2','28','Vaporeon','R'),
  ('base2','29','Venomoth','R'),
  ('base2','30','Victreebel','R'),
  ('base2','31','Vileplume','R'),
  ('base2','32','Wigglytuff','R'),
  ('base2','33','Butterfree','U'),
  ('base2','34','Dodrio','U'),
  ('base2','35','Exeggutor','U'),
  ('base2','36','Fearow','U'),
  ('base2','37','Gloom','U'),
  ('base2','38','Lickitung','U'),
  ('base2','39','Marowak','U'),
  ('base2','40','Nidorina','U'),
  ('base2','41','Parasect','U'),
  ('base2','42','Persian','U'),
  ('base2','43','Primeape','U'),
  ('base2','44','Rapidash','U'),
  ('base2','45','Rhydon','U'),
  ('base2','46','Seaking','U'),
  ('base2','47','Tauros','U'),
  ('base2','48','Weepinbell','U'),
  ('base2','49','Bellsprout','C'),
  ('base2','50','Cubone','C'),
  ('base2','51','Eevee','C'),
  ('base2','52','Exeggcute','C'),
  ('base2','53','Goldeen','C'),
  ('base2','54','Jigglypuff','C'),
  ('base2','55','Mankey','C'),
  ('base2','56','Meowth','C'),
  ('base2','57','Nidoran ♀','C'),
  ('base2','58','Oddish','C'),
  ('base2','59','Paras','C'),
  ('base2','60','Pikachu','C'),
  ('base2','61','Rhyhorn','C'),
  ('base2','62','Spearow','C'),
  ('base2','63','Venonat','C'),
  ('base2','64','Poké Ball','C'),
  ('base3','1','Aerodactyl','H'),
  ('base3','2','Articuno','H'),
  ('base3','3','Ditto','H'),
  ('base3','4','Dragonite','H'),
  ('base3','5','Gengar','H'),
  ('base3','6','Haunter','H'),
  ('base3','7','Hitmonlee','H'),
  ('base3','8','Hypno','H'),
  ('base3','9','Kabutops','H'),
  ('base3','10','Lapras','H'),
  ('base3','11','Magneton','H'),
  ('base3','12','Moltres','H'),
  ('base3','13','Muk','H'),
  ('base3','14','Raichu','H'),
  ('base3','15','Zapdos','H'),
  ('base3','16','Aerodactyl','R'),
  ('base3','17','Articuno','R'),
  ('base3','18','Ditto','R'),
  ('base3','19','Dragonite','R'),
  ('base3','20','Gengar','R'),
  ('base3','21','Haunter','R'),
  ('base3','22','Hitmonlee','R'),
  ('base3','23','Hypno','R'),
  ('base3','24','Kabutops','R'),
  ('base3','25','Lapras','R'),
  ('base3','26','Magneton','R'),
  ('base3','27','Moltres','R'),
  ('base3','28','Muk','R'),
  ('base3','29','Raichu','R'),
  ('base3','30','Zapdos','R'),
  ('base3','31','Arbok','U'),
  ('base3','32','Cloyster','U'),
  ('base3','33','Gastly','U'),
  ('base3','34','Golbat','U'),
  ('base3','35','Golduck','U'),
  ('base3','36','Golem','U'),
  ('base3','37','Graveler','U'),
  ('base3','38','Kingler','U'),
  ('base3','39','Magmar','U'),
  ('base3','40','Omastar','U'),
  ('base3','41','Sandslash','U'),
  ('base3','42','Seadra','U'),
  ('base3','43','Slowbro','U'),
  ('base3','44','Tentacruel','U'),
  ('base3','45','Weezing','U'),
  ('base3','46','Ekans','C'),
  ('base3','47','Geodude','C'),
  ('base3','48','Grimer','C'),
  ('base3','49','Horsea','C'),
  ('base3','50','Kabuto','C'),
  ('base3','51','Krabby','C'),
  ('base3','52','Omanyte','C'),
  ('base3','53','Psyduck','C'),
  ('base3','54','Shellder','C'),
  ('base3','55','Slowpoke','C'),
  ('base3','56','Tentacool','C'),
  ('base3','57','Zubat','C'),
  ('base3','58','Mr. Fuji','U'),
  ('base3','59','Energy Search','C'),
  ('base3','60','Gambler','C'),
  ('base3','61','Recycle','C'),
  ('base3','62','Mysterious Fossil','C'),
  ('base5','1','Dark Alakazam','H'),
  ('base5','2','Dark Arbok','H'),
  ('base5','3','Dark Blastoise','H'),
  ('base5','4','Dark Charizard','H'),
  ('base5','5','Dark Dragonite','H'),
  ('base5','6','Dark Dugtrio','H'),
  ('base5','7','Dark Golbat','H'),
  ('base5','8','Dark Gyarados','H'),
  ('base5','9','Dark Hypno','H'),
  ('base5','10','Dark Machamp','H'),
  ('base5','11','Dark Magneton','H'),
  ('base5','12','Dark Slowbro','H'),
  ('base5','13','Dark Vileplume','H'),
  ('base5','14','Dark Weezing','H'),
  ('base5','15','Here Comes Team Rocket!','H'),
  ('base5','16','Rocket''s Sneak Attack','H'),
  ('base5','17','Rainbow Energy','H'),
  ('base5','18','Dark Alakazam','R'),
  ('base5','19','Dark Arbok','R'),
  ('base5','20','Dark Blastoise','R'),
  ('base5','21','Dark Charizard','R'),
  ('base5','22','Dark Dragonite','R'),
  ('base5','23','Dark Dugtrio','R'),
  ('base5','24','Dark Golbat','R'),
  ('base5','25','Dark Gyarados','R'),
  ('base5','26','Dark Hypno','R'),
  ('base5','27','Dark Machamp','R'),
  ('base5','28','Dark Magneton','R'),
  ('base5','29','Dark Slowbro','R'),
  ('base5','30','Dark Vileplume','R'),
  ('base5','31','Dark Weezing','R'),
  ('base5','32','Dark Charmeleon','U'),
  ('base5','33','Dark Dragonair','U'),
  ('base5','34','Dark Electrode','U'),
  ('base5','35','Dark Flareon','U'),
  ('base5','36','Dark Gloom','U'),
  ('base5','37','Dark Golduck','U'),
  ('base5','38','Dark Jolteon','U'),
  ('base5','39','Dark Kadabra','U'),
  ('base5','40','Dark Machoke','U'),
  ('base5','41','Dark Muk','U'),
  ('base5','42','Dark Persian','U'),
  ('base5','43','Dark Primeape','U'),
  ('base5','44','Dark Rapidash','U'),
  ('base5','45','Dark Vaporeon','U'),
  ('base5','46','Dark Wartortle','U'),
  ('base5','47','Magikarp','U'),
  ('base5','48','Porygon','U'),
  ('base5','49','Abra','C'),
  ('base5','50','Charmander','C'),
  ('base5','51','Dark Raticate','C'),
  ('base5','52','Diglett','C'),
  ('base5','53','Dratini','C'),
  ('base5','54','Drowzee','C'),
  ('base5','55','Eevee','C'),
  ('base5','56','Ekans','C'),
  ('base5','57','Grimer','C'),
  ('base5','58','Koffing','C'),
  ('base5','59','Machop','C'),
  ('base5','60','Magnemite','C'),
  ('base5','61','Mankey','C'),
  ('base5','62','Meowth','C'),
  ('base5','63','Oddish','C'),
  ('base5','64','Ponyta','C'),
  ('base5','65','Psyduck','C'),
  ('base5','66','Rattata','C'),
  ('base5','67','Slowpoke','C'),
  ('base5','68','Squirtle','C'),
  ('base5','69','Voltorb','C'),
  ('base5','70','Zubat','C'),
  ('base5','71','Here Comes Team Rocket!','R'),
  ('base5','72','Rocket''s Sneak Attack','R'),
  ('base5','73','The Boss''s Way','U'),
  ('base5','74','Challenge!','U'),
  ('base5','75','Digger','U'),
  ('base5','76','Imposter Oak''s Revenge','U'),
  ('base5','77','Nightly Garbage Run','U'),
  ('base5','78','Goop Gas Attack','C'),
  ('base5','79','Sleep!','C'),
  ('base5','80','Rainbow Energy','R'),
  ('base5','81','Full Heal Energy','U'),
  ('base5','82','Potion Energy','U'),
  ('base5','83','Dark Raichu','S')
on conflict (set_code, number) do update set name = excluded.name, rarity = excluded.rarity;
