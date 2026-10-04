-- Marketplace: member-to-member stands selling cards, slabs and sealed packs,
-- at a fixed price or by timed auction.
--
-- Applied live as v30..v34; consolidated here. Two rules shape everything:
--
--   Listed goods sit in escrow. A listed item carries the listing's id and
--   leaves the collection entirely, so it cannot be sold twice, graded,
--   opened or put on a shelf while someone is buying it. Escrow is only real
--   if the rest of the app honours it, so open_pack, submit_for_grading and
--   set_showcase_slot all refuse listed items - see v33 below.
--
--   Bid money sits in escrow too, and remembers which bucket it came from.
--   Refunding an outbid member to `earned` would let anyone launder expiring
--   allowance into permanent tokens by bidding against themselves, so each
--   hold records its own allowance/earned split and is returned exactly.
--
-- The fee is burned by simply never being credited: the buyer's tokens leave
-- circulation and the seller receives the remainder. Verified by summing the
-- whole ledger before and after a sale.

alter table public.vending_settings
  add column if not exists market_fee_percent int not null default 10
    check (market_fee_percent between 0 and 50);

create table if not exists public.market_listings (
  id             bigserial primary key,
  seller_id      uuid not null references public.profiles(id) on delete cascade,
  kind           text not null check (kind in ('fixed','auction')),
  note           text check (char_length(note) <= 200),
  price          int  not null check (price >= 0),
  current_bid    int,
  current_bidder uuid references public.profiles(id) on delete set null,
  ends_at        timestamptz,
  status         text not null default 'active'
                 check (status in ('active','sold','cancelled','expired')),
  sold_to        uuid references public.profiles(id) on delete set null,
  sold_price     int,
  fee            int,
  created_at     timestamptz not null default now(),
  settled_at     timestamptz,
  -- An auction without an end never settles; a fixed price with one is a lie.
  constraint market_auction_has_end check (
    (kind = 'auction' and ends_at is not null) or
    (kind = 'fixed'   and ends_at is null)
  )
);

create index if not exists market_listings_browse_idx
  on public.market_listings (status, created_at desc);
create index if not exists market_listings_due_idx
  on public.market_listings (ends_at) where status = 'active' and kind = 'auction';
create index if not exists market_listings_seller_idx
  on public.market_listings (seller_id, status);

create table if not exists public.market_listing_items (
  id           bigserial primary key,
  listing_id   bigint not null references public.market_listings(id) on delete cascade,
  user_card_id bigint references public.user_cards(id) on delete cascade,
  user_pack_id bigint references public.user_packs(id) on delete cascade,
  constraint market_item_is_one_thing check (
    (user_card_id is not null)::int + (user_pack_id is not null)::int = 1
  )
);

create index if not exists market_listing_items_listing_idx
  on public.market_listing_items (listing_id);

create table if not exists public.market_bids (
  id             bigserial primary key,
  listing_id     bigint not null references public.market_listings(id) on delete cascade,
  bidder_id      uuid not null references public.profiles(id) on delete cascade,
  amount         int not null check (amount > 0),
  -- What the hold actually took, so it can be given back the same way.
  from_allowance int not null default 0,
  from_earned    int not null default 0,
  status         text not null default 'held'
                 check (status in ('held','refunded','won')),
  created_at     timestamptz not null default now()
);

create index if not exists market_bids_listing_idx
  on public.market_bids (listing_id, created_at desc);
create index if not exists market_bids_held_idx
  on public.market_bids (listing_id) where status = 'held';

alter table public.user_cards
  add column if not exists market_listing_id bigint
    references public.market_listings(id) on delete set null;
alter table public.user_packs
  add column if not exists market_listing_id bigint
    references public.market_listings(id) on delete set null;

create index if not exists user_cards_listed_idx
  on public.user_cards (market_listing_id) where market_listing_id is not null;
create index if not exists user_packs_listed_idx
  on public.user_packs (market_listing_id) where market_listing_id is not null;

alter table public.market_listings      enable row level security;
alter table public.market_listing_items enable row level security;
alter table public.market_bids          enable row level security;

create policy market_listings_read on public.market_listings
  for select using (auth.uid() is not null);
create policy market_listing_items_read on public.market_listing_items
  for select using (auth.uid() is not null);
-- Bids are only your own: seeing who else is bidding invites sniping games.
create policy market_bids_read on public.market_bids
  for select using (bidder_id = auth.uid());

alter table public.token_ledger drop constraint if exists token_ledger_reason_check;
alter table public.token_ledger add constraint token_ledger_reason_check
  check (reason in ('monthly_grant','admin_adjustment','purchase','refund',
                    'timer_reward','timer_revoked','rebucket','grading',
                    'market_buy','market_sale','bid_hold','bid_refund'));
