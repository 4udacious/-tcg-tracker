-- Telling people what happened to their listings, and a public record of
-- what the market has been doing.
--
-- NOTE: the activity feed makes bidding public. market_bids itself is still
-- read-restricted to your own rows, but get_market_activity names the bidder
-- through a SECURITY DEFINER function. That is a deliberate reversal of the
-- earlier call to keep bids private (which was made to discourage sniping
-- games); a visible market was worth more than that protection.

create table public.market_notices (
  id           bigserial primary key,
  user_id      uuid   not null references public.profiles(id) on delete cascade,
  listing_id   bigint references public.market_listings(id) on delete cascade,
  kind         text   not null check (kind in ('sold','bought','outbid','expired')),
  -- What the thing went for, and what the market kept. Recorded on the notice
  -- rather than read back from the listing, so the number someone was told
  -- cannot drift from the number they see later.
  amount       numeric(12,2),
  fee          numeric(12,2),
  counterparty uuid   references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  read_at      timestamptz
);

create index market_notices_unread_idx
  on public.market_notices (user_id, created_at desc)
  where read_at is null;

alter table public.market_notices enable row level security;

create policy "read own notices" on public.market_notices
  for select using (user_id = auth.uid());

-- Marking read is the only thing a member may change, and only on their own
-- rows. Everything else is written by the functions below.
create policy "mark own notices read" on public.market_notices
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.market_notify(
  p_user uuid, p_listing bigint, p_kind text,
  p_amount numeric default null, p_fee numeric default null, p_other uuid default null
) returns void
language sql security definer set search_path to 'public' as $$
  insert into public.market_notices (user_id, listing_id, kind, amount, fee, counterparty)
  values (p_user, p_listing, p_kind, p_amount, p_fee, p_other);
$$;

create or replace function public.get_market_notices(p_limit int default 20)
returns table (
  id bigint, listing_id bigint, kind text, amount numeric, fee numeric,
  other_name text, item_name text, preview_image text,
  created_at timestamptz, unread boolean
)
language sql stable security definer set search_path to 'public' as $$
  select n.id, n.listing_id, n.kind, n.amount, n.fee,
         coalesce(p.display_name, p.username),
         (select coalesce(vc.name, vp.pack_name)
            from public.market_listing_items i
            left join public.user_cards uc on uc.id = i.user_card_id
            left join public.vending_cards vc on vc.id = uc.card_id
            left join public.user_packs up on up.id = i.user_pack_id
            left join public.vending_packs vp on vp.id = up.pack_id
           where i.listing_id = n.listing_id
           order by coalesce(uc.grade, -1) desc, i.id limit 1),
         (select coalesce(vc.image_url, vp.image_url)
            from public.market_listing_items i
            left join public.user_cards uc on uc.id = i.user_card_id
            left join public.vending_cards vc on vc.id = uc.card_id
            left join public.user_packs up on up.id = i.user_pack_id
            left join public.vending_packs vp on vp.id = up.pack_id
           where i.listing_id = n.listing_id
           order by coalesce(uc.grade, -1) desc, i.id limit 1),
         n.created_at, (n.read_at is null)
    from public.market_notices n
    left join public.profiles p on p.id = n.counterparty
   where n.user_id = auth.uid()
   order by n.created_at desc
   limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

create or replace function public.mark_market_notices_read()
returns int language sql security definer set search_path to 'public' as $$
  with done as (
    update public.market_notices
       set read_at = now()
     where user_id = auth.uid() and read_at is null
    returning 1
  ) select count(*)::int from done;
$$;

-- The feed: listings going up, bids landing, sales closing, newest first.
-- One shared stream rather than per-member history, so an empty-looking
-- market still shows signs of life.
create or replace function public.get_market_activity(p_limit int default 24)
returns table (
  at timestamptz, kind text, listing_id bigint, actor text,
  amount numeric, item_name text, preview_image text, item_count int
)
language sql stable security definer set search_path to 'public' as $$
  with item_of as (
    select l.id as listing_id,
           (select coalesce(vc.name, vp.pack_name)
              from public.market_listing_items i
              left join public.user_cards uc on uc.id = i.user_card_id
              left join public.vending_cards vc on vc.id = uc.card_id
              left join public.user_packs up on up.id = i.user_pack_id
              left join public.vending_packs vp on vp.id = up.pack_id
             where i.listing_id = l.id
             order by coalesce(uc.grade, -1) desc, i.id limit 1) as nm,
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
$$;
