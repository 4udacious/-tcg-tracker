-- Custom titles on market listings, and announcements in market mail.
--
-- A listing has always been named after its best item ("Charizard", or the
-- top card of a bundle). Sellers can now give it their own title instead,
-- up to 60 characters, set when listing or changed at any point while it is
-- still up, auction or fixed price. Clearing it goes back to the item name.
-- The title replaces that name wherever the listing is shown: the board,
-- the detail sheet, the activity feed and market notices.
--
-- Market notices gain an 'announcement' kind with a message of its own, so
-- news about the market reaches everyone in the same place their sales and
-- outbids do (v47 sends the first one).
--
-- Everything here is backward compatible with the client before it: new
-- columns are appended, and market_create_listing's new parameter defaults.

alter table public.market_listings
  add column if not exists title text check (char_length(title) <= 60);

-- One rule for what a title may be: trimmed, inner whitespace collapsed,
-- empty means none.
create or replace function public.market_clean_title(p_title text)
returns text language sql immutable set search_path to 'public' as $$
  select nullif(regexp_replace(btrim(coalesce(p_title, '')), '\s+', ' ', 'g'), '');
$$;

-- ─────────────────────────────────────────────── setting it at listing time
drop function if exists public.market_create_listing(text, numeric, bigint[], bigint[], numeric, text);
create function public.market_create_listing(
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
  -- A cent is the smallest thing anyone can pay, so it is the floor.
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

-- ──────────────────────────────────────────── renaming it while it is up
-- Only the seller, and only while the listing is active: a sold or ended
-- listing's name is part of what was agreed to. Bids do not lock it; the
-- title is a label, not a term of the sale.
create or replace function public.market_set_title(p_listing bigint, p_title text)
returns table (ok boolean, reason text, title text)
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_title text := public.market_clean_title(p_title);
  v_row   public.market_listings;
begin
  select * into v_row from public.market_listings l where l.id = p_listing for update;
  if not found or v_row.seller_id is distinct from auth.uid() then
    return query select false, 'not_yours', null::text; return;
  end if;
  if v_row.status <> 'active' then
    return query select false, 'not_active', v_row.title; return;
  end if;
  if char_length(v_title) > 60 then
    return query select false, 'too_long', v_row.title; return;
  end if;
  update public.market_listings l set title = v_title where l.id = p_listing;
  return query select true, 'ok', v_title;
end $function$;

-- ─────────────────────────────────────────────── showing it: the board
drop function if exists public.get_market_listings(boolean);
create function public.get_market_listings(p_mine boolean default false)
returns table (
  id bigint, seller_id uuid, seller_name text, seller_display text, kind text, note text,
  price numeric, current_bid numeric, is_leading boolean, ends_at timestamptz, status text,
  created_at timestamptz, item_count int, card_count int, pack_count int,
  preview_image text, preview_name text, preview_grade smallint, bid_count int,
  preview_images text[], sold_price numeric, fee numeric, sold_to_name text,
  settled_at timestamptz, title text
)
language plpgsql security definer set search_path to 'public' as $function$
declare
  me uuid := auth.uid();
begin
  perform public.market_settle_due();

  return query
  with art as (
    select i.listing_id,
           coalesce(vc.image_url, vp.image_url) as img,
           coalesce(vc.name, vp.pack_name) as nm,
           uc.grade as grade,
           row_number() over (
             partition by i.listing_id
             order by coalesce(uc.grade, -1) desc, i.id
           ) as ord
      from public.market_listing_items i
      left join public.user_cards uc on uc.id = i.user_card_id
      left join public.vending_cards vc on vc.id = uc.card_id
      left join public.user_packs up on up.id = i.user_pack_id
      left join public.vending_packs vp on vp.id = up.pack_id
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
         -- Five is as many as a fan can show before it is a smear.
         (select array_agg(a.img order by a.ord)
            from art a where a.listing_id = l.id and a.ord <= 5),
         l.sold_price, l.fee,
         (select coalesce(bp.display_name, bp.username) from public.profiles bp where bp.id = l.sold_to),
         l.settled_at,
         l.title
    from public.market_listings l
    join public.profiles p on p.id = l.seller_id
   where case when p_mine then l.seller_id = me else l.status = 'active' end
   order by case when l.status = 'active' then 0 else 1 end,
            l.ends_at nulls last, l.created_at desc
   limit 120;
end $function$;

-- ─────────────────────────────────────────── the feed: titles win there too
create or replace function public.get_market_activity(p_limit int default 24)
returns table (
  at timestamptz, kind text, listing_id bigint, actor text,
  amount numeric, item_name text, preview_image text, item_count int
)
language sql stable security definer set search_path to 'public' as $function$
  with item_of as (
    select l.id as listing_id,
           coalesce(l.title,
             (select coalesce(vc.name, vp.pack_name)
                from public.market_listing_items i
                left join public.user_cards uc on uc.id = i.user_card_id
                left join public.vending_cards vc on vc.id = uc.card_id
                left join public.user_packs up on up.id = i.user_pack_id
                left join public.vending_packs vp on vp.id = up.pack_id
               where i.listing_id = l.id
               order by coalesce(uc.grade, -1) desc, i.id limit 1)) as nm,
           (select coalesce(vc.image_url, vp.image_url)
              from public.market_listing_items i
              left join public.user_cards uc on uc.id = i.user_card_id
              left join public.vending_cards vc on vc.id = uc.card_id
              left join public.user_packs up on up.id = i.user_pack_id
              left join public.vending_packs vp on vp.id = up.pack_id
             where i.listing_id = l.id
             order by coalesce(uc.grade, -1) desc, i.id limit 1) as img,
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
   -- Members only; this is a community record, not a public one.
   where auth.uid() is not null
   order by e.at desc
   limit greatest(1, least(coalesce(p_limit, 24), 60));
$function$;

-- ─────────────────────────────────────── market mail: announcements, titles
alter table public.market_notices drop constraint if exists market_notices_kind_check;
alter table public.market_notices add constraint market_notices_kind_check
  check (kind in ('sold','bought','outbid','expired','announcement'));
alter table public.market_notices
  add column if not exists message text check (char_length(message) <= 280);

drop function if exists public.get_market_notices(int);
create function public.get_market_notices(p_limit int default 20)
returns table (
  id bigint, listing_id bigint, kind text, amount numeric, fee numeric,
  other_name text, item_name text, preview_image text,
  created_at timestamptz, unread boolean, message text
)
language sql stable security definer set search_path to 'public' as $function$
  select n.id, n.listing_id, n.kind, n.amount, n.fee,
         coalesce(p.display_name, p.username),
         coalesce(
           (select l.title from public.market_listings l where l.id = n.listing_id),
           (select coalesce(vc.name, vp.pack_name)
              from public.market_listing_items i
              left join public.user_cards uc on uc.id = i.user_card_id
              left join public.vending_cards vc on vc.id = uc.card_id
              left join public.user_packs up on up.id = i.user_pack_id
              left join public.vending_packs vp on vp.id = up.pack_id
             where i.listing_id = n.listing_id
             order by coalesce(uc.grade, -1) desc, i.id limit 1)),
         (select coalesce(vc.image_url, vp.image_url)
            from public.market_listing_items i
            left join public.user_cards uc on uc.id = i.user_card_id
            left join public.vending_cards vc on vc.id = uc.card_id
            left join public.user_packs up on up.id = i.user_pack_id
            left join public.vending_packs vp on vp.id = up.pack_id
           where i.listing_id = n.listing_id
           order by coalesce(uc.grade, -1) desc, i.id limit 1),
         n.created_at, (n.read_at is null), n.message
    from public.market_notices n
    left join public.profiles p on p.id = n.counterparty
   where n.user_id = auth.uid()
   order by n.created_at desc
   limit greatest(1, least(coalesce(p_limit, 20), 50));
$function$;
