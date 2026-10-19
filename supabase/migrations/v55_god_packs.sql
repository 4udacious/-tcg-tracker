-- God packs.
--
-- Now and then a pack opens as every holo: 11 different holo rares from the
-- set, each one sharp - corners, edges, surface and border all 90 or better,
-- centred within 10 either way (a centering score of 90+), and no crease,
-- hole or tear. Every card in one grades a 9 or a 10.
--
-- Decided at the moment of opening, like everything else in a pack, so a
-- sealed pack bought on the market has the same chance as one from the
-- machine. The odds live in vending_settings.god_pack_odds as "1 in N";
-- they start at 1 in 500, which at the current ~125 packs a week is about
-- one a month across everybody. A set with fewer than 11 holos never rolls
-- one (none do today; the smallest has 15).
--
-- user_packs.god_pack records which packs they were. open_pack keeps its
-- signature and result, so its grant carries over; roll_god_condition is
-- internal and, per v51, starts with no grant at all.

alter table public.vending_settings
  add column if not exists god_pack_odds integer not null default 500 check (god_pack_odds >= 1);

alter table public.user_packs
  add column if not exists god_pack boolean not null default false;

create or replace function public.roll_god_condition(p_nonce bigint)
returns table (center_x smallint, center_y smallint, corners smallint, edges smallint,
               surface smallint, border_wear smallint, wear_seed integer,
               crease smallint, holes smallint, rips smallint)
language plpgsql volatile as $function$
begin
  center_x := round((random() * 2 - 1) * 10);
  center_y := round((random() * 2 - 1) * 10);
  corners := 90 + floor(random() * 11);
  edges   := 90 + floor(random() * 11);
  surface := 90 + floor(random() * 11);
  border_wear := 90 + floor(random() * 11);
  wear_seed := floor(random() * 2147483000)::int;
  crease := 0; holes := 0; rips := 0;
  return next;
end $function$;

create or replace function public.open_pack(p_user_pack_id bigint)
returns table (card_id bigint, name text, rarity character, number text, image_url text, slot integer,
               center_x smallint, center_y smallint, corners smallint, edges smallint, surface smallint,
               border_wear smallint, wear_seed integer, crease smallint, holes smallint, rips smallint)
language plpgsql security definer set search_path to 'public' as $function$
declare
  me       uuid := auth.uid();
  v_pack   public.user_packs;
  v_code   text;
  v_rare   char(1);
  v_odds   int;
  v_god    boolean := false;
begin
  select * into v_pack from public.user_packs where id = p_user_pack_id for update;
  if v_pack.id is null or v_pack.user_id <> me then raise exception 'That pack is not yours'; end if;
  if v_pack.market_listing_id is not null then raise exception 'That pack is listed for sale'; end if;
  if v_pack.opened_at is not null then raise exception 'That pack is already open'; end if;
  select p.set_code into v_code from public.vending_packs p where p.id = v_pack.pack_id;
  if v_code is null then raise exception 'That pack has no card pool'; end if;

  -- The god pack roll comes first: when it hits, there is no rare slot to
  -- roll, because every slot is a holo.
  select coalesce(s.god_pack_odds, 500) into v_odds from public.vending_settings s where s.id;
  if random() < 1.0 / greatest(v_odds, 1)
     and (select count(*) from public.vending_cards vc where vc.set_code = v_code and vc.rarity = 'H') >= 11 then
    v_god := true;
  end if;

  if v_god then
    update public.user_packs set god_pack = true where id = p_user_pack_id;
    return query
    with picks as (
      select c.id, 3 as grp from public.vending_cards c
       where c.set_code = v_code and c.rarity = 'H' order by random() limit 11
    ),
    rolled as (
      select p.id, p.grp, r.center_x, r.center_y, r.corners, r.edges, r.surface,
             r.border_wear, r.wear_seed, r.crease, r.holes, r.rips
        from picks p cross join lateral public.roll_god_condition(p.id) r
    ),
    inserted as (
      insert into public.user_cards (user_id, card_id, user_pack_id, center_x, center_y, corners, edges, surface,
                                     border_wear, wear_seed, crease, holes, rips)
      select me, x.id, p_user_pack_id, x.center_x, x.center_y, x.corners, x.edges, x.surface,
             x.border_wear, x.wear_seed, x.crease, x.holes, x.rips
        from rolled x
      returning user_cards.card_id
    ),
    marked as (update public.user_packs set opened_at = now() where id = p_user_pack_id returning 1)
    select c.id, c.name, c.rarity, c.number, c.image_url,
           row_number() over (order by random())::int,
           x.center_x, x.center_y, x.corners, x.edges, x.surface,
           x.border_wear, x.wear_seed, x.crease, x.holes, x.rips
      from rolled x join public.vending_cards c on c.id = x.id
     where (select count(*) from inserted) > 0 and (select count(*) from marked) > 0;
    return;
  end if;

  if random() < 0.02 and exists (select 1 from public.vending_cards vc where vc.set_code = v_code and vc.rarity = 'S') then
    v_rare := 'S';
  elsif random() < 0.3333 then v_rare := 'H';
  else v_rare := 'R';
  end if;
  return query
  with picks as (
    select id, 1 as grp from (select c.id from public.vending_cards c where c.set_code = v_code and c.rarity = 'C' order by random() limit 7) a
    union all
    select id, 2 from (select c.id from public.vending_cards c where c.set_code = v_code and c.rarity = 'U' order by random() limit 3) b
    union all
    select id, 3 from (select c.id from public.vending_cards c where c.set_code = v_code and c.rarity = v_rare order by random() limit 1) d
  ),
  rolled as (
    select p.id, p.grp, r.center_x, r.center_y, r.corners, r.edges, r.surface,
           r.border_wear, r.wear_seed, r.crease, r.holes, r.rips
      from picks p cross join lateral public.roll_card_condition(p.id) r
  ),
  inserted as (
    insert into public.user_cards (user_id, card_id, user_pack_id, center_x, center_y, corners, edges, surface,
                                   border_wear, wear_seed, crease, holes, rips)
    select me, x.id, p_user_pack_id, x.center_x, x.center_y, x.corners, x.edges, x.surface,
           x.border_wear, x.wear_seed, x.crease, x.holes, x.rips
      from rolled x
    returning user_cards.card_id
  ),
  marked as (update public.user_packs set opened_at = now() where id = p_user_pack_id returning 1)
  select c.id, c.name, c.rarity, c.number, c.image_url,
         row_number() over (order by x.grp, random())::int,
         x.center_x, x.center_y, x.corners, x.edges, x.surface,
         x.border_wear, x.wear_seed, x.crease, x.holes, x.rips
    from rolled x join public.vending_cards c on c.id = x.id
   where (select count(*) from inserted) > 0 and (select count(*) from marked) > 0;
end $function$;
