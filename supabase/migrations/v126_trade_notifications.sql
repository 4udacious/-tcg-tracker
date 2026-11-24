-- Trades and bids reach the other member's notification bell.
--
-- Trades: every offer already flags the member it concerns (trade_offers.to_seen / from_seen, v100), but only the
-- Trades tab's badge read them. trade_updates() lists them, saying who did what, for the bell:
--   to you, still open: 'offer' (a new one) or 'counter' (an answer to one of yours);
--   from you, answered: 'accepted', 'declined', 'failed' (it couldn't go through), or 'countered' (only when the
--   counter itself is no longer waiting, since an open counter already shows as 'counter').
-- Opening the Trades page marks them seen, as before (trade_mark_seen). trade_unseen(), the tab's badge, now counts
-- the same list, so a counter-offer is one update rather than two.
--
-- Bids: a new bid on an auction tells its seller ('bid' market notice). One unread notice per listing, kept to the
-- latest bid and bidder, so a bidding war doesn't fill the bell. Outbids already tell the member outbid (v31).
--
-- Safe to re-run.

alter table public.market_notices drop constraint if exists market_notices_kind_check;
alter table public.market_notices add constraint market_notices_kind_check
  check (kind in ('sold', 'bought', 'outbid', 'expired', 'announcement', 'bid'));

/** Your trades that need a look: offers to you, and answers to yours, newest first. */
create or replace function public.trade_updates()
returns table (offer_id bigint, kind text, other_name text, at timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select u.offer_id, u.kind, u.other_name, u.at from (
    select o.id as offer_id, case when o.counter_of is null then 'offer' else 'counter' end as kind,
           coalesce(p.display_name, p.username) as other_name, o.created_at as at
      from public.trade_offers o
      left join public.profiles p on p.id = o.from_user
     where o.to_user = auth.uid() and not o.to_seen and o.status = 'pending'
    union all
    select o.id, o.status, coalesce(p.display_name, p.username), coalesce(o.resolved_at, o.created_at)
      from public.trade_offers o
      left join public.profiles p on p.id = o.to_user
     where o.from_user = auth.uid() and not o.from_seen
       and o.status in ('accepted', 'declined', 'failed', 'countered')
       -- A counter shows once: as the new offer, while that's waiting for you.
       and not (o.status = 'countered' and exists (
             select 1 from public.trade_offers c
              where c.counter_of = o.id and c.to_user = auth.uid() and not c.to_seen and c.status = 'pending'))
  ) u
  order by u.at desc
$$;

/** The Trades tab's badge: how many of those there are. */
create or replace function public.trade_unseen()
returns integer
language sql stable security definer set search_path to 'public' as $$
  select count(*)::int from public.trade_updates()
$$;

revoke all on function public.trade_updates() from public, anon;
grant execute on function public.trade_updates() to authenticated;
revoke all on function public.trade_unseen() from public, anon;
grant execute on function public.trade_unseen() to authenticated;

/** v31's bid, now telling the seller too. */
create or replace function public.market_place_bid(p_listing bigint, p_amount numeric)
returns table(ok boolean, reason text, current_bid numeric, balance numeric)
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

  select * into v_prev from public.market_bids
   where listing_id = p_listing and status = 'held' and bidder_id <> me
   order by amount desc limit 1;

  if v_prev.id is not null then
    perform public.release_hold(v_prev.bidder_id, v_prev.from_allowance,
                                v_prev.from_earned, 'Outbid on #' || p_listing);
    update public.market_bids set status = 'refunded' where id = v_prev.id;
    perform public.market_notify(v_prev.bidder_id, p_listing, 'outbid', v_bid, null, me);
  end if;

  -- The seller hears of it: one unread notice per listing, kept to the latest bid.
  update public.market_notices set amount = v_bid, counterparty = me, created_at = now()
   where user_id = v.seller_id and listing_id = p_listing and kind = 'bid' and read_at is null;
  if not found then
    perform public.market_notify(v.seller_id, p_listing, 'bid', v_bid, null, me);
  end if;

  update public.market_listings
     set current_bid = v_bid,
         current_bidder = me,
         ends_at = greatest(ends_at, now() + interval '2 minutes')
   where id = p_listing;

  return query select true, 'ok', v_bid, public.token_balance(me);
end $$;
