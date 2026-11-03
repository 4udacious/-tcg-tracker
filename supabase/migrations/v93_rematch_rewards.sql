-- Rematch rewards outside the daily battle-token cap.
--
-- A rematch ticket is bought with a token (v89), so its win shouldn't come to
-- nothing because the day's battle tokens (battle_tokens_per_day) are used up.
-- The server keeps count of the tickets each member has taken into the game
-- (rematch_credits.owed): battle_take_items zeroes their user_items row, and
-- a trigger adds what it took. battle_award_rematch() pays a won rematch
-- REMATCH_PAY (2.00, the game's REMATCH_TOKENS) for one of them, outside the
-- cap, and records it in battle_awards as kind 'rematch' (the cap counts only
-- 'tokens'). Each ticket pays at most once; with none owed it answers
-- 'no_ticket' and the game falls back to the capped battle_award_tokens.
--
-- Tickets already taken before this: owed = tickets bought (vvm_supply_buys)
-- less rematch wins already paid. A lost rematch's ticket isn't on record, so
-- a few may be owed one more win than they have tickets for; that's the most
-- it can be off by. Safe to re-run (the backfill only fills members with no row).

create table if not exists public.rematch_credits (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  owed int not null default 0 check (owed >= 0),
  updated_at timestamptz not null default now()
);
alter table public.rematch_credits enable row level security;
-- No policies: only the functions below (security definer) touch it.

alter table public.battle_awards drop constraint if exists battle_awards_kind_check;
alter table public.battle_awards add constraint battle_awards_kind_check check (kind = any (array['pack', 'tokens', 'rematch']));

/** A rematch ticket taken from user_items into the game: one more rematch win owed. */
create or replace function public.rematch_ticket_taken()
returns trigger
language plpgsql security definer set search_path to 'public' as $function$
begin
  if new.item_key like 'rematch\_%' and new.qty < old.qty then
    insert into public.rematch_credits (user_id, owed) values (new.user_id, old.qty - new.qty)
    on conflict (user_id) do update set owed = rematch_credits.owed + excluded.owed, updated_at = now();
  end if;
  return new;
end $function$;
revoke all on function public.rematch_ticket_taken() from public, anon, authenticated;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'user_items_rematch_taken') then
    create trigger user_items_rematch_taken after update of qty on public.user_items
      for each row execute function public.rematch_ticket_taken();
  end if;
end $$;

-- Tickets taken before the trigger: bought, less still on the server, less wins already paid.
insert into public.rematch_credits (user_id, owed)
select b.user_id,
       greatest(0, b.n - coalesce((select sum(u.qty) from public.user_items u where u.user_id = b.user_id and u.item_key like 'rematch\_%'), 0)
                       - (select count(*) from public.battle_awards a where a.user_id = b.user_id and a.source = 'rematch'))
  from (select user_id, sum(qty)::int as n from public.vvm_supply_buys where supply_key like 'rematch\_%' group by user_id) b
on conflict (user_id) do nothing;

/** A won rematch: 2.00 into earned tokens for one of your tickets, outside the daily battle cap. */
create or replace function public.battle_award_rematch()
returns table(ok boolean, reason text, awarded numeric, balance numeric)
language plpgsql security definer set search_path to 'public' as $function$
declare
  me uuid := auth.uid();
  v_pay constant numeric(12,2) := 2.00;   -- REMATCH_TOKENS in public/rpg/game.js
begin
  if not public.battle_rewards_allowed() then
    return query select false, 'not_allowed', 0::numeric, coalesce(public.token_balance(me), 0); return;
  end if;
  perform pg_advisory_xact_lock(hashtext('battle_award:' || me::text));
  update public.rematch_credits set owed = owed - 1, updated_at = now() where user_id = me and owed > 0;
  if not found then
    return query select false, 'no_ticket', 0::numeric, public.token_balance(me); return;
  end if;
  insert into public.token_ledger (user_id, delta, reason, period, note, bucket)
  values (me, v_pay, 'battle_reward', public.current_token_period(), 'Battle — rematch', 'earned');
  insert into public.battle_awards (user_id, kind, amount, source) values (me, 'rematch', v_pay, 'rematch');
  return query select true, 'ok', v_pay, public.token_balance(me);
end $function$;
revoke all on function public.battle_award_rematch() from public, anon;
grant execute on function public.battle_award_rematch() to authenticated;
