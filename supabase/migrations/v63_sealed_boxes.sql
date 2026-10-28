-- Sealed booster boxes. A box bought from the machine (v62) used to land as
-- its packs straight away; now it's a sealed box the member owns
-- (user_boxes), until they open it into its packs (open_box). Sealed, it can
-- be sold on the marketplace like a sealed pack, and stood on a showcase
-- shelf like a card. It is never graded or cleaned: those are for cards.
--
-- The per-member limit (v62) still counts what each member bought from the
-- machine (user_vending_boxes), not what they hold: a box bought on the
-- marketplace doesn't use up anyone's machine allowance, and selling yours
-- doesn't free one.
--
-- Each box carries its own image (vending_boxes.image_url), shown on the
-- machine's shelf, in the collection, the marketplace and the showcase.
--
-- Safe to re-run.

alter table public.vending_boxes add column if not exists image_url text;
update public.vending_boxes set image_url = '/products/base-set-booster-box.webp'
 where set_code = 'base1' and name = 'Base Set Booster Box' and image_url is null;

/* ── The sealed boxes members hold ── */
create table if not exists public.user_boxes (
  id                 bigserial primary key,
  user_id            uuid not null references public.profiles(id) on delete cascade,
  box_id             bigint not null references public.vending_boxes(id),
  -- Packs inside, as sold: an admin changing the box later doesn't change one already bought.
  packs              integer not null check (packs > 0),
  cycle_no           bigint,
  acquired_at        timestamptz not null default now(),
  opened_at          timestamptz,
  market_listing_id  bigint references public.market_listings(id) on delete set null
);
create index if not exists user_boxes_sealed on public.user_boxes (user_id) where opened_at is null;

alter table public.user_boxes enable row level security;
drop policy if exists user_boxes_select on public.user_boxes;
create policy user_boxes_select on public.user_boxes for select using (user_id = auth.uid() or public.is_mod());
revoke all on public.user_boxes from anon;
revoke insert, update, delete, truncate, references, trigger on public.user_boxes from authenticated;

-- Members may read box names and images (for the collection, market and showcase);
-- what's in stock and its settings stay behind the functions and the admin policy.
drop policy if exists vending_boxes_member_select on public.vending_boxes;
create policy vending_boxes_member_select on public.vending_boxes for select using (public.is_member());

/* ── A listing item can be a box; a showcase slot can hold one ── */
alter table public.market_listing_items add column if not exists user_box_id bigint references public.user_boxes(id) on delete cascade;
alter table public.market_listing_items drop constraint if exists market_item_is_one_thing;
alter table public.market_listing_items add constraint market_item_is_one_thing check (
  (user_card_id is not null)::int + (user_pack_id is not null)::int + (user_box_id is not null)::int = 1);

alter table public.showcase_slots alter column user_card_id drop not null;
alter table public.showcase_slots add column if not exists user_box_id bigint unique references public.user_boxes(id) on delete cascade;
alter table public.showcase_slots drop constraint if exists showcase_slot_holds_one_thing;
alter table public.showcase_slots add constraint showcase_slot_holds_one_thing check (
  (user_card_id is not null)::int + (user_box_id is not null)::int = 1);

/* ── Opening a box: its packs, each with a random wrapper of the set ── */
create or replace function public.open_box(p_user_box_id bigint)
returns integer
language plpgsql security definer set search_path to 'public' as $$
declare
  me     uuid := auth.uid();
  v      public.user_boxes;
  v_set  text;
  v_arts bigint[];
begin
  select * into v from public.user_boxes where id = p_user_box_id for update;
  if v.id is null or v.user_id <> me then raise exception 'That box is not yours'; end if;
  if v.market_listing_id is not null then raise exception 'That box is listed for sale'; end if;
  if v.opened_at is not null then raise exception 'That box is already open'; end if;
  select b.set_code into v_set from public.vending_boxes b where b.id = v.box_id;
  select array_agg(vp.id) into v_arts from public.vending_packs vp where vp.set_code = v_set and vp.is_active;
  if v_arts is null or array_length(v_arts, 1) is null then raise exception 'That box has no packs to give'; end if;

  delete from public.showcase_slots where user_box_id = v.id;
  update public.user_boxes set opened_at = now() where id = v.id;
  insert into public.user_packs (user_id, pack_id, cycle_no)
  select me, v_arts[1 + floor(random() * array_length(v_arts, 1))::int], v.cycle_no
    from generate_series(1, v.packs);
  return v.packs;
end $$;
revoke execute on function public.open_box(bigint) from public, anon;
grant execute on function public.open_box(bigint) to authenticated;

/* ── Showcase: a box on a shelf ── */
create or replace function public.set_showcase_box_slot(p_slot integer, p_user_box_id bigint)
returns void
language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid();
begin
  if p_slot < 0 or p_slot > 11 then raise exception 'No such shelf slot'; end if;
  if not exists (select 1 from public.user_boxes b where b.id = p_user_box_id and b.user_id = me and b.opened_at is null) then
    raise exception 'That box is not yours';
  end if;
  if exists (select 1 from public.user_boxes b where b.id = p_user_box_id and b.market_listing_id is not null) then
    raise exception 'That box is listed for sale';
  end if;
  delete from public.showcase_slots where user_id = me and user_box_id = p_user_box_id;
  delete from public.showcase_slots where user_id = me and slot = p_slot;
  insert into public.showcase_slots (user_id, slot, user_box_id) values (me, p_slot, p_user_box_id);
end $$;
revoke execute on function public.set_showcase_box_slot(integer, bigint) from public, anon;
grant execute on function public.set_showcase_box_slot(integer, bigint) to authenticated;

-- The card version, as before (v29), except that the slot may hold a box now:
-- an upsert on the slot would leave the box's id beside the card's.
create or replace function public.set_showcase_slot(p_slot integer, p_user_card_id bigint)
returns void
language plpgsql security definer set search_path to 'public' as $function$
declare me uuid := auth.uid();
begin
  if p_slot < 0 or p_slot > 11 then raise exception 'No such shelf slot'; end if;
  if not exists (select 1 from public.user_cards c where c.id = p_user_card_id and c.user_id = me) then raise exception 'That card is not yours'; end if;
  if exists (select 1 from public.user_cards c where c.id = p_user_card_id and c.market_listing_id is not null) then raise exception 'That card is listed for sale'; end if;
  if exists (select 1 from public.user_cards c where c.id = p_user_card_id and c.cleaning_started_at is not null) then raise exception 'That card is away being cleaned'; end if;
  delete from public.showcase_slots where user_id = me and user_card_id = p_user_card_id;
  delete from public.showcase_slots where user_id = me and slot = p_slot;
  insert into public.showcase_slots (user_id, slot, user_card_id) values (me, p_slot, p_user_card_id);
end $function$;

-- What's on the shelves: cards as before, then boxes (item_kind 'box', with
-- user_box_id and the box's name and image; no condition, no grade).
drop function if exists public.get_showcase(uuid);
create function public.get_showcase(p_user uuid)
returns table (slot smallint, user_card_id bigint, card_id bigint, name text, number text, rarity character, image_url text, set_code text,
               center_x smallint, center_y smallint, corners smallint, edges smallint, surface smallint, border_wear smallint,
               wear_seed integer, grade smallint, crease smallint, holes smallint, rips smallint, item_kind text, user_box_id bigint)
language sql stable security definer set search_path to 'public' as $$
  select s.slot, s.user_card_id, c.id, c.name, c.number, c.rarity, c.image_url, c.set_code,
         uc.center_x, uc.center_y, uc.corners, uc.edges, uc.surface, uc.border_wear, uc.wear_seed,
         case when uc.graded_at is not null then uc.grade else null end,
         uc.crease, uc.holes, uc.rips, 'card'::text, null::bigint
    from public.showcase_slots s
    join public.user_cards uc   on uc.id = s.user_card_id
    join public.vending_cards c on c.id = uc.card_id
   where s.user_id = p_user
  union all
  select s.slot, null::bigint, null::bigint, b.name, null::text, null::char(1), b.image_url, b.set_code,
         0::smallint, 0::smallint, 100::smallint, 100::smallint, 100::smallint, 100::smallint, 0,
         null::smallint, 0::smallint, 0::smallint, 0::smallint, 'box'::text, ub.id
    from public.showcase_slots s
    join public.user_boxes ub    on ub.id = s.user_box_id
    join public.vending_boxes b  on b.id = ub.box_id
   where s.user_id = p_user
   order by 1;
$$;
revoke execute on function public.get_showcase(uuid) from public, anon;
grant execute on function public.get_showcase(uuid) to authenticated;

/* ── Marketplace: boxes listed, bought, returned ── */
drop function if exists public.market_create_listing(text, numeric, bigint[], bigint[], numeric, text, text);
create or replace function public.market_create_listing(p_kind text, p_price numeric, p_card_ids bigint[], p_pack_ids bigint[],
  p_hours numeric default null, p_note text default null, p_title text default null, p_box_ids bigint[] default null)
returns table (ok boolean, reason text, listing_id bigint)
language plpgsql security definer set search_path to 'public' as $function$
declare
  me uuid := auth.uid(); v_id bigint; v_cards bigint[] := coalesce(p_card_ids, '{}'); v_packs bigint[] := coalesce(p_pack_ids, '{}');
  v_boxes bigint[] := coalesce(p_box_ids, '{}');
  v_count int; v_ends timestamptz; v_price numeric(12,2) := round(coalesce(p_price, 0), 2); v_title text := public.market_clean_title(p_title);
begin
  if p_kind not in ('fixed','auction') then return query select false, 'bad_kind', null::bigint; return; end if;
  if v_price < 0.01 then return query select false, 'bad_price', null::bigint; return; end if;
  if char_length(v_title) > 60 then return query select false, 'bad_title', null::bigint; return; end if;
  if array_length(v_cards, 1) is null and array_length(v_packs, 1) is null and array_length(v_boxes, 1) is null then
    return query select false, 'empty_listing', null::bigint; return;
  end if;
  if p_kind = 'auction' then
    if p_hours is null or p_hours <= 0 then return query select false, 'bad_duration', null::bigint; return; end if;
    v_ends := now() + make_interval(mins => round(p_hours * 60)::int);
  end if;
  select count(*) into v_count from public.user_cards c
   where c.id = any(v_cards) and c.user_id = me and c.market_listing_id is null
     and c.cleaning_started_at is null
     and (c.grading_started_at is null or c.graded_at is not null);
  if v_count <> coalesce(array_length(v_cards, 1), 0) then return query select false, 'bad_cards', null::bigint; return; end if;
  select count(*) into v_count from public.user_packs p
   where p.id = any(v_packs) and p.user_id = me and p.market_listing_id is null and p.opened_at is null;
  if v_count <> coalesce(array_length(v_packs, 1), 0) then return query select false, 'bad_packs', null::bigint; return; end if;
  select count(*) into v_count from public.user_boxes b
   where b.id = any(v_boxes) and b.user_id = me and b.market_listing_id is null and b.opened_at is null;
  if v_count <> coalesce(array_length(v_boxes, 1), 0) then return query select false, 'bad_boxes', null::bigint; return; end if;
  insert into public.market_listings (seller_id, kind, price, ends_at, note, title)
  values (me, p_kind, v_price, v_ends, nullif(btrim(coalesce(p_note, '')), ''), v_title) returning id into v_id;
  insert into public.market_listing_items (listing_id, user_card_id) select v_id, unnest(v_cards);
  insert into public.market_listing_items (listing_id, user_pack_id) select v_id, unnest(v_packs);
  insert into public.market_listing_items (listing_id, user_box_id) select v_id, unnest(v_boxes);
  update public.user_cards set market_listing_id = v_id where id = any(v_cards);
  update public.user_packs set market_listing_id = v_id where id = any(v_packs);
  update public.user_boxes set market_listing_id = v_id where id = any(v_boxes);
  -- Up for sale is off the shelf.
  delete from public.showcase_slots where user_id = me and (user_card_id = any(v_cards) or user_box_id = any(v_boxes));
  return query select true, 'ok', v_id;
end $function$;
revoke execute on function public.market_create_listing(text, numeric, bigint[], bigint[], numeric, text, text, bigint[]) from public, anon;
grant execute on function public.market_create_listing(text, numeric, bigint[], bigint[], numeric, text, text, bigint[]) to authenticated;

create or replace function public.market_return_items(p_listing bigint)
returns void
language plpgsql security definer set search_path to 'public' as $function$
begin
  update public.user_cards c set market_listing_id = null
    from public.market_listing_items i
   where i.listing_id = p_listing and c.id = i.user_card_id;
  update public.user_packs p set market_listing_id = null
    from public.market_listing_items i
   where i.listing_id = p_listing and p.id = i.user_pack_id;
  update public.user_boxes b set market_listing_id = null
    from public.market_listing_items i
   where i.listing_id = p_listing and b.id = i.user_box_id;
end $function$;

create or replace function public.market_transfer_items(p_listing bigint, p_to uuid)
returns void
language plpgsql security definer set search_path to 'public' as $function$
begin
  delete from public.showcase_slots s
   using public.market_listing_items i
   where i.listing_id = p_listing and (s.user_card_id = i.user_card_id or s.user_box_id = i.user_box_id);

  update public.user_cards c
     set user_id = p_to, market_listing_id = null
    from public.market_listing_items i
   where i.listing_id = p_listing and c.id = i.user_card_id;

  update public.user_packs p
     set user_id = p_to, market_listing_id = null
    from public.market_listing_items i
   where i.listing_id = p_listing and p.id = i.user_pack_id;

  update public.user_boxes b
     set user_id = p_to, market_listing_id = null
    from public.market_listing_items i
   where i.listing_id = p_listing and b.id = i.user_box_id;
end $function$;

create or replace function public.get_market_listing_items(p_listing bigint)
returns table (item_kind text, name text, number text, rarity character, image_url text, set_code text, grade smallint,
               center_x smallint, center_y smallint, corners smallint, edges smallint, surface smallint, border_wear smallint,
               wear_seed integer, crease smallint, holes smallint, rips smallint)
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
   where i.listing_id = p_listing
  union all
  select 'box'::text, b.name, ub.packs::text, null::char(1), b.image_url, b.set_code,
         null::smallint, 0::smallint, 0::smallint, 100::smallint, 100::smallint,
         100::smallint, 100::smallint, 0, 0::smallint, 0::smallint, 0::smallint
    from public.market_listing_items i
    join public.user_boxes ub on ub.id = i.user_box_id
    join public.vending_boxes b on b.id = ub.box_id
   where i.listing_id = p_listing;
$function$;

-- The listings, as before (v46), with boxes in the preview and their own count (box_count).
drop function if exists public.get_market_listings(boolean);
create function public.get_market_listings(p_mine boolean default false)
returns table (id bigint, seller_id uuid, seller_name text, seller_display text, kind text, note text, price numeric, current_bid numeric,
               is_leading boolean, ends_at timestamp with time zone, status text, created_at timestamp with time zone,
               item_count integer, card_count integer, pack_count integer, preview_image text, preview_name text, preview_grade smallint,
               bid_count integer, preview_images text[], sold_price numeric, fee numeric, sold_to_name text,
               settled_at timestamp with time zone, title text, box_count integer)
language plpgsql security definer set search_path to 'public' as $function$
declare
  me uuid := auth.uid();
begin
  perform public.market_settle_due();

  return query
  with art as (
    select i.listing_id,
           coalesce(vc.image_url, vp.image_url, vb.image_url) as img,
           coalesce(vc.name, vp.pack_name, vb.name) as nm,
           uc.grade as grade,
           row_number() over (
             partition by i.listing_id
             -- A box leads its listing's picture, then the best-graded card.
             order by (i.user_box_id is not null) desc, coalesce(uc.grade, -1) desc, i.id
           ) as ord
      from public.market_listing_items i
      left join public.user_cards uc on uc.id = i.user_card_id
      left join public.vending_cards vc on vc.id = uc.card_id
      left join public.user_packs up on up.id = i.user_pack_id
      left join public.vending_packs vp on vp.id = up.pack_id
      left join public.user_boxes ub on ub.id = i.user_box_id
      left join public.vending_boxes vb on vb.id = ub.box_id
  )
  select l.id, l.seller_id, p.username, p.display_name,
         l.kind, l.note, l.price, l.current_bid,
         (l.current_bidder = me),
         l.ends_at, l.status, l.created_at,
         (select count(*)::int from public.market_listing_items i where i.listing_id = l.id),
         (select count(*)::int from public.market_listing_items i
           where i.listing_id = l.id and i.user_card_id is not null),
         (select count(*)::int from public.market_listing_items i
           where i.listing_id = l.id and i.user_pack_id is not null),
         (select a.img from art a where a.listing_id = l.id and a.ord = 1),
         (select a.nm  from art a where a.listing_id = l.id and a.ord = 1),
         (select a.grade from art a where a.listing_id = l.id and a.grade is not null
           order by a.grade desc limit 1),
         (select count(*)::int from public.market_bids b where b.listing_id = l.id),
         (select array_agg(a.img order by a.ord)
            from art a where a.listing_id = l.id and a.ord <= 5),
         l.sold_price, l.fee,
         (select coalesce(bp.display_name, bp.username) from public.profiles bp where bp.id = l.sold_to),
         l.settled_at,
         l.title,
         (select count(*)::int from public.market_listing_items i
           where i.listing_id = l.id and i.user_box_id is not null)
    from public.market_listings l
    join public.profiles p on p.id = l.seller_id
   where case when p_mine then l.seller_id = me else l.status = 'active' end
   order by case when l.status = 'active' then 0 else 1 end,
            l.ends_at nulls last, l.created_at desc
   limit 120;
end $function$;
revoke execute on function public.get_market_listings(boolean) from public, anon;
grant execute on function public.get_market_listings(boolean) to authenticated;

-- Activity and notices name a listing by its headline item: a box can be that now.
create or replace function public.get_market_activity(p_limit integer default 24)
returns table (at timestamp with time zone, kind text, listing_id bigint, actor text, amount numeric, item_name text, preview_image text, item_count integer)
language sql stable security definer set search_path to 'public' as $function$
  with item_of as (
    select l.id as listing_id,
           coalesce(l.title,
             (select coalesce(vc.name, vp.pack_name, vb.name)
                from public.market_listing_items i
                left join public.user_cards uc on uc.id = i.user_card_id
                left join public.vending_cards vc on vc.id = uc.card_id
                left join public.user_packs up on up.id = i.user_pack_id
                left join public.vending_packs vp on vp.id = up.pack_id
                left join public.user_boxes ub on ub.id = i.user_box_id
                left join public.vending_boxes vb on vb.id = ub.box_id
               where i.listing_id = l.id
               order by (i.user_box_id is not null) desc, coalesce(uc.grade, -1) desc, i.id limit 1)) as nm,
           (select coalesce(vc.image_url, vp.image_url, vb.image_url)
              from public.market_listing_items i
              left join public.user_cards uc on uc.id = i.user_card_id
              left join public.vending_cards vc on vc.id = uc.card_id
              left join public.user_packs up on up.id = i.user_pack_id
              left join public.vending_packs vp on vp.id = up.pack_id
              left join public.user_boxes ub on ub.id = i.user_box_id
              left join public.vending_boxes vb on vb.id = ub.box_id
             where i.listing_id = l.id
             order by (i.user_box_id is not null) desc, coalesce(uc.grade, -1) desc, i.id limit 1) as img,
           (select count(*)::int from public.market_listing_items i
             where i.listing_id = l.id) as n
      from public.market_listings l
  )
  select e.at, e.kind, e.listing_id, e.actor, e.amount, t.nm, t.img, t.n
    from (
      select l.created_at as at, 'listed'::text as kind, l.id as listing_id,
             coalesce(p.display_name, p.username) as actor, l.price as amount
        from public.market_listings l join public.profiles p on p.id = l.seller_id
      union all
      select b.created_at, 'bid', b.listing_id,
             coalesce(p.display_name, p.username), b.amount
        from public.market_bids b join public.profiles p on p.id = b.bidder_id
      union all
      select l.settled_at, 'sold', l.id,
             coalesce(p.display_name, p.username), l.sold_price
        from public.market_listings l join public.profiles p on p.id = l.sold_to
       where l.status = 'sold' and l.settled_at is not null
    ) e
    join item_of t on t.listing_id = e.listing_id
   where auth.uid() is not null
   order by e.at desc
   limit greatest(1, least(coalesce(p_limit, 24), 60));
$function$;

create or replace function public.get_market_notices(p_limit integer default 20)
returns table (id bigint, listing_id bigint, kind text, amount numeric, fee numeric, other_name text, item_name text, preview_image text,
               created_at timestamp with time zone, unread boolean, message text)
language sql stable security definer set search_path to 'public' as $function$
  select n.id, n.listing_id, n.kind, n.amount, n.fee,
         coalesce(p.display_name, p.username),
         coalesce(
           (select l.title from public.market_listings l where l.id = n.listing_id),
           (select coalesce(vc.name, vp.pack_name, vb.name)
              from public.market_listing_items i
              left join public.user_cards uc on uc.id = i.user_card_id
              left join public.vending_cards vc on vc.id = uc.card_id
              left join public.user_packs up on up.id = i.user_pack_id
              left join public.vending_packs vp on vp.id = up.pack_id
              left join public.user_boxes ub on ub.id = i.user_box_id
              left join public.vending_boxes vb on vb.id = ub.box_id
             where i.listing_id = n.listing_id
             order by (i.user_box_id is not null) desc, coalesce(uc.grade, -1) desc, i.id limit 1)),
         (select coalesce(vc.image_url, vp.image_url, vb.image_url)
            from public.market_listing_items i
            left join public.user_cards uc on uc.id = i.user_card_id
            left join public.vending_cards vc on vc.id = uc.card_id
            left join public.user_packs up on up.id = i.user_pack_id
            left join public.vending_packs vp on vp.id = up.pack_id
            left join public.user_boxes ub on ub.id = i.user_box_id
            left join public.vending_boxes vb on vb.id = ub.box_id
           where i.listing_id = n.listing_id
           order by (i.user_box_id is not null) desc, coalesce(uc.grade, -1) desc, i.id limit 1),
         n.created_at, (n.read_at is null), n.message
    from public.market_notices n
    left join public.profiles p on p.id = n.counterparty
   where n.user_id = auth.uid()
   order by n.created_at desc
   limit greatest(1, least(coalesce(p_limit, 20), 50));
$function$;

/* ── The machine: a box sold sealed; Recent buys shows it ── */
create or replace function public.vending_recent_buys(p_limit integer default 6)
returns table (buyer text, icon_file text, packs integer, sets text, bought_at timestamp with time zone)
language sql stable security definer set search_path to 'public' as $function$
  select coalesce(p.display_name, p.username)::text, ti.file::text, x.packs, x.sets, x.at
    from (
      select up.user_id, count(*)::int as packs, string_agg(distinct vp.set_name, ', ')::text as sets, up.acquired_at as at
        from public.user_packs up
        join public.vending_packs vp on vp.id = up.pack_id
       group by up.user_id, up.acquired_at
      union all
      -- A box from the machine (its purchase, so a box resold later still shows): its packs, named by the box.
      select v.user_id, sum(b.packs)::int, string_agg(distinct b.name, ', ')::text, v.bought_at
        from public.user_vending_boxes v
        join public.vending_boxes b on b.id = v.box_id
       group by v.user_id, v.bought_at
    ) x
    join public.profiles p on p.id = x.user_id
    left join public.trainer_icons ti on ti.id = p.trainer_icon_id
   order by x.at desc
   limit greatest(1, least(p_limit, 20));
$function$;

-- Checkout, as before (v62), except that a box is now granted sealed
-- (user_boxes) rather than opened into packs; packs_bought counts single packs only.
create or replace function public.vending_checkout(p_items jsonb, p_tickets jsonb default '[]'::jsonb, p_supplies jsonb default '[]'::jsonb, p_boxes jsonb default '[]'::jsonb)
returns table (ok boolean, reason text, packs_bought integer, spent numeric, balance numeric, restocked boolean, tickets_bought integer, supplies_bought integer, boxes_bought integer)
language plpgsql security definer set search_path to 'public' as $function$
declare
  me           uuid := auth.uid();
  se           public.vending_session;
  v_cycle      bigint;
  v_packs      int := 0;
  v_tickets    int := 0;
  v_supplies   int := 0;
  v_boxes      int := 0;
  v_cost       numeric(12,2) := 0;
  v_balance    numeric(12,2);
  v_cooldown   numeric;
  v_restocked  boolean := false;
  it           record;
  v_have       int;
  v_arts       bigint[];
  v_price      numeric(12,2);
  v_remaining  int;
  v_limit      int;
  v_owned      int;
  v_note       text;
  v_set_total  int;
  v_set_left   int;
  v_kind       text;
  v_contents   jsonb;
  v_box        public.vending_boxes;
begin
  perform 1 from public.vending_state where id for update;
  select * into se from public.vending_session where id for update;

  if se.holder_id is null or se.holder_id <> me or se.expires_at <= now() then
    return query select false, 'not_holder', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
  end if;
  v_cycle := se.cycle_no;

  for it in select (e->>'set_code')::text as set_code, (e->>'qty')::int as qty
              from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) e loop
    if it.qty is null or it.qty <= 0 or it.set_code is null then
      return query select false, 'bad_request', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
    end if;
    select quantity into v_have from public.vending_stock
      where cycle_no = v_cycle and set_code = it.set_code for update;
    if v_have is null or v_have < it.qty then
      return query select false, 'insufficient_stock', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
    end if;

    -- Lifetime inventory for the set, locked so two buyers can't both pass.
    select i.total_quantity, (i.total_quantity - i.claimed_quantity)
      into v_set_total, v_set_left
      from public.vending_set_info i
     where i.set_code = it.set_code for update;
    if v_set_total is not null and coalesce(v_set_left, 0) < it.qty then
      return query select false, 'set_sold_out', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
    end if;

    v_packs := v_packs + it.qty;
    v_cost  := v_cost + it.qty;
  end loop;

  for it in select (e->>'ticket_id')::bigint as ticket_id, (e->>'qty')::int as qty
              from jsonb_array_elements(coalesce(p_tickets, '[]'::jsonb)) e loop
    if it.qty is null or it.qty <= 0 or it.ticket_id is null then
      return query select false, 'bad_request', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
    end if;

    select s.quantity into v_have from public.vending_ticket_stock s
      where s.cycle_no = v_cycle and s.ticket_id = it.ticket_id for update;
    if v_have is null or v_have < it.qty then
      return query select false, 'insufficient_stock', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
    end if;

    select t.token_price, (t.total_quantity - t.claimed_quantity), t.per_user_limit
      into v_price, v_remaining, v_limit
      from public.raffle_tickets t
     where t.id = it.ticket_id and t.is_active
       and (t.starts_at is null or now() >= t.starts_at)
       and (t.ends_at   is null or now() <  t.ends_at)
     for update;

    if v_price is null then
      return query select false, 'ticket_unavailable', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
    end if;
    if v_remaining < it.qty then
      return query select false, 'ticket_sold_out', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
    end if;

    if v_limit is not null then
      select count(*)::int into v_owned
        from public.user_raffle_tickets u
       where u.ticket_id = it.ticket_id and u.user_id = me;
      if v_owned + it.qty > v_limit then
        return query select false, 'ticket_limit_reached', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
      end if;
    end if;

    v_tickets := v_tickets + it.qty;
    v_cost    := v_cost + (it.qty * v_price);
  end loop;

  -- Supplies: on the shelf this cycle, still switched on, and (for a
  -- bundle) still made of real items. The price is read here, under a
  -- share lock, so an admin edit cannot land between charging and granting.
  for it in select (e->>'key')::text as key, (e->>'qty')::int as qty
              from jsonb_array_elements(coalesce(p_supplies, '[]'::jsonb)) e loop
    if it.qty is null or it.qty <= 0 or it.qty > 20 or it.key is null then
      return query select false, 'bad_request', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
    end if;

    if not exists (select 1 from public.vvm_supply_stock st
                    where st.cycle_no = v_cycle and st.supply_key = it.key) then
      return query select false, 'supply_not_stocked', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
    end if;

    select s.token_price, s.kind, s.contents
      into v_price, v_kind, v_contents
      from public.vvm_supplies s
     where s.key = it.key and s.is_active
     for share;

    if v_price is null then
      return query select false, 'supply_unavailable', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
    end if;
    if v_kind = 'bundle' and exists (
         select 1 from jsonb_each(v_contents) c
          where not exists (select 1 from public.vvm_supplies i
                             where i.key = c.key and i.kind = 'item')) then
      return query select false, 'supply_unavailable', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
    end if;

    v_supplies := v_supplies + it.qty;
    v_cost     := v_cost + (it.qty * v_price);
  end loop;

  -- Boxes: on the shelf this cycle, some left, and within your limit. The
  -- box row is locked so two buyers can't both take the last one.
  for it in select (e->>'box_id')::bigint as box_id, (e->>'qty')::int as qty
              from jsonb_array_elements(coalesce(p_boxes, '[]'::jsonb)) e loop
    if it.qty is null or it.qty <= 0 or it.box_id is null then
      return query select false, 'bad_request', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
    end if;

    select s.quantity into v_have from public.vending_box_stock s
      where s.cycle_no = v_cycle and s.box_id = it.box_id for update;
    if v_have is null or v_have < it.qty then
      return query select false, 'insufficient_stock', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
    end if;

    select * into v_box from public.vending_boxes b where b.id = it.box_id and b.is_active for update;
    if v_box.id is null then
      return query select false, 'box_unavailable', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
    end if;
    if v_box.total_quantity - v_box.claimed_quantity < it.qty then
      return query select false, 'box_sold_out', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
    end if;
    if v_box.per_user_limit is not null then
      select count(*)::int into v_owned from public.user_vending_boxes u
       where u.box_id = it.box_id and u.user_id = me and u.bought_at >= v_box.restocked_at;
      if v_owned + it.qty > v_box.per_user_limit then
        return query select false, 'box_limit_reached', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
      end if;
    end if;
    if not exists (select 1 from public.vending_packs vp where vp.set_code = v_box.set_code and vp.is_active) then
      return query select false, 'no_art_for_set', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
    end if;

    v_boxes := v_boxes + it.qty;
    v_cost  := v_cost + (it.qty * v_box.token_price);
  end loop;

  if v_packs + v_tickets + v_supplies + v_boxes = 0 then
    return query select false, 'empty_cart', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
  end if;

  v_balance := public.token_balance(me);
  if v_balance < v_cost then
    return query select false, 'insufficient_tokens', 0, 0::numeric, v_balance, false, 0, 0, 0; return;
  end if;

  for it in select (e->>'set_code')::text as set_code, (e->>'qty')::int as qty
              from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) e loop
    update public.vending_stock
       set quantity = quantity - it.qty
     where cycle_no = v_cycle and set_code = it.set_code;

    update public.vending_set_info
       set claimed_quantity = claimed_quantity + it.qty
     where set_code = it.set_code and total_quantity is not null;

    select array_agg(vp.id) into v_arts
      from public.vending_packs vp
     where vp.set_code = it.set_code and vp.is_active;

    if v_arts is null or array_length(v_arts, 1) is null then
      return query select false, 'no_art_for_set', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
    end if;

    insert into public.user_packs (user_id, pack_id, cycle_no)
    select me, v_arts[1 + floor(random() * array_length(v_arts, 1))::int], v_cycle
      from generate_series(1, it.qty);
  end loop;

  for it in select (e->>'ticket_id')::bigint as ticket_id, (e->>'qty')::int as qty
              from jsonb_array_elements(coalesce(p_tickets, '[]'::jsonb)) e loop
    update public.vending_ticket_stock
       set quantity = quantity - it.qty
     where cycle_no = v_cycle and ticket_id = it.ticket_id;

    update public.raffle_tickets
       set claimed_quantity = claimed_quantity + it.qty
     where id = it.ticket_id;

    insert into public.user_raffle_tickets (user_id, ticket_id, cycle_no)
    select me, it.ticket_id, v_cycle from generate_series(1, it.qty);
  end loop;

  -- Items straight in, bundles opened into their items. One upsert for the
  -- lot, summed per item first, because an upsert cannot touch the same row
  -- twice in one statement (a Potion bought alone and in a bundle would).
  if v_supplies > 0 then
    insert into public.user_items as u (user_id, item_key, qty)
    select me, g.item_key, sum(g.qty)::int
      from (
        select s.key as item_key, l.qty
          from jsonb_to_recordset(coalesce(p_supplies, '[]'::jsonb)) as l(key text, qty int)
          join public.vvm_supplies s on s.key = l.key and s.kind = 'item'
        union all
        select c.key, l.qty * (c.value)::int
          from jsonb_to_recordset(coalesce(p_supplies, '[]'::jsonb)) as l(key text, qty int)
          join public.vvm_supplies b on b.key = l.key and b.kind = 'bundle'
          cross join lateral jsonb_each(b.contents) c
      ) g
     group by g.item_key
    on conflict (user_id, item_key) do update
      set qty = u.qty + excluded.qty, updated_at = now();
  end if;

  -- Boxes, sealed: the purchase (for the limit) and the box itself, opened later (open_box).
  for it in select (e->>'box_id')::bigint as box_id, (e->>'qty')::int as qty
              from jsonb_array_elements(coalesce(p_boxes, '[]'::jsonb)) e loop
    select * into v_box from public.vending_boxes b where b.id = it.box_id;
    update public.vending_box_stock set quantity = quantity - it.qty where cycle_no = v_cycle and box_id = it.box_id;
    update public.vending_boxes set claimed_quantity = claimed_quantity + it.qty where id = it.box_id;
    insert into public.user_vending_boxes (user_id, box_id, cycle_no)
    select me, it.box_id, v_cycle from generate_series(1, it.qty);
    insert into public.user_boxes (user_id, box_id, packs, cycle_no)
    select me, it.box_id, v_box.packs, v_cycle from generate_series(1, it.qty);
  end loop;

  v_note := array_to_string(array_remove(array[
    case when v_boxes > 0
         then v_boxes || ' booster box' || case when v_boxes = 1 then '' else 'es' end end,
    case when v_packs > 0
         then v_packs || ' pack' || case when v_packs = 1 then '' else 's' end end,
    case when v_tickets > 0
         then v_tickets || ' raffle ticket' || case when v_tickets = 1 then '' else 's' end end,
    case when v_supplies > 0
         then v_supplies || ' battle suppl' || case when v_supplies = 1 then 'y' else 'ies' end end
  ], null), ', ');

  perform public.spend_tokens(me, v_cost, 'purchase', v_note);

  -- The cooldown and the restock roll are about packs and tickets (a box is
  -- packs). A supplies-only checkout skips both.
  if v_packs + v_tickets + v_boxes > 0 then
    select cooldown_hours into v_cooldown from public.vending_settings where id;
    update public.profiles
       set vending_cooldown_until = now() + make_interval(hours => floor(v_cooldown)::int,
                                                          mins  => ((v_cooldown - floor(v_cooldown)) * 60)::int)
     where id = me;

    v_restocked := public.maybe_restock(v_cycle);
  end if;

  perform public.vending_release();

  return query select true, 'ok', v_packs, v_cost, public.token_balance(me), v_restocked, v_tickets, v_supplies, v_boxes;
end $function$;

-- The machine's shelf shows the box's own image now.
drop function if exists public.get_vending_box_stock(bigint);
create function public.get_vending_box_stock(p_cycle bigint)
returns table (box_id bigint, set_code text, set_name text, name text, description text, packs integer,
               token_price numeric, quantity integer, remaining integer, per_user_limit integer, owned integer, pack_images text[], image_url text)
language sql stable security definer set search_path to 'public' as $$
  select b.id, b.set_code,
         (select vp.set_name from public.vending_packs vp where vp.set_code = b.set_code limit 1),
         b.name, b.description, b.packs, b.token_price,
         s.quantity,
         (b.total_quantity - b.claimed_quantity),
         b.per_user_limit,
         coalesce((select count(*)::int from public.user_vending_boxes u
                    where u.box_id = b.id and u.user_id = auth.uid() and u.bought_at >= b.restocked_at), 0),
         (select array_agg(vp.image_url order by vp.sort_order) from public.vending_packs vp where vp.set_code = b.set_code and vp.is_active),
         b.image_url
    from public.vending_box_stock s
    join public.vending_boxes b on b.id = s.box_id
   where s.cycle_no = p_cycle and b.is_active and public.is_member()
   order by b.sort_order, b.name;
$$;
revoke execute on function public.get_vending_box_stock(bigint) from public, anon;
grant execute on function public.get_vending_box_stock(bigint) to authenticated;
