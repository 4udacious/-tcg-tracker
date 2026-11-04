-- The LCS: a virtual local card shop that buys your unwanted cards for a
-- little token each.
--
-- What a card fetches is its rarity's price (lcs_prices, per card in
-- perfect condition) times a condition factor from the card's raw grade
-- (card_grade, the same estimate grading uses):
--   · a holo rare, secret rare or One Piece parallel (H, S, P) is priced on
--     condition: a 10 fetches it all, a 9 80%, an 8 60% ... down to 5% for a 1;
--   · anything else is bulk, and bulk is bulk: full price at 6 and up, 75% at
--     4-5, half for a creased, ripped or holed one.
-- A sale's total plus whatever was left over from the last one (lcs_carry)
-- is paid in whole cents, into earned tokens; the rest of a cent waits for
-- the next sale, so even one common counts for something.
--
-- A sold card isn't deleted: past Market listings, the home feed and
-- highlights still point at it. It's marked sold (lcs_sold_at) and from then
-- on it's no one's: the read policy hides it (from its seller, and from the
-- admins' views too), a trigger refuses any change to it, so it can't be
-- graded, cleaned, listed or cracked, and none can go on a showcase.
--
-- Only raw cards in hand sell: not graded or away being graded, not at the
-- cleaners, not listed on the Market, not on your showcase. Safe to re-run.

alter table public.user_cards add column if not exists lcs_sold_at timestamptz;

create table if not exists public.lcs_prices (
  rarity char(1) primary key,
  price numeric(8,4) not null check (price >= 0)
);
alter table public.lcs_prices enable row level security;
drop policy if exists lcs_prices_read on public.lcs_prices;
create policy lcs_prices_read on public.lcs_prices for select to authenticated using (true);
insert into public.lcs_prices (rarity, price) values
  ('C', 0.005), ('U', 0.010), ('R', 0.030), ('L', 0.030), ('H', 0.150), ('P', 0.200), ('S', 0.300)
on conflict (rarity) do nothing;

create table if not exists public.lcs_sales (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  sold_at timestamptz not null default now(),
  cards integer not null check (cards > 0),
  value numeric(12,4) not null,
  paid numeric(12,2) not null
);
alter table public.lcs_sales enable row level security;
drop policy if exists lcs_sales_read_own on public.lcs_sales;
create policy lcs_sales_read_own on public.lcs_sales for select to authenticated using (user_id = auth.uid() or public.is_mod());
alter table public.user_cards add column if not exists lcs_sale_id bigint references public.lcs_sales(id) on delete set null;

create table if not exists public.lcs_carry (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  carry numeric(8,4) not null default 0 check (carry >= 0 and carry < 0.01)
);
alter table public.lcs_carry enable row level security;
-- No policies: only the functions below (security definer) touch it.

-- Sold cards are no one's: hidden from everyone's reads, admins included.
drop policy if exists user_cards_read_own on public.user_cards;
create policy user_cards_read_own on public.user_cards for select
  using (lcs_sold_at is null and (user_id = auth.uid() or public.is_mod()));

-- ...and frozen: nothing changes a sold card (grading, cleaning, listing, cracking all update it).
create or replace function public.user_cards_sold_frozen()
returns trigger language plpgsql set search_path to 'public' as $function$
begin
  if old.lcs_sold_at is not null then raise exception 'card_sold: this card was sold to the LCS' using errcode = 'P0001'; end if;
  return new;
end $function$;
drop trigger if exists user_cards_sold_frozen on public.user_cards;
create trigger user_cards_sold_frozen before update on public.user_cards
  for each row execute function public.user_cards_sold_frozen();

-- ...and never on a showcase.
create or replace function public.showcase_slot_not_sold()
returns trigger language plpgsql set search_path to 'public' as $function$
begin
  if new.user_card_id is not null and exists (select 1 from public.user_cards where id = new.user_card_id and lcs_sold_at is not null) then
    raise exception 'card_sold: this card was sold to the LCS' using errcode = 'P0001';
  end if;
  return new;
end $function$;
drop trigger if exists showcase_slot_not_sold on public.showcase_slots;
create trigger showcase_slot_not_sold before insert or update on public.showcase_slots
  for each row execute function public.showcase_slot_not_sold();

alter table public.token_ledger drop constraint if exists token_ledger_reason_check;
alter table public.token_ledger add constraint token_ledger_reason_check check (reason = any (array[
  'monthly_grant', 'admin_adjustment', 'purchase', 'refund', 'timer_reward', 'timer_revoked', 'rebucket', 'grading',
  'market_buy', 'market_sale', 'bid_hold', 'bid_refund', 'interest_reward', 'cleaning', 'battle_reward', 'card_sale']));

/** What the LCS pays for one card, in tokens (to 4 places). */
create or replace function public.lcs_card_value(p_rarity text, p_grade integer)
returns numeric language sql stable set search_path to 'public' as $function$
  select round(coalesce((select price from public.lcs_prices where rarity = p_rarity), 0) *
    case
      when p_rarity in ('H', 'S', 'P') then (array[0.05, 0.10, 0.15, 0.20, 0.25, 0.35, 0.45, 0.60, 0.80, 1.00])[greatest(1, least(10, p_grade))]
      when p_grade >= 6 then 1.00
      when p_grade >= 4 then 0.75
      else 0.50
    end, 4)
$function$;

/** Your cards the LCS will buy, each with its price, and the part of a cent waiting from your last sale. */
create or replace function public.lcs_offer()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
declare me uuid := auth.uid();
begin
  if me is null then return jsonb_build_object('carry', 0, 'cards', '[]'::jsonb); end if;
  return jsonb_build_object(
    'carry', coalesce((select carry from public.lcs_carry where user_id = me), 0),
    'cards', coalesce((
      select jsonb_agg(jsonb_build_object('id', u.id, 'value',
        public.lcs_card_value(v.rarity, public.card_grade(u.center_x, u.center_y, u.corners, u.edges, u.surface, u.border_wear, u.crease, u.holes, u.rips))))
      from public.user_cards u join public.vending_cards v on v.id = u.card_id
      where u.user_id = me and u.lcs_sold_at is null and u.market_listing_id is null
        and u.grading_started_at is null and u.graded_at is null and u.cleaning_started_at is null
        and not exists (select 1 from public.showcase_slots s where s.user_card_id = u.id)
    ), '[]'::jsonb));
end $function$;
revoke all on function public.lcs_offer() from public, anon;
grant execute on function public.lcs_offer() to authenticated;

/**
 * Sell these cards to the LCS. All or nothing: if any isn't yours to sell
 * (graded, at the cleaners, listed, on your showcase, already sold) none
 * sell. Up to 1,000 at a time.
 */
create or replace function public.lcs_sell(p_ids bigint[])
returns table(ok boolean, reason text, sold integer, paid numeric, carry numeric, balance numeric)
language plpgsql security definer set search_path to 'public' as $function$
declare
  me uuid := auth.uid(); v_ids bigint[]; v_n integer; v_value numeric; v_carry numeric; v_total numeric; v_pay numeric(12,2); v_sale bigint;
begin
  if me is null then return query select false, 'not_allowed', 0, 0::numeric, 0::numeric, 0::numeric; return; end if;
  select array_agg(distinct x) into v_ids from unnest(coalesce(p_ids, '{}')) x;
  if v_ids is null then return query select false, 'nothing_picked', 0, 0::numeric, 0::numeric, public.token_balance(me); return; end if;
  if cardinality(v_ids) > 1000 then return query select false, 'too_many', 0, 0::numeric, 0::numeric, public.token_balance(me); return; end if;

  with ok_cards as (
    select u.id, v.rarity, public.card_grade(u.center_x, u.center_y, u.corners, u.edges, u.surface, u.border_wear, u.crease, u.holes, u.rips) g
    from public.user_cards u join public.vending_cards v on v.id = u.card_id
    where u.id = any (v_ids) and u.user_id = me and u.lcs_sold_at is null and u.market_listing_id is null
      and u.grading_started_at is null and u.graded_at is null and u.cleaning_started_at is null
      and not exists (select 1 from public.showcase_slots s where s.user_card_id = u.id)
    for update of u
  )
  select count(*), coalesce(sum(public.lcs_card_value(rarity, g)), 0) into v_n, v_value from ok_cards;
  if v_n <> cardinality(v_ids) then return query select false, 'not_sellable', 0, 0::numeric, 0::numeric, public.token_balance(me); return; end if;

  insert into public.lcs_carry (user_id, carry) values (me, 0) on conflict (user_id) do nothing;
  select c.carry into v_carry from public.lcs_carry c where c.user_id = me for update;
  v_total := v_value + v_carry;
  v_pay := floor(v_total * 100) / 100;
  insert into public.lcs_sales (user_id, cards, value, paid) values (me, v_n, v_value, v_pay) returning id into v_sale;
  update public.user_cards set lcs_sold_at = now(), lcs_sale_id = v_sale where id = any (v_ids);
  update public.lcs_carry set carry = v_total - v_pay where user_id = me;
  if v_pay > 0 then
    insert into public.token_ledger (user_id, delta, reason, period, note, bucket)
    values (me, v_pay, 'card_sale', public.current_token_period(), format('Sold %s card%s to the LCS', v_n, case when v_n = 1 then '' else 's' end), 'earned');
  end if;
  return query select true, 'ok', v_n, v_pay::numeric, (v_total - v_pay)::numeric, public.token_balance(me);
end $function$;
revoke all on function public.lcs_sell(bigint[]) from public, anon;
grant execute on function public.lcs_sell(bigint[]) to authenticated;
