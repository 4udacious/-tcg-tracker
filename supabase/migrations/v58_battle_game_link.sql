-- The battle game becomes the VVM's interface, so what it hands out has to
-- be real: real packs into user_packs, real tokens into the ledger, and the
-- battle supplies bought at the real machine into the game's Bag.
--
--   * Three more supplies in the catalog, for things the game sells:
--     gym_summon (always for the buyer's next gym), elite_ticket (the
--     Elite Four), and move_disc (a mystery disc: the game picks the move).
--     All switched off, like v56's, until an admin turns them on.
--
--   * battle_award_pack: a battle won a pack. It comes out of a set's
--     finite inventory (claimed_quantity goes up, exactly as a purchase),
--     not off this cycle's shelf, so buyers aren't shorted. The wrapper is
--     rolled from the set's active art, as at checkout. At most
--     battle_packs_per_day per member per (UTC) day.
--
--   * battle_award_tokens: a battle paid tokens. Into the earned bucket,
--     reason 'battle_reward', at most 5 per call and battle_tokens_per_day
--     per member per day; past the cap it pays what's left (maybe 0).
--
--   * battle_take_items: the game collects supplies bought at the machine
--     into its own Bag (which is the game's save). The named items are
--     zeroed in user_items and their counts returned.
--
-- The game is admin-only while it's built out (app/(play)/play), and these
-- run from the client, so a member could call them without playing. Until
-- vending_settings.battle_rewards_open is switched on, the two award
-- functions answer only admins.

-- ------------------------------------------------------------------ settings

alter table public.vending_settings
  add column if not exists battle_rewards_open    boolean not null default false,
  add column if not exists battle_packs_per_day   integer not null default 3 check (battle_packs_per_day >= 0),
  add column if not exists battle_tokens_per_day  numeric(12,2) not null default 5 check (battle_tokens_per_day >= 0);

alter table public.token_ledger drop constraint if exists token_ledger_reason_check;
alter table public.token_ledger add constraint token_ledger_reason_check
  check (reason = any (array['monthly_grant','admin_adjustment','purchase','refund',
    'timer_reward','timer_revoked','rebucket','grading','market_buy','market_sale',
    'bid_hold','bid_refund','interest_reward','cleaning','battle_reward']));

-- ------------------------------------------------------------------- catalog

insert into public.vvm_supplies
  (key, kind, name, description, token_price, appearance_rate, is_active, sort_order)
values
  ('gym_summon',   'item', 'Gym Summon',        'Summons your next Gym Leader',       3.00, 30, false, 60),
  ('elite_ticket', 'item', 'Elite Four Ticket', 'All five League battles',            5.00, 30, false, 70),
  ('move_disc',    'item', 'Move Disc',         'Teaches a random move, picked when you use it', 1.50, 12, false, 80)
on conflict (key) do nothing;

-- -------------------------------------------------------------------- awards

create table if not exists public.battle_awards (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('pack','tokens')),
  amount      numeric(12,2) not null default 1,
  user_pack_id bigint references public.user_packs(id) on delete set null,
  source      text check (source is null or char_length(source) <= 40),
  created_at  timestamptz not null default now()
);
create index if not exists battle_awards_user_day on public.battle_awards (user_id, kind, created_at desc);

alter table public.battle_awards enable row level security;
drop policy if exists battle_awards_select on public.battle_awards;
create policy battle_awards_select on public.battle_awards
  for select using (user_id = auth.uid() or public.is_mod());
revoke all on public.battle_awards from anon;
revoke insert, update, delete, truncate, references, trigger on public.battle_awards from authenticated;

-- May this caller be paid by a battle right now?
create or replace function public.battle_rewards_allowed()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select auth.uid() is not null and public.is_member()
     and (public.is_admin() or coalesce((select battle_rewards_open from public.vending_settings where id), false))
$$;

create or replace function public.battle_award_pack(p_source text default null)
returns table (ok boolean, reason text, user_pack_id bigint, set_code text,
               set_name text, pack_name text, image_url text, left_today integer)
language plpgsql security definer set search_path to 'public' as $fn$
declare
  me      uuid := auth.uid();
  v_cap   int;
  v_used  int;
  v_set   text;
  v_pack  record;
  v_cycle bigint;
  v_id    bigint;
begin
  if not public.battle_rewards_allowed() then
    return query select false, 'not_allowed', null::bigint, null::text, null::text, null::text, null::text, 0; return;
  end if;

  -- One award at a time per member, so two tabs can't both slip under the cap.
  perform pg_advisory_xact_lock(hashtext('battle_award:' || me::text));
  select battle_packs_per_day into v_cap from public.vending_settings where id;
  select count(*)::int into v_used from public.battle_awards a
   where a.user_id = me and a.kind = 'pack' and a.created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  if v_used >= coalesce(v_cap, 0) then
    return query select false, 'daily_cap', null::bigint, null::text, null::text, null::text, null::text, 0; return;
  end if;

  -- A set with active art and inventory left (null total = unlimited), locked.
  select s.set_code into v_set
    from (select distinct vp.set_code from public.vending_packs vp where vp.is_active and vp.set_code is not null) s
    left join public.vending_set_info i on i.set_code = s.set_code
   where i.total_quantity is null or i.total_quantity - i.claimed_quantity > 0
   order by random() limit 1;
  if v_set is null then
    return query select false, 'no_inventory', null::bigint, null::text, null::text, null::text, null::text, v_cap - v_used; return;
  end if;
  update public.vending_set_info i
     set claimed_quantity = i.claimed_quantity + 1
   where i.set_code = v_set and i.total_quantity is not null
     and i.total_quantity - i.claimed_quantity > 0;

  select vp.id, vp.set_name, vp.pack_name, vp.image_url into v_pack
    from public.vending_packs vp where vp.set_code = v_set and vp.is_active order by random() limit 1;
  select st.cycle_no into v_cycle from public.vending_state st where st.id;

  insert into public.user_packs (user_id, pack_id, cycle_no)
  values (me, v_pack.id, coalesce(v_cycle, 0)) returning id into v_id;
  insert into public.battle_awards (user_id, kind, amount, user_pack_id, source)
  values (me, 'pack', 1, v_id, left(p_source, 40));

  return query select true, 'ok', v_id, v_set, v_pack.set_name, v_pack.pack_name, v_pack.image_url, v_cap - v_used - 1;
end $fn$;

create or replace function public.battle_award_tokens(p_amount numeric, p_source text default null)
returns table (ok boolean, reason text, awarded numeric, balance numeric)
language plpgsql security definer set search_path to 'public' as $fn$
declare
  me      uuid := auth.uid();
  v_cap   numeric(12,2);
  v_used  numeric(12,2);
  v_pay   numeric(12,2);
begin
  if not public.battle_rewards_allowed() then
    return query select false, 'not_allowed', 0::numeric, coalesce(public.token_balance(me), 0); return;
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 5 then
    return query select false, 'bad_amount', 0::numeric, public.token_balance(me); return;
  end if;

  perform pg_advisory_xact_lock(hashtext('battle_award:' || me::text));
  select battle_tokens_per_day into v_cap from public.vending_settings where id;
  select coalesce(sum(a.amount), 0) into v_used from public.battle_awards a
   where a.user_id = me and a.kind = 'tokens' and a.created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  v_pay := least(round(p_amount, 2), greatest(0, coalesce(v_cap, 0) - v_used));
  if v_pay <= 0 then
    return query select false, 'daily_cap', 0::numeric, public.token_balance(me); return;
  end if;

  insert into public.token_ledger (user_id, delta, reason, period, note, bucket)
  values (me, v_pay, 'battle_reward', public.current_token_period(), left('Battle' || coalesce(' — ' || p_source, ''), 200), 'earned');
  insert into public.battle_awards (user_id, kind, amount, source) values (me, 'tokens', v_pay, left(p_source, 40));

  return query select true, 'ok', v_pay, public.token_balance(me);
end $fn$;

create or replace function public.battle_take_items(p_keys text[])
returns table (item_key text, qty integer)
language plpgsql security definer set search_path to 'public' as $fn$
declare
  me uuid := auth.uid();
begin
  if me is null or not public.is_member() then return; end if;
  return query
  with taken as (
    select u.item_key, u.qty from public.user_items u
     where u.user_id = me and u.item_key = any(p_keys) and u.qty > 0
     for update
  ), zeroed as (
    update public.user_items u set qty = 0, updated_at = now()
      from taken t where u.user_id = me and u.item_key = t.item_key
  )
  select t.item_key, t.qty from taken t;
end $fn$;

revoke execute on function public.battle_rewards_allowed() from public, anon;
revoke execute on function public.battle_award_pack(text) from public, anon;
revoke execute on function public.battle_award_tokens(numeric, text) from public, anon;
revoke execute on function public.battle_take_items(text[]) from public, anon;
grant execute on function public.battle_rewards_allowed() to authenticated;
grant execute on function public.battle_award_pack(text) to authenticated;
grant execute on function public.battle_award_tokens(numeric, text) to authenticated;
grant execute on function public.battle_take_items(text[]) to authenticated;
