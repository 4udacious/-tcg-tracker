-- Badge, League, rival and glitcher (story) wins pay in full, outside the
-- daily battle-token limit.
--
-- Until now every battle payout went through battle_award_tokens (v58, v76),
-- which turns down any single award over 5 tokens. Gym Leaders pay 8-20, the
-- League 6-30, Alex up to 20 and Herb and Paul up to 12, so beating them paid
-- nothing ("No tokens this time"), and the smaller ones ate into the day's limit.
--
-- battle_award_milestone(key) pays those wins instead:
--   gym:0 … gym:15            each Gym Leader (Johto 0-7, Kanto 8-15)
--   elite:WILL … elite:LANCE  the Johto Elite Four and Champion
--   kanto:LORELEI … kanto:RED the Kanto Elite Four, Lance and Red
--   rival:0 … rival:6         Alex's seven battles
--   herb:0 … herb:3           Herb's four glitcher battles
--   paul:0 … paul:3           Paul's four
-- The amount is the server's, from the table below (the game's own numbers),
-- never the caller's, and each key pays once per account, ever, so a win
-- can't be claimed twice and a fresh save doesn't pay out again. These awards
-- don't count towards battle_tokens_per_day, and they still need battle
-- rewards to be open (battle_rewards_allowed).
--
-- Everyday battles (wild finds, scalpers, 2v2s) stay under the daily limit.
-- battle_award_tokens no longer turns down an award over 5: it pays up to
-- what's left of the day, as it already did for smaller ones. 50 is the
-- sanity limit now.
--
-- Safe to re-run.

create table if not exists public.battle_milestones (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  key        text not null,
  amount     numeric(12,2) not null,
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.battle_milestones enable row level security;
drop policy if exists battle_milestones_select_own on public.battle_milestones;
create policy battle_milestones_select_own on public.battle_milestones
  for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete, truncate, references, trigger on public.battle_milestones from authenticated;
revoke all on public.battle_milestones from anon;

-- What each win pays, as public/rpg/game.js has it (GYMS, ELITE, KANTO_ELITE,
-- RIVAL_BATTLES, STORY).
create or replace function public.battle_milestone_amount(p_key text)
returns numeric
language sql immutable as $$
  select case
    when p_key in ('gym:0','gym:1','gym:2','gym:3','gym:4','gym:5','gym:6','gym:7') then 8
    when p_key in ('gym:8','gym:9','gym:10','gym:11','gym:12','gym:13','gym:14') then 10
    when p_key = 'gym:15' then 20
    when p_key in ('elite:WILL','elite:KOGA','elite:BRUNO','elite:KAREN') then 6
    when p_key = 'elite:LANCE' then 20
    when p_key in ('kanto:LORELEI','kanto:BRUNO','kanto:AGATHA','kanto:LANCE') then 10
    when p_key = 'kanto:RED' then 30
    when p_key = 'rival:0' then 3
    when p_key = 'rival:1' then 4
    when p_key = 'rival:2' then 5
    when p_key = 'rival:3' then 6
    when p_key = 'rival:4' then 8
    when p_key = 'rival:5' then 12
    when p_key = 'rival:6' then 20
    when p_key = 'herb:0' then 2.5
    when p_key = 'herb:1' then 4
    when p_key = 'herb:2' then 7
    when p_key = 'herb:3' then 10
    when p_key = 'paul:0' then 3
    when p_key = 'paul:1' then 6
    when p_key = 'paul:2' then 8
    when p_key = 'paul:3' then 12
  end::numeric;
$$;

create or replace function public.battle_award_milestone(p_key text)
returns table(ok boolean, reason text, awarded numeric, balance numeric)
language plpgsql security definer set search_path to 'public' as $$
declare
  me     uuid := auth.uid();
  v_pay  numeric(12,2) := public.battle_milestone_amount(p_key);
  v_name text;
begin
  if not public.battle_rewards_allowed() then
    return query select false, 'not_allowed', 0::numeric, coalesce(public.token_balance(me), 0); return;
  end if;
  if v_pay is null then
    return query select false, 'bad_key', 0::numeric, public.token_balance(me); return;
  end if;

  perform pg_advisory_xact_lock(hashtext('battle_award:' || me::text));
  insert into public.battle_milestones (user_id, key, amount) values (me, p_key, v_pay)
  on conflict (user_id, key) do nothing;
  if not found then
    return query select false, 'already_paid', 0::numeric, public.token_balance(me); return;
  end if;

  v_name := case when p_key like 'gym:%' then 'Gym badge' when p_key = 'kanto:RED' then 'Beat Red'
                 when p_key like 'rival:%' then 'Rival battle' when p_key like 'herb:%' or p_key like 'paul:%' then 'Glitcher battle'
                 else 'League win' end;
  insert into public.token_ledger (user_id, delta, reason, period, note, bucket)
  values (me, v_pay, 'battle_reward', public.current_token_period(), left(v_name || ' — ' || p_key, 200), 'earned');

  return query select true, 'ok', v_pay, public.token_balance(me);
end $$;

-- Everyday battles: pay up to what's left of today, instead of turning down anything over 5.
create or replace function public.battle_award_tokens(p_amount numeric, p_source text default null)
returns table(ok boolean, reason text, awarded numeric, balance numeric)
language plpgsql security definer set search_path to 'public' as $$
declare
  me      uuid := auth.uid();
  v_cap   numeric(12,2);
  v_used  numeric(12,2);
  v_pay   numeric(12,2);
begin
  if not public.battle_rewards_allowed() then
    return query select false, 'not_allowed', 0::numeric, coalesce(public.token_balance(me), 0); return;
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 50 then
    return query select false, 'bad_amount', 0::numeric, public.token_balance(me); return;
  end if;

  perform pg_advisory_xact_lock(hashtext('battle_award:' || me::text));
  select battle_tokens_per_day into v_cap from public.vending_settings where id;
  select coalesce(sum(a.amount), 0) into v_used from public.battle_awards a
   where a.user_id = me and a.kind = 'tokens' and a.created_at >= public.battle_day_start();
  v_pay := least(round(p_amount, 2), greatest(0, coalesce(v_cap, 0) - v_used));
  if v_pay <= 0 then
    return query select false, 'daily_cap', 0::numeric, public.token_balance(me); return;
  end if;

  insert into public.token_ledger (user_id, delta, reason, period, note, bucket)
  values (me, v_pay, 'battle_reward', public.current_token_period(), left('Battle' || coalesce(' — ' || p_source, ''), 200), 'earned');
  insert into public.battle_awards (user_id, kind, amount, source) values (me, 'tokens', v_pay, left(p_source, 40));

  return query select true, 'ok', v_pay, public.token_balance(me);
end $$;

revoke all on function public.battle_milestone_amount(text) from public, anon, authenticated;
revoke all on function public.battle_award_milestone(text) from public, anon;
grant execute on function public.battle_award_milestone(text) to authenticated;
