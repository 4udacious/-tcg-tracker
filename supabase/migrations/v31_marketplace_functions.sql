-- Marketplace behaviour. Schema is in v30_marketplace.sql.

-- Holding money for a bid, recording which bucket each token came from so
-- the refund can put it back the same way. Allowance first, like every other
-- spend in this economy.
create or replace function public.hold_tokens(
  p_user uuid, p_amount int, p_note text
) returns table (from_allowance int, from_earned int)
language plpgsql security definer set search_path to 'public' as $$
declare
  v_a int;
  v_e int;
begin
  v_a := least(p_amount, greatest(0, public.allowance_balance(p_user)));
  v_e := p_amount - v_a;

  if v_a > 0 then
    insert into public.token_ledger (user_id, delta, reason, period, note, bucket)
    values (p_user, -v_a, 'bid_hold', public.current_token_period(), p_note, 'allowance');
  end if;
  if v_e > 0 then
    insert into public.token_ledger (user_id, delta, reason, period, note, bucket)
    values (p_user, -v_e, 'bid_hold', public.current_token_period(), p_note, 'earned');
  end if;

  return query select v_a, v_e;
end $$;

create or replace function public.release_hold(
  p_user uuid, p_allowance int, p_earned int, p_note text
) returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if p_allowance > 0 then
    insert into public.token_ledger (user_id, delta, reason, period, note, bucket)
    values (p_user, p_allowance, 'bid_refund', public.current_token_period(), p_note, 'allowance');
  end if;
  if p_earned > 0 then
    insert into public.token_ledger (user_id, delta, reason, period, note, bucket)
    values (p_user, p_earned, 'bid_refund', public.current_token_period(), p_note, 'earned');
  end if;
end $$;

-- Moving the goods. Also clears any showcase slot holding a sold card: the
-- seller's shelf must not keep displaying something they no longer own.
create or replace function public.market_transfer_items(p_listing bigint, p_to uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  delete from public.showcase_slots s
   using public.market_listing_items i
   where i.listing_id = p_listing and s.user_card_id = i.user_card_id;

  update public.user_cards c
     set user_id = p_to, market_listing_id = null
    from public.market_listing_items i
   where i.listing_id = p_listing and c.id = i.user_card_id;

  update public.user_packs p
     set user_id = p_to, market_listing_id = null
    from public.market_listing_items i
   where i.listing_id = p_listing and p.id = i.user_pack_id;
end $$;

/** Hand the goods back to the seller, for a cancelled or unsold listing. */
create or replace function public.market_return_items(p_listing bigint)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  update public.user_cards c set market_listing_id = null
    from public.market_listing_items i
   where i.listing_id = p_listing and c.id = i.user_card_id;
  update public.user_packs p set market_listing_id = null
    from public.market_listing_items i
   where i.listing_id = p_listing and p.id = i.user_pack_id;
end $$;

-- ------------------------------------------------------------------ create
create or replace function public.market_create_listing(
  p_kind text,
  p_price int,
  p_card_ids bigint[],
  p_pack_ids bigint[],
  p_hours numeric default null,
  p_note text default null
) returns table (ok boolean, reason text, listing_id bigint)
language plpgsql security definer set search_path to 'public' as $$
declare
  me        uuid := auth.uid();
  v_id      bigint;
  v_cards   bigint[] := coalesce(p_card_ids, '{}');
  v_packs   bigint[] := coalesce(p_pack_ids, '{}');
  v_count   int;
  v_ends    timestamptz;
begin
  if p_kind not in ('fixed','auction') then
    return query select false, 'bad_kind', null::bigint; return;
  end if;
  if p_price < 1 then
    return query select false, 'bad_price', null::bigint; return;
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

  -- Every card must be yours, free, and not away at the graders. Counting
  -- the rows that qualify and comparing is cheaper than looping, and treats
  -- a partially-invalid basket as entirely invalid, which is what the seller
  -- would want.
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

  insert into public.market_listings (seller_id, kind, price, ends_at, note)
  values (me, p_kind, p_price, v_ends, nullif(btrim(coalesce(p_note, '')), ''))
  returning id into v_id;

  insert into public.market_listing_items (listing_id, user_card_id)
  select v_id, unnest(v_cards);
  insert into public.market_listing_items (listing_id, user_pack_id)
  select v_id, unnest(v_packs);

  -- Into escrow, and off the shelf if it was on one.
  update public.user_cards set market_listing_id = v_id where id = any(v_cards);
  update public.user_packs set market_listing_id = v_id where id = any(v_packs);
  delete from public.showcase_slots where user_id = me and user_card_id = any(v_cards);

  return query select true, 'ok', v_id;
end $$;

-- ------------------------------------------------------------------ cancel
create or replace function public.market_cancel_listing(p_listing bigint)
returns table (ok boolean, reason text)
language plpgsql security definer set search_path to 'public' as $$
declare
  me uuid := auth.uid();
  v  public.market_listings;
begin
  select * into v from public.market_listings where id = p_listing for update;

  if v.id is null or v.seller_id <> me then
    return query select false, 'not_yours'; return;
  end if;
  if v.status <> 'active' then
    return query select false, 'not_active'; return;
  end if;
  -- Pulling a listing out from under a live bid would be a bait and switch.
  if v.kind = 'auction' and v.current_bidder is not null then
    return query select false, 'has_bids'; return;
  end if;

  update public.market_listings
     set status = 'cancelled', settled_at = now() where id = p_listing;
  perform public.market_return_items(p_listing);

  return query select true, 'ok';
end $$;

-- Paying a seller: the fee is simply never credited, so it leaves
-- circulation. Proceeds land in `earned`, because they were.
create or replace function public.market_pay_seller(
  p_listing bigint, p_seller uuid, p_amount int
) returns int
language plpgsql security definer set search_path to 'public' as $$
declare
  v_pct int;
  v_fee int;
begin
  select market_fee_percent into v_pct from public.vending_settings where id;
  v_fee := floor(p_amount * coalesce(v_pct, 0) / 100.0)::int;

  insert into public.token_ledger (user_id, delta, reason, period, note, bucket)
  values (p_seller, p_amount - v_fee, 'market_sale', public.current_token_period(),
          'Sale #' || p_listing, 'earned');

  return v_fee;
end $$;

-- --------------------------------------------------------------- buy now
create or replace function public.market_buy(p_listing bigint)
returns table (ok boolean, reason text, spent int, balance int)
language plpgsql security definer set search_path to 'public' as $$
declare
  me    uuid := auth.uid();
  v     public.market_listings;
  v_fee int;
begin
  select * into v from public.market_listings where id = p_listing for update;

  if v.id is null then
    return query select false, 'gone', 0, public.token_balance(me); return;
  end if;
  if v.status <> 'active' then
    return query select false, 'not_active', 0, public.token_balance(me); return;
  end if;
  if v.kind <> 'fixed' then
    return query select false, 'is_auction', 0, public.token_balance(me); return;
  end if;
  if v.seller_id = me then
    return query select false, 'own_listing', 0, public.token_balance(me); return;
  end if;
  if public.token_balance(me) < v.price then
    return query select false, 'insufficient_tokens', 0, public.token_balance(me); return;
  end if;

  perform public.spend_tokens(me, v.price, 'market_buy', 'Listing #' || p_listing);
  v_fee := public.market_pay_seller(p_listing, v.seller_id, v.price);
  perform public.market_transfer_items(p_listing, me);

  update public.market_listings
     set status = 'sold', sold_to = me, sold_price = v.price,
         fee = v_fee, settled_at = now()
   where id = p_listing;

  return query select true, 'ok', v.price, public.token_balance(me);
end $$;

-- ------------------------------------------------------------------- bid
create or replace function public.market_place_bid(p_listing bigint, p_amount int)
returns table (ok boolean, reason text, current_bid int, balance int)
language plpgsql security definer set search_path to 'public' as $$
declare
  me       uuid := auth.uid();
  v        public.market_listings;
  v_min    int;
  v_prev   public.market_bids;
  v_split  record;
begin
  select * into v from public.market_listings where id = p_listing for update;

  if v.id is null or v.status <> 'active' or v.kind <> 'auction' then
    return query select false, 'not_active', null::int, public.token_balance(me); return;
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

  v_min := case when v.current_bid is null then v.price else v.current_bid + 1 end;
  if p_amount < v_min then
    return query select false, 'too_low', v.current_bid, public.token_balance(me); return;
  end if;
  if public.token_balance(me) < p_amount then
    return query select false, 'insufficient_tokens', v.current_bid, public.token_balance(me); return;
  end if;

  select * into v_split from public.hold_tokens(me, p_amount, 'Bid on #' || p_listing);

  insert into public.market_bids (listing_id, bidder_id, amount, from_allowance, from_earned)
  values (p_listing, me, p_amount, v_split.from_allowance, v_split.from_earned);

  -- Give the previous leader their money back, in the buckets it came from.
  select * into v_prev from public.market_bids
   where listing_id = p_listing and status = 'held' and bidder_id <> me
   order by amount desc limit 1;

  if v_prev.id is not null then
    perform public.release_hold(v_prev.bidder_id, v_prev.from_allowance,
                                v_prev.from_earned, 'Outbid on #' || p_listing);
    update public.market_bids set status = 'refunded' where id = v_prev.id;
  end if;

  -- A bid in the last two minutes pushes the end out, so an auction cannot be
  -- won purely by having better timing than everyone else.
  update public.market_listings
     set current_bid = p_amount,
         current_bidder = me,
         ends_at = greatest(ends_at, now() + interval '2 minutes')
   where id = p_listing;

  return query select true, 'ok', p_amount, public.token_balance(me);
end $$;

-- ---------------------------------------------------------------- settle
-- Lazy, like the vending cycle and like grading: nothing sweeps the table,
-- whoever opens the market settles anything that has run out. Safe to call
-- from any read, and cheap when there is nothing due.
create or replace function public.market_settle_due()
returns int language plpgsql security definer set search_path to 'public' as $$
declare
  v      public.market_listings;
  v_fee  int;
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
    end if;
    v_done := v_done + 1;
  end loop;

  return v_done;
end $$;

-- ------------------------------------------------------------------ reads
-- The board. Settles anything due first, so a buyer never sees a won auction
-- still offering itself for sale.
--
-- `is_leading` rather than `leading`: the latter is reserved by Postgres for
-- trim(leading ...) and will not parse as a column name.
create or replace function public.get_market_listings(p_mine boolean default false)
returns table (
  id bigint, seller_id uuid, seller_name text, seller_display text,
  kind text, note text, price int, current_bid int, is_leading boolean,
  ends_at timestamptz, status text, created_at timestamptz,
  item_count int, card_count int, pack_count int,
  preview_image text, preview_name text, preview_grade smallint,
  bid_count int
)
language plpgsql security definer set search_path to 'public' as $$
declare
  me uuid := auth.uid();
begin
  perform public.market_settle_due();

  return query
  select l.id, l.seller_id, p.username, p.display_name,
         l.kind, l.note, l.price, l.current_bid,
         (l.current_bidder = me),
         l.ends_at, l.status, l.created_at,
         (select count(*)::int from public.market_listing_items i where i.listing_id = l.id),
         (select count(*)::int from public.market_listing_items i
           where i.listing_id = l.id and i.user_card_id is not null),
         (select count(*)::int from public.market_listing_items i
           where i.listing_id = l.id and i.user_pack_id is not null),
         -- One representative item for the card art on the listing tile:
         -- the best-graded card if there is one, else whatever comes first.
         (select coalesce(vc.image_url, vp.image_url)
            from public.market_listing_items i
            left join public.user_cards uc on uc.id = i.user_card_id
            left join public.vending_cards vc on vc.id = uc.card_id
            left join public.user_packs up on up.id = i.user_pack_id
            left join public.vending_packs vp on vp.id = up.pack_id
           where i.listing_id = l.id
           order by coalesce(uc.grade, -1) desc, i.id limit 1),
         (select coalesce(vc.name, vp.pack_name)
            from public.market_listing_items i
            left join public.user_cards uc on uc.id = i.user_card_id
            left join public.vending_cards vc on vc.id = uc.card_id
            left join public.user_packs up on up.id = i.user_pack_id
            left join public.vending_packs vp on vp.id = up.pack_id
           where i.listing_id = l.id
           order by coalesce(uc.grade, -1) desc, i.id limit 1),
         (select uc.grade
            from public.market_listing_items i
            join public.user_cards uc on uc.id = i.user_card_id
           where i.listing_id = l.id and uc.graded_at is not null
           order by uc.grade desc limit 1),
         (select count(*)::int from public.market_bids b where b.listing_id = l.id)
    from public.market_listings l
    join public.profiles p on p.id = l.seller_id
   where case when p_mine then l.seller_id = me else l.status = 'active' end
   order by case when l.status = 'active' then 0 else 1 end,
            l.ends_at nulls last, l.created_at desc
   limit 120;
end $$;

/** Everything inside one listing, for the detail view. */
create or replace function public.get_market_listing_items(p_listing bigint)
returns table (
  item_kind text, name text, number text, rarity char(1), image_url text,
  set_code text, grade smallint,
  center_x smallint, center_y smallint, corners smallint, edges smallint,
  surface smallint, border_wear smallint, wear_seed int
)
language sql stable security definer set search_path to 'public' as $$
  select 'card'::text, vc.name, vc.number, vc.rarity, vc.image_url, vc.set_code,
         case when uc.graded_at is not null then uc.grade else null end,
         uc.center_x, uc.center_y, uc.corners, uc.edges,
         uc.surface, uc.border_wear, uc.wear_seed
    from public.market_listing_items i
    join public.user_cards uc on uc.id = i.user_card_id
    join public.vending_cards vc on vc.id = uc.card_id
   where i.listing_id = p_listing
  union all
  select 'pack'::text, vp.pack_name, null::text, null::char(1), vp.image_url, vp.set_code,
         null::smallint, 0::smallint, 0::smallint, 100::smallint, 100::smallint,
         100::smallint, 100::smallint, 0
    from public.market_listing_items i
    join public.user_packs up on up.id = i.user_pack_id
    join public.vending_packs vp on vp.id = up.pack_id
   where i.listing_id = p_listing;
$$;

-- Members need the fee to quote "you keep N" before they list, but
-- vending_settings is not theirs to read.
create or replace function public.market_fee_percent()
returns int language sql stable security definer set search_path to 'public' as $$
  select s.market_fee_percent from public.vending_settings s where s.id;
$$;

-- NOTE: v33 also re-created open_pack, submit_for_grading and
-- set_showcase_slot with one extra guard each, refusing items whose
-- market_listing_id is set. Those definitions live with their own features;
-- escrow is only real because they honour it.
