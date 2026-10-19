-- Structural damage, card cleaning, and cracking slabs.
--
-- ── Damage that stays ──
-- Wear so far has been six numbers, with everything visible drawn from them.
-- That works for things that can get better or worse by degrees, but a hole
-- does not fade when a card is cleaned. So three kinds of damage are now
-- stored per copy:
--
--   crease  0 none · 1 light (a corner bend or a short ding) · 2 a crease
--           across the card · 3 heavy (a fold, or several creases)
--   holes   0-3 punctures
--   rips    corners torn away, a bitmask clockwise from top left:
--           1 top-left, 2 top-right, 4 bottom-right, 8 bottom-left
--
-- Creases already existed, decided on the fly in ConditionedCard from the
-- surface score and wear_seed. Every card keeps exactly the creases it was
-- showing: the backfill below replays that random stream (checked against
-- scripts/legacy-creases.mjs), one drawn crease becoming level 2 and two
-- becoming level 3. 165 of 8,173 cards had one.
--
-- They also count now. A grade is capped by the worst of them, the way a
-- real grader treats structural damage: a light crease holds a card to 6, a
-- crease to 4, a heavy one to 3, a rip to 2 and a hole to 1.
--
-- ── Cleaning ──
-- Raw cards only, 2 tokens, 3 days away (both in vending_settings). It takes
-- 10-30% off whatever wear is left on corners, edges, surface and border -
-- 80 surface with a 20% clean comes back 84 - and cannot touch centering or
-- structural damage. One clean in 33 goes wrong instead: the surface gets
-- scratched up, and sometimes creased.
--
-- ── Cracking a slab ──
-- Turns a graded card back into a raw one; the grading fee is gone. Each of
-- the four corners is pried in a timing game, and the client reports which
-- ones slipped. A slip costs nothing half the time, otherwise dings that
-- corner, tears it off, or now and then puts the tool through the card.
-- The slips are the player's own word: the only card a false report can
-- spare is their own.

-- ─────────────────────────────────────────────────────────────── columns
alter table public.user_cards
  add column if not exists crease smallint not null default 0 check (crease between 0 and 3),
  add column if not exists holes  smallint not null default 0 check (holes between 0 and 3),
  add column if not exists rips   smallint not null default 0 check (rips between 0 and 15),
  add column if not exists cleaning_started_at timestamptz,
  add column if not exists cleaning_ready_at   timestamptz;

alter table public.vending_settings
  add column if not exists cleaning_cost numeric not null default 2,
  add column if not exists cleaning_days numeric not null default 3;

alter table public.token_ledger drop constraint if exists token_ledger_reason_check;
alter table public.token_ledger add constraint token_ledger_reason_check
  check (reason = any (array['monthly_grant','admin_adjustment','purchase','refund',
    'timer_reward','timer_revoked','rebucket','grading','market_buy','market_sale',
    'bid_hold','bid_refund','interest_reward','cleaning']));

-- ─────────────────────────────────────── backfill: the creases on show
-- mulberry32's k-th draw depends only on the seed and k, so the replay can
-- skip straight to the draws that decide anything.
create function pg_temp.legacy_imul(x bigint, y bigint) returns bigint language sql immutable as $f$
  select ((x * (y & 65535)) + (((x * (y >> 16)) & 65535) << 16)) & 4294967295
$f$;

create function pg_temp.legacy_rand(p_seed bigint, p_k int) returns double precision
language plpgsql immutable as $f$
declare a bigint; t bigint;
begin
  a := ((case when p_seed = 0 then 1 else p_seed end) + p_k::bigint * 1831565813) & 4294967295;
  t := a;
  t := pg_temp.legacy_imul(t # (t >> 15), t | 1);
  t := t # ((t + pg_temp.legacy_imul(t # (t >> 7), t | 61)) & 4294967295);
  return ((t # (t >> 14)) & 4294967295)::double precision / 4294967296.0;
end $f$;

-- Mirrors legacyCreaseCount in scripts/legacy-creases.mjs draw for draw.
-- Math.round is floor(x + 0.5) here: Postgres rounds float halves to even.
create function pg_temp.legacy_crease_count(p_surface int, p_border int, p_seed bigint)
returns int language plpgsql immutable as $f$
declare
  k int := 8;  -- corner fraying and edge whitening, four draws each
  sw float8 := greatest(0, (100 - p_surface)::float8 / 100);
  bw float8 := greatest(0, (100 - p_border)::float8 / 100);
  runs int; along float8; u float8; centre float8; len float8; a0 float8; a1 float8;
  steps int; n int; roll float8; chance float8; a int; b int;
begin
  if bw > 0.02 then
    runs := greatest(1, floor(1 + bw * 6 + 0.5)::int);
    for side in 0..3 loop
      along := case when side < 2 then 245 else 342 end;
      for i in 1..runs loop
        k := k + 1; u := pg_temp.legacy_rand(p_seed, k);
        centre := case when u < 0.5 then power(u * 2, 1.8) * 0.5 * along
                       else along - power((1 - u) * 2, 1.8) * 0.5 * along end;
        k := k + 1; len := along * (0.015 + pg_temp.legacy_rand(p_seed, k) * (0.025 + bw * 0.07));
        a0 := greatest(0, centre - len / 2); a1 := least(along, centre + len / 2);
        if a1 - a0 < 2 then continue; end if;
        steps := greatest(3, floor((a1 - a0) / 3.5 + 0.5)::int);
        k := k + 2 * (steps + 1);
      end loop;
    end loop;
  end if;
  n := floor(sw * 15 + 0.5)::int;
  k := k + 2;  -- the first scratch anchor
  for i in 1..n loop
    k := k + 1; roll := pg_temp.legacy_rand(p_seed, k);
    k := k + 1;
    if pg_temp.legacy_rand(p_seed, k) < 0.45 then k := k + 4; else k := k + 2; end if;
    k := k + (case when roll < 0.3 then 3 else 4 end) + 1;
  end loop;
  chance := greatest(0, least(0.8, (68 - p_surface)::float8 / 60));
  k := k + 1;
  if not (pg_temp.legacy_rand(p_seed, k) < chance) then return 0; end if;
  k := k + 1; a := floor(pg_temp.legacy_rand(p_seed, k) * 4)::int;
  k := k + 1; b := floor(pg_temp.legacy_rand(p_seed, k) * 4)::int;
  if b = a then k := k + 1; end if;
  k := k + 6 + 1;
  return case when pg_temp.legacy_rand(p_seed, k) < 0.22 then 2 else 1 end;
end $f$;

update public.user_cards u
   set crease = case pg_temp.legacy_crease_count(u.surface, u.border_wear, u.wear_seed)
                  when 1 then 2 when 2 then 3 else 0 end
 where u.surface < 68;

-- ───────────────────────────────────────────────────────────── grading
drop function if exists public.card_grade(smallint, smallint, smallint, smallint, smallint, smallint);
create function public.card_grade(
  p_center_x smallint, p_center_y smallint, p_corners smallint, p_edges smallint,
  p_surface smallint, p_border smallint, p_crease smallint, p_holes smallint, p_rips smallint
) returns integer language sql immutable as $function$
  select least(
    case
      when greatest(abs(p_center_x), abs(p_center_y)) <= 10 then 10
      when greatest(abs(p_center_x), abs(p_center_y)) <= 20 then 9
      when greatest(abs(p_center_x), abs(p_center_y)) <= 30 then 8
      when greatest(abs(p_center_x), abs(p_center_y)) <= 40 then 7
      when greatest(abs(p_center_x), abs(p_center_y)) <= 50 then 6
      when greatest(abs(p_center_x), abs(p_center_y)) <= 62 then 5
      else 4
    end,
    case
      when least(p_corners, p_edges, p_surface, p_border) >= 95 then 10
      when least(p_corners, p_edges, p_surface, p_border) >= 89 then 9
      when least(p_corners, p_edges, p_surface, p_border) >= 81 then 8
      when least(p_corners, p_edges, p_surface, p_border) >= 72 then 7
      when least(p_corners, p_edges, p_surface, p_border) >= 63 then 6
      when least(p_corners, p_edges, p_surface, p_border) >= 54 then 5
      else 4
    end,
    -- Structural damage caps the grade outright, worst first.
    case
      when p_holes > 0 then 1
      when p_rips > 0 then 2
      when p_crease >= 3 then 3
      when p_crease = 2 then 4
      when p_crease = 1 then 6
      else 10
    end
  );
$function$;

create or replace function public.collect_grade(p_user_card_id bigint)
returns table (ok boolean, reason text, grade integer)
language plpgsql security definer set search_path to 'public' as $function$
declare
  me uuid := auth.uid();
  v  public.user_cards;
  g  int;
begin
  select * into v from public.user_cards where id = p_user_card_id for update;

  if v.id is null or v.user_id <> me then
    return query select false, 'not_yours', null::int; return;
  end if;
  if v.graded_at is not null then
    return query select true, 'already_graded', v.grade::int; return;
  end if;
  if v.grading_started_at is null then
    return query select false, 'not_submitted', null::int; return;
  end if;
  if now() < v.grading_ready_at then
    return query select false, 'not_ready', null::int; return;
  end if;

  g := public.card_grade(v.center_x, v.center_y, v.corners, v.edges, v.surface,
                         v.border_wear, v.crease, v.holes, v.rips);

  update public.user_cards
     set graded_at = now(), grade = g
   where id = p_user_card_id;

  return query select true, 'ok', g;
end $function$;

-- A card away being cleaned cannot also be away being graded.
create or replace function public.submit_for_grading(p_user_card_id bigint)
returns table (ok boolean, reason text, ready_at timestamptz, balance numeric)
language plpgsql security definer set search_path to 'public' as $function$
declare
  me      uuid := auth.uid();
  v_card  public.user_cards;
  v_cost  numeric(12,2);
  v_days  numeric;
  v_ready timestamptz;
begin
  select s.grading_cost, s.grading_days into v_cost, v_days
    from public.vending_settings s where s.id;

  select * into v_card from public.user_cards where id = p_user_card_id for update;

  if v_card.id is null or v_card.user_id <> me then
    return query select false, 'not_yours', null::timestamptz, public.token_balance(me); return;
  end if;
  if v_card.market_listing_id is not null then
    return query select false, 'listed', null::timestamptz, public.token_balance(me); return;
  end if;
  if v_card.cleaning_started_at is not null then
    return query select false, 'at_cleaners', null::timestamptz, public.token_balance(me); return;
  end if;
  if v_card.grading_started_at is not null then
    return query select false, 'already_submitted', v_card.grading_ready_at, public.token_balance(me); return;
  end if;
  if public.token_balance(me) < v_cost then
    return query select false, 'insufficient_tokens', null::timestamptz, public.token_balance(me); return;
  end if;

  perform public.spend_tokens(me, v_cost, 'grading', 'Grading submission');

  v_ready := now() + make_interval(mins => round(v_days * 24 * 60)::int);
  update public.user_cards
     set grading_started_at = now(), grading_ready_at = v_ready
   where id = p_user_card_id;

  return query select true, 'ok', v_ready, public.token_balance(me);
end $function$;

-- ─────────────────────────────────────────────────── new pulls, new damage
-- Creases on the same odds the old rendering used; tears and holes only on
-- the very worst pulls, and rarely even then. Most holes and tears will come
-- from cleaning and cracking going wrong.
drop function if exists public.roll_card_condition(bigint);
create function public.roll_card_condition(p_nonce bigint)
returns table (center_x smallint, center_y smallint, corners smallint, edges smallint,
               surface smallint, border_wear smallint, wear_seed integer,
               crease smallint, holes smallint, rips smallint)
language plpgsql volatile as $function$
declare
  q float8 := (random() + random() + random()) / 3;
  r float8;
begin
  center_x := round(sign(random() - 0.5) * 100 * power((random() + random()) / 2, 2.2) * (1 - 0.8 * q));
  center_y := round(sign(random() - 0.5) * 100 * power((random() + random()) / 2, 2.2) * (1 - 0.8 * q));
  corners := greatest(0, least(100, round(100 - 62 * power(1 - q, 1.72) + (random() - random()) * 6)));
  edges   := greatest(0, least(100, round(100 - 62 * power(1 - q, 1.72) + (random() - random()) * 6)));
  surface := greatest(0, least(100, round(100 - 62 * power(1 - q, 1.72) + (random() - random()) * 6)));
  border_wear := greatest(0, least(100, round(100 - 62 * power(1 - q, 1.72) + (random() - random()) * 6)));
  wear_seed := floor(random() * 2147483000)::int;

  crease := 0;
  if random() < greatest(0, least(0.8, (68 - surface) / 60.0)) then
    r := random();
    crease := case when r < 0.45 then 1 when r < 0.85 then 2 else 3 end;
  end if;
  rips := 0;
  if random() < greatest(0, least(0.25, (55 - corners) / 90.0)) then
    rips := (1 << floor(random() * 4)::int);
  end if;
  holes := 0;
  if random() < greatest(0, least(0.12, (50 - surface) / 120.0)) then
    holes := 1;
  end if;

  return next;
end $function$;

drop function if exists public.open_pack(bigint);
create function public.open_pack(p_user_pack_id bigint)
returns table (card_id bigint, name text, rarity character, number text, image_url text, slot integer,
               center_x smallint, center_y smallint, corners smallint, edges smallint, surface smallint,
               border_wear smallint, wear_seed integer, crease smallint, holes smallint, rips smallint)
language plpgsql security definer set search_path to 'public' as $function$
declare
  me       uuid := auth.uid();
  v_pack   public.user_packs;
  v_code   text;
  v_rare   char(1);
begin
  select * into v_pack from public.user_packs where id = p_user_pack_id for update;

  if v_pack.id is null or v_pack.user_id <> me then
    raise exception 'That pack is not yours';
  end if;
  if v_pack.market_listing_id is not null then
    raise exception 'That pack is listed for sale';
  end if;
  if v_pack.opened_at is not null then
    raise exception 'That pack is already open';
  end if;

  select p.set_code into v_code from public.vending_packs p where p.id = v_pack.pack_id;
  if v_code is null then
    raise exception 'That pack has no card pool';
  end if;

  if random() < 0.02
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
  rolled as (
    select p.id, p.grp, r.center_x, r.center_y, r.corners, r.edges, r.surface,
           r.border_wear, r.wear_seed, r.crease, r.holes, r.rips
      from picks p
      cross join lateral public.roll_card_condition(p.id) r
  ),
  inserted as (
    insert into public.user_cards (user_id, card_id, user_pack_id,
                                   center_x, center_y, corners, edges, surface,
                                   border_wear, wear_seed, crease, holes, rips)
    select me, x.id, p_user_pack_id,
           x.center_x, x.center_y, x.corners, x.edges, x.surface,
           x.border_wear, x.wear_seed, x.crease, x.holes, x.rips
      from rolled x
    returning user_cards.card_id
  ),
  marked as (
    update public.user_packs set opened_at = now() where id = p_user_pack_id returning 1
  )
  select c.id, c.name, c.rarity, c.number, c.image_url,
         row_number() over (order by x.grp, random())::int,
         x.center_x, x.center_y, x.corners, x.edges, x.surface,
         x.border_wear, x.wear_seed, x.crease, x.holes, x.rips
    from rolled x
    join public.vending_cards c on c.id = x.id
   where (select count(*) from inserted) > 0
     and (select count(*) from marked) > 0;
end $function$;

-- ─────────────────────────────────────── everywhere a card is drawn
drop function if exists public.get_market_listing_items(bigint);
create function public.get_market_listing_items(p_listing bigint)
returns table (item_kind text, name text, number text, rarity character, image_url text, set_code text,
               grade smallint, center_x smallint, center_y smallint, corners smallint, edges smallint,
               surface smallint, border_wear smallint, wear_seed integer,
               crease smallint, holes smallint, rips smallint)
language sql stable security definer set search_path to 'public' as $function$
  select 'card'::text, vc.name, vc.number, vc.rarity, vc.image_url, vc.set_code,
         case when uc.graded_at is not null then uc.grade else null end,
         uc.center_x, uc.center_y, uc.corners, uc.edges,
         uc.surface, uc.border_wear, uc.wear_seed, uc.crease, uc.holes, uc.rips
    from public.market_listing_items i
    join public.user_cards uc on uc.id = i.user_card_id
    join public.vending_cards vc on vc.id = uc.card_id
   where i.listing_id = p_listing
  union all
  select 'pack'::text, vp.pack_name, null::text, null::char(1), vp.image_url, vp.set_code,
         null::smallint, 0::smallint, 0::smallint, 100::smallint, 100::smallint,
         100::smallint, 100::smallint, 0, 0::smallint, 0::smallint, 0::smallint
    from public.market_listing_items i
    join public.user_packs up on up.id = i.user_pack_id
    join public.vending_packs vp on vp.id = up.pack_id
   where i.listing_id = p_listing;
$function$;

drop function if exists public.get_showcase(uuid);
create function public.get_showcase(p_user uuid)
returns table (slot smallint, user_card_id bigint, card_id bigint, name text, number text, rarity character,
               image_url text, set_code text, center_x smallint, center_y smallint, corners smallint,
               edges smallint, surface smallint, border_wear smallint, wear_seed integer, grade smallint,
               crease smallint, holes smallint, rips smallint)
language sql stable security definer set search_path to 'public' as $function$
  select s.slot, s.user_card_id, c.id,
         c.name, c.number, c.rarity, c.image_url, c.set_code,
         uc.center_x, uc.center_y, uc.corners, uc.edges,
         uc.surface, uc.border_wear, uc.wear_seed,
         case when uc.graded_at is not null then uc.grade else null end,
         uc.crease, uc.holes, uc.rips
    from public.showcase_slots s
    join public.user_cards uc   on uc.id = s.user_card_id
    join public.vending_cards c on c.id = uc.card_id
   where s.user_id = p_user
   order by s.slot;
$function$;

-- ─────────────────────────────── away at the cleaners means unavailable
create or replace function public.set_showcase_slot(p_slot integer, p_user_card_id bigint)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  me uuid := auth.uid();
begin
  if p_slot < 0 or p_slot > 11 then
    raise exception 'No such shelf slot';
  end if;
  if not exists (select 1 from public.user_cards c
                  where c.id = p_user_card_id and c.user_id = me) then
    raise exception 'That card is not yours';
  end if;
  if exists (select 1 from public.user_cards c
              where c.id = p_user_card_id and c.market_listing_id is not null) then
    raise exception 'That card is listed for sale';
  end if;
  if exists (select 1 from public.user_cards c
              where c.id = p_user_card_id and c.cleaning_started_at is not null) then
    raise exception 'That card is away being cleaned';
  end if;

  delete from public.showcase_slots
   where user_id = me and user_card_id = p_user_card_id;

  insert into public.showcase_slots (user_id, slot, user_card_id)
  values (me, p_slot, p_user_card_id)
  on conflict (user_id, slot)
  do update set user_card_id = excluded.user_card_id, placed_at = now();
end $function$;

create or replace function public.market_create_listing(
  p_kind text, p_price numeric, p_card_ids bigint[], p_pack_ids bigint[],
  p_hours numeric default null, p_note text default null, p_title text default null
) returns table (ok boolean, reason text, listing_id bigint)
language plpgsql security definer set search_path to 'public' as $function$
declare
  me      uuid := auth.uid();
  v_id    bigint;
  v_cards bigint[] := coalesce(p_card_ids, '{}');
  v_packs bigint[] := coalesce(p_pack_ids, '{}');
  v_count int;
  v_ends  timestamptz;
  v_price numeric(12,2) := round(coalesce(p_price, 0), 2);
  v_title text := public.market_clean_title(p_title);
begin
  if p_kind not in ('fixed','auction') then
    return query select false, 'bad_kind', null::bigint; return;
  end if;
  if v_price < 0.01 then
    return query select false, 'bad_price', null::bigint; return;
  end if;
  if char_length(v_title) > 60 then
    return query select false, 'bad_title', null::bigint; return;
  end if;
  if array_length(v_cards, 1) is null and array_length(v_packs, 1) is null then
    return query select false, 'empty_listing', null::bigint; return;
  end if;
  if p_kind = 'auction' then
    if p_hours is null or p_hours <= 0 then
      return query select false, 'bad_duration', null::bigint; return;
    end if;
    v_ends := now() + make_interval(mins => round(p_hours * 60)::int);
  end if;

  select count(*) into v_count from public.user_cards c
   where c.id = any(v_cards)
     and c.user_id = me
     and c.market_listing_id is null
     and c.cleaning_started_at is null
     and (c.grading_started_at is null or c.graded_at is not null);
  if v_count <> coalesce(array_length(v_cards, 1), 0) then
    return query select false, 'bad_cards', null::bigint; return;
  end if;

  select count(*) into v_count from public.user_packs p
   where p.id = any(v_packs)
     and p.user_id = me
     and p.market_listing_id is null
     and p.opened_at is null;
  if v_count <> coalesce(array_length(v_packs, 1), 0) then
    return query select false, 'bad_packs', null::bigint; return;
  end if;

  insert into public.market_listings (seller_id, kind, price, ends_at, note, title)
  values (me, p_kind, v_price, v_ends, nullif(btrim(coalesce(p_note, '')), ''), v_title)
  returning id into v_id;

  insert into public.market_listing_items (listing_id, user_card_id)
  select v_id, unnest(v_cards);
  insert into public.market_listing_items (listing_id, user_pack_id)
  select v_id, unnest(v_packs);

  update public.user_cards set market_listing_id = v_id where id = any(v_cards);
  update public.user_packs set market_listing_id = v_id where id = any(v_packs);
  delete from public.showcase_slots where user_id = me and user_card_id = any(v_cards);

  return query select true, 'ok', v_id;
end $function$;

-- ──────────────────────────────────────────────────────────── cleaning
create function public.cleaning_settings()
returns table (cost numeric, days numeric)
language sql stable security definer set search_path to 'public' as $function$
  select s.cleaning_cost, s.cleaning_days from public.vending_settings s where s.id;
$function$;

create function public.submit_for_cleaning(p_user_card_id bigint)
returns table (ok boolean, reason text, ready_at timestamptz, balance numeric)
language plpgsql security definer set search_path to 'public' as $function$
declare
  me      uuid := auth.uid();
  v_card  public.user_cards;
  v_cost  numeric(12,2);
  v_days  numeric;
  v_ready timestamptz;
begin
  select s.cleaning_cost, s.cleaning_days into v_cost, v_days
    from public.vending_settings s where s.id;

  select * into v_card from public.user_cards where id = p_user_card_id for update;

  if v_card.id is null or v_card.user_id <> me then
    return query select false, 'not_yours', null::timestamptz, public.token_balance(me); return;
  end if;
  if v_card.market_listing_id is not null then
    return query select false, 'listed', null::timestamptz, public.token_balance(me); return;
  end if;
  -- Raw only: graded, or away at the graders, is out.
  if v_card.graded_at is not null or v_card.grading_started_at is not null then
    return query select false, 'not_raw', null::timestamptz, public.token_balance(me); return;
  end if;
  if v_card.cleaning_started_at is not null then
    return query select false, 'already_cleaning', v_card.cleaning_ready_at, public.token_balance(me); return;
  end if;
  if public.token_balance(me) < v_cost then
    return query select false, 'insufficient_tokens', null::timestamptz, public.token_balance(me); return;
  end if;

  perform public.spend_tokens(me, v_cost, 'cleaning', 'Card cleaning');

  v_ready := now() + make_interval(mins => round(v_days * 24 * 60)::int);
  update public.user_cards
     set cleaning_started_at = now(), cleaning_ready_at = v_ready
   where id = p_user_card_id;
  -- It is physically away, so it comes off the shelf.
  delete from public.showcase_slots where user_id = me and user_card_id = p_user_card_id;

  return query select true, 'ok', v_ready, public.token_balance(me);
end $function$;

-- The result is rolled when it is collected, not when it is sent.
create function public.collect_cleaning(p_user_card_id bigint)
returns table (ok boolean, reason text, outcome text, improved integer,
               corners smallint, edges smallint, surface smallint, border_wear smallint,
               crease smallint, holes smallint, rips smallint)
language plpgsql security definer set search_path to 'public' as $function$
declare
  me    uuid := auth.uid();
  v     public.user_cards;
  pct   int := 0;
  v_out text;
  c smallint; e smallint; s smallint; b smallint; cr smallint;
begin
  select * into v from public.user_cards u where u.id = p_user_card_id for update;

  if v.id is null or v.user_id <> me then
    return query select false, 'not_yours', null::text, null::int,
      null::smallint, null::smallint, null::smallint, null::smallint, null::smallint, null::smallint, null::smallint;
    return;
  end if;
  if v.cleaning_started_at is null then
    return query select false, 'not_cleaning', null::text, null::int,
      null::smallint, null::smallint, null::smallint, null::smallint, null::smallint, null::smallint, null::smallint;
    return;
  end if;
  if now() < v.cleaning_ready_at then
    return query select false, 'not_ready', null::text, null::int,
      null::smallint, null::smallint, null::smallint, null::smallint, null::smallint, null::smallint, null::smallint;
    return;
  end if;

  c := v.corners; e := v.edges; s := v.surface; b := v.border_wear; cr := v.crease;
  if random() < 0.03 then
    -- Scrubbed too hard: the surface comes back scratched, and a third of
    -- the time it has been bent in the handling.
    v_out := 'damaged';
    s := greatest(0, s - (5 + floor(random() * 11)::int));
    if random() < 0.35 then cr := least(3, cr + 1); end if;
  else
    v_out := 'cleaned';
    pct := 10 + floor(random() * 21)::int;
    c := least(100, c + round((100 - c) * pct / 100.0));
    e := least(100, e + round((100 - e) * pct / 100.0));
    s := least(100, s + round((100 - s) * pct / 100.0));
    b := least(100, b + round((100 - b) * pct / 100.0));
  end if;

  update public.user_cards u
     set corners = c, edges = e, surface = s, border_wear = b, crease = cr,
         cleaning_started_at = null, cleaning_ready_at = null
   where u.id = p_user_card_id;

  return query select true, 'ok', v_out, pct, c, e, s, b, cr, v.holes, v.rips;
end $function$;

-- ──────────────────────────────────────────────────────── cracking a slab
-- p_slips: four booleans, clockwise from the top-left corner, true where
-- the pry slipped. Results come back in the same order:
--   clean   pried cleanly
--   lucky   slipped, but nothing came of it
--   ding    slipped and dinged that corner
--   rip     slipped and tore that corner off
--   hole    slipped and went through the card
create function public.crack_slab(p_user_card_id bigint, p_slips boolean[])
returns table (ok boolean, reason text, results text[],
               corners smallint, edges smallint, surface smallint, border_wear smallint,
               crease smallint, holes smallint, rips smallint)
language plpgsql security definer set search_path to 'public' as $function$
declare
  me    uuid := auth.uid();
  v     public.user_cards;
  out_r text[] := array[]::text[];
  c smallint; s smallint; h smallint; rp smallint;
  r float8;
  v_bit int;
begin
  select * into v from public.user_cards u where u.id = p_user_card_id for update;

  if v.id is null or v.user_id <> me then
    return query select false, 'not_yours', null::text[],
      null::smallint, null::smallint, null::smallint, null::smallint, null::smallint, null::smallint, null::smallint;
    return;
  end if;
  if v.market_listing_id is not null then
    return query select false, 'listed', null::text[],
      null::smallint, null::smallint, null::smallint, null::smallint, null::smallint, null::smallint, null::smallint;
    return;
  end if;
  if v.graded_at is null then
    return query select false, 'not_graded', null::text[],
      null::smallint, null::smallint, null::smallint, null::smallint, null::smallint, null::smallint, null::smallint;
    return;
  end if;
  if p_slips is null or coalesce(array_length(p_slips, 1), 0) <> 4 then
    return query select false, 'bad_request', null::text[],
      null::smallint, null::smallint, null::smallint, null::smallint, null::smallint, null::smallint, null::smallint;
    return;
  end if;

  c := v.corners; s := v.surface; h := v.holes; rp := v.rips;
  for i in 1..4 loop
    v_bit := 1 << (i - 1);
    if not coalesce(p_slips[i], false) then
      out_r := out_r || 'clean'::text;
      continue;
    end if;
    r := random();
    if r < 0.50 then
      out_r := out_r || 'lucky'::text;
    elsif r < 0.82 or (r < 0.94 and (rp & v_bit) <> 0) then
      out_r := out_r || 'ding'::text;
      c := greatest(0, c - (5 + floor(random() * 8)::int));
    elsif r < 0.94 then
      out_r := out_r || 'rip'::text;
      rp := rp | v_bit;
      c := greatest(0, c - (10 + floor(random() * 11)::int));
    else
      out_r := out_r || 'hole'::text;
      h := least(3, h + 1);
      s := greatest(0, s - (4 + floor(random() * 7)::int));
    end if;
  end loop;

  update public.user_cards u
     set corners = c, surface = s, holes = h, rips = rp,
         grade = null, graded_at = null, grading_started_at = null, grading_ready_at = null
   where u.id = p_user_card_id;

  return query select true, 'ok', out_r, c, v.edges, s, v.border_wear, v.crease, h, rp;
end $function$;
