-- Both sides hear about a sale, and an outbid member hears that their money
-- came back. The notices are written where the money moves, so there is no
-- path that completes a sale without telling the people involved.
--
-- These three are re-stated whole from v31 (as numeric since v34) rather than
-- patched, because plpgsql has no way to add a line to an existing body.

create or replace function public.market_buy(p_listing bigint)
returns table (ok boolean, reason text, spent numeric, balance numeric)
language plpgsql security definer set search_path to 'public' as $$
declare
  me    uuid := auth.uid();
  v     public.market_listings;
  v_fee numeric(12,2);
begin
  select * into v from public.market_listings where id = p_listing for update;

  if v.id is null then
    return query select false, 'gone', 0::numeric, public.token_balance(me); return;
  end if;
  if v.status <> 'active' then
    return query select false, 'not_active', 0::numeric, public.token_balance(me); return;
  end if;
  if v.kind <> 'fixed' then
    return query select false, 'is_auction', 0::numeric, public.token_balance(me); return;
  end if;
  if v.seller_id = me then
    return query select false, 'own_listing', 0::numeric, public.token_balance(me); return;
  end if;
  if public.token_balance(me) < v.price then
    return query select false, 'insufficient_tokens', 0::numeric, public.token_balance(me); return;
  end if;

  perform public.spend_tokens(me, v.price, 'market_buy', 'Listing #' || p_listing);
  v_fee := public.market_pay_seller(p_listing, v.seller_id, v.price);
  perform public.market_transfer_items(p_listing, me);

  update public.market_listings
     set status = 'sold', sold_to = me, sold_price = v.price,
         fee = v_fee, settled_at = now()
   where id = p_listing;

  perform public.market_notify(v.seller_id, p_listing, 'sold',   v.price, v_fee, me);
  perform public.market_notify(me,          p_listing, 'bought', v.price, null, v.seller_id);

  return query select true, 'ok', v.price, public.token_balance(me);
end $$;

create or replace function public.market_place_bid(p_listing bigint, p_amount numeric)
returns table (ok boolean, reason text, current_bid numeric, balance numeric)
language plpgsql security definer set search_path to 'public' as $$
declare
  me      uuid := auth.uid();
  v       public.market_listings;
  v_min   numeric(12,2);
  v_prev  public.market_bids;
  v_split record;
  v_bid   numeric(12,2) := round(coalesce(p_amount, 0), 2);
begin
  select * into v from public.market_listings where id = p_listing for update;

  if v.id is null or v.status <> 'active' or v.kind <> 'auction' then
    return query select false, 'not_active', null::numeric, public.token_balance(me); return;
  end if;
  if v.ends_at <= now() then
    return query select false, 'ended', v.current_bid, public.token_balance(me); return;
  end if;
  if v.seller_id = me then
    return query select false, 'own_listing', v.current_bid, public.token_balance(me); return;
  end if;
  -- Bidding against your own live bid only moves money between your pockets
  -- and inflates the price you will pay.
  if v.current_bidder = me then
    return query select false, 'already_leading', v.current_bid, public.token_balance(me); return;
  end if;

  v_min := case when v.current_bid is null then v.price else v.current_bid + 0.01 end;
  if v_bid < v_min then
    return query select false, 'too_low', v.current_bid, public.token_balance(me); return;
  end if;
  if public.token_balance(me) < v_bid then
    return query select false, 'insufficient_tokens', v.current_bid, public.token_balance(me); return;
  end if;

  select * into v_split from public.hold_tokens(me, v_bid, 'Bid on #' || p_listing);

  insert into public.market_bids (listing_id, bidder_id, amount, from_allowance, from_earned)
  values (p_listing, me, v_bid, v_split.from_allowance, v_split.from_earned);

  -- Give the previous leader their money back, in the buckets it came from,
  -- and tell them why it reappeared.
  select * into v_prev from public.market_bids
   where listing_id = p_listing and status = 'held' and bidder_id <> me
   order by amount desc limit 1;

  if v_prev.id is not null then
    perform public.release_hold(v_prev.bidder_id, v_prev.from_allowance,
                                v_prev.from_earned, 'Outbid on #' || p_listing);
    update public.market_bids set status = 'refunded' where id = v_prev.id;
    perform public.market_notify(v_prev.bidder_id, p_listing, 'outbid', v_bid, null, me);
  end if;

  -- A bid in the last two minutes pushes the end out, so an auction cannot be
  -- won purely by having better timing than everyone else.
  update public.market_listings
     set current_bid = v_bid,
         current_bidder = me,
         ends_at = greatest(ends_at, now() + interval '2 minutes')
   where id = p_listing;

  return query select true, 'ok', v_bid, public.token_balance(me);
end $$;

create or replace function public.market_settle_due()
returns int language plpgsql security definer set search_path to 'public' as $$
declare
  v      public.market_listings;
  v_fee  numeric(12,2);
  v_done int := 0;
begin
  for v in
    select * from public.market_listings
     where status = 'active' and kind = 'auction' and ends_at <= now()
     order by ends_at
     for update skip locked
  loop
    if v.current_bidder is null then
      update public.market_listings
         set status = 'expired', settled_at = now() where id = v.id;
      perform public.market_return_items(v.id);
      perform public.market_notify(v.seller_id, v.id, 'expired', v.price, null, null);
    else
      -- The winner's tokens have been held since they bid; nothing more to
      -- take, only the seller to pay.
      v_fee := public.market_pay_seller(v.id, v.seller_id, v.current_bid);
      perform public.market_transfer_items(v.id, v.current_bidder);

      update public.market_bids set status = 'won'
       where listing_id = v.id and bidder_id = v.current_bidder and status = 'held';

      update public.market_listings
         set status = 'sold', sold_to = v.current_bidder, sold_price = v.current_bid,
             fee = v_fee, settled_at = now()
       where id = v.id;

      perform public.market_notify(v.seller_id,      v.id, 'sold',   v.current_bid, v_fee, v.current_bidder);
      perform public.market_notify(v.current_bidder, v.id, 'bought', v.current_bid, null, v.seller_id);
    end if;
    v_done := v_done + 1;
  end loop;

  return v_done;
end $$;

-- The board gains a fan of up to five item images, and what a settled listing
-- actually fetched. Both preview columns now come from one windowed scan of
-- the items instead of three separate correlated subqueries.
drop function if exists public.get_market_listings(boolean);

create or replace function public.get_market_listings(p_mine boolean default false)
returns table (
  id bigint, seller_id uuid, seller_name text, seller_display text,
  kind text, note text, price numeric, current_bid numeric, is_leading boolean,
  ends_at timestamptz, status text, created_at timestamptz,
  item_count int, card_count int, pack_count int,
  preview_image text, preview_name text, preview_grade smallint,
  bid_count int,
  preview_images text[], sold_price numeric, fee numeric,
  sold_to_name text, settled_at timestamptz
)
language plpgsql security definer set search_path to 'public' as $$
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
         l.settled_at
    from public.market_listings l
    join public.profiles p on p.id = l.seller_id
   where case when p_mine then l.seller_id = me else l.status = 'active' end
   order by case when l.status = 'active' then 0 else 1 end,
            l.ends_at nulls last, l.created_at desc
   limit 120;
end $$;
