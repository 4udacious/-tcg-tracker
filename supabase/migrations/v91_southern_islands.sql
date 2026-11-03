-- Southern Islands (si1), a special set: 18 cards, every one a holo, three to
-- a pack instead of eleven.
--
-- Art from pokemontcg.io at /cards/si1-<number>.webp like every other set
-- (image_url is a generated column). One wrapper, /packs/southern-islands-mew.webp,
-- made from the set's logo and Mew's art (no pack photo to use: it was sold as
-- a collection, not in booster packs).
--
-- Pack size: vending_set_info.pack_size, null for the usual eleven (7 commons,
-- 3 uncommons, a rare). A set with a pack size gets that many different cards
-- from the whole set at random, and never a god pack (it isn't an eleven-card
-- pack). Every card here is H, so each pack posts three holo pulls to the
-- home feed like any holo.
--
-- Not stocked: the pack is active so the set shows up in /admin/vvm, and
-- vending_set_info starts at 0 of 0 to keep it out of the machine until
-- someone sets a quantity there. Safe to re-run.

alter table public.vending_set_info add column if not exists pack_size smallint
  check (pack_size between 1 and 11);
comment on column public.vending_set_info.pack_size is
  'Cards a pack, all at random from the set (no god packs). Null: the usual 11 (7 C, 3 U, 1 rare).';

insert into public.vending_cards (set_code, number, name, rarity)
select 'si1', parts[1], parts[3], parts[2]::char(1)
  from (
    select string_to_array(btrim(line, E' \t\r'), '|') as parts
      from unnest(string_to_array($cards$
1|H|Mew
2|H|Pidgeot
3|H|Onix
4|H|Togepi
5|H|Ivysaur
6|H|Raticate
7|H|Ledyba
8|H|Jigglypuff
9|H|Butterfree
10|H|Tentacruel
11|H|Marill
12|H|Lapras
13|H|Exeggutor
14|H|Slowking
15|H|Wartortle
16|H|Lickitung
17|H|Vileplume
18|H|Primeape
$cards$, E'\n')) as line
     where btrim(line, E' \t\r') <> ''
  ) t
on conflict (set_code, number) do nothing;

insert into public.vending_packs (set_name, pack_name, image_url, sort_order, is_active, set_code)
values ('Southern Islands', 'Mew', '/packs/southern-islands-mew.webp', 73, true, 'si1')
on conflict (set_name, pack_name) do update
  set image_url = excluded.image_url, sort_order = excluded.sort_order, is_active = excluded.is_active, set_code = excluded.set_code;

insert into public.vending_set_info (set_code, description, total_quantity, claimed_quantity, pack_size)
values
('si1',
'Three holos, every pack.

Southern Islands is a holiday in the tropics: eighteen cards, every one a holofoil. Mew rides a rainbow over the sea, with Lapras, Slowking, Togepi and Marill along the shore. Three cards to a pack, all holo.',
  0, 0, 3)
on conflict (set_code) do update set pack_size = excluded.pack_size;

-- open_pack as it is live, with a branch first for sets with a pack size.
create or replace function public.open_pack(p_user_pack_id bigint)
 returns table(card_id bigint, name text, rarity character, number text, image_url text, slot integer, center_x smallint, center_y smallint, corners smallint, edges smallint, surface smallint, border_wear smallint, wear_seed integer, crease smallint, holes smallint, rips smallint)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare me uuid := auth.uid(); v_pack public.user_packs; v_code text; v_rare char(1); v_odds int; v_god boolean := false; v_size int;
begin
  select * into v_pack from public.user_packs where id = p_user_pack_id for update;
  if v_pack.id is null or v_pack.user_id <> me then raise exception 'That pack is not yours'; end if;
  if v_pack.market_listing_id is not null then raise exception 'That pack is listed for sale'; end if;
  if v_pack.opened_at is not null then raise exception 'That pack is already open'; end if;
  select p.set_code into v_code from public.vending_packs p where p.id = v_pack.pack_id;
  if v_code is null then raise exception 'That pack has no card pool'; end if;
  select si.pack_size into v_size from public.vending_set_info si where si.set_code = v_code;
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
