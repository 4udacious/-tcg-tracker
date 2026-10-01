-- Spend the monthly allowance before earned tokens.
--
-- Until now every token in a period expired together. Members asked for the
-- allowance to be the perishable part: tokens earned by reporting timers are
-- worked for, so they should survive the month-end reset.
--
-- Every ledger row now carries a bucket:
--   allowance - granted monthly, expires with its period
--   earned    - from timer reports, never expires
--
-- Spending always draws allowance first and only reaches earned once the
-- allowance is gone, so an unspent earned token is never consumed by a
-- purchase that the allowance could have covered. A purchase that spans both
-- writes two rows, one per bucket, which keeps every row unambiguous about
-- what it drew from.

alter table public.token_ledger
  add column if not exists bucket text not null default 'allowance'
    check (bucket in ('allowance','earned'));

alter table public.token_ledger drop constraint if exists token_ledger_reason_check;
alter table public.token_ledger add constraint token_ledger_reason_check
  check (reason in ('monthly_grant','admin_adjustment','purchase','refund',
                    'timer_reward','timer_revoked','rebucket'));

-- Existing rows: rewards are earned, everything else is allowance.
update public.token_ledger
   set bucket = 'earned'
 where reason in ('timer_reward','timer_revoked') and bucket <> 'earned';

-- Historical purchases predate buckets, so they all land on allowance. For
-- anyone who spent more than their allowance covered, that leaves the
-- allowance bucket negative - and a negative allowance would EXPIRE at month
-- end, quietly handing them tokens back. Correct those with a net-zero
-- transfer: credit the allowance back to zero, debit the same from earned.
-- Per (user, period) across ALL periods, not just the current one: by the
-- time this runs the month may already have rolled over, leaving the
-- deficits that need correcting sitting in a previous period.
--
-- One statement, so the deficit is measured once rather than the second half
-- re-reading rows the first half just wrote.
with deficit as (
  select user_id, period, sum(delta)::int as allowance
    from public.token_ledger
   where bucket = 'allowance'
   group by user_id, period
  having sum(delta) < 0
)
insert into public.token_ledger (user_id, delta, reason, period, note, bucket)
select user_id, -allowance, 'rebucket', period,
       'Backfill: purchases beyond allowance moved to earned', 'allowance'
  from deficit
union all
select user_id, allowance, 'rebucket', period,
       'Backfill: purchases beyond allowance moved to earned', 'earned'
  from deficit;

-- ------------------------------------------------------------- balances

create or replace function public.allowance_balance(target uuid)
returns int language sql stable security definer set search_path to 'public' as $$
  select coalesce(sum(l.delta), 0)::int
    from public.token_ledger l
   where l.user_id = target
     and l.bucket = 'allowance'
     and (
       not (select s.tokens_expire_monthly from public.vending_settings s where s.id)
       or l.period = public.current_token_period()
     );
$$;

-- Earned tokens are never filtered by period: that is the whole point.
create or replace function public.earned_balance(target uuid)
returns int language sql stable security definer set search_path to 'public' as $$
  select coalesce(sum(l.delta), 0)::int
    from public.token_ledger l
   where l.user_id = target and l.bucket = 'earned';
$$;

create or replace function public.token_balance(target uuid)
returns int language sql stable security definer set search_path to 'public' as $$
  select public.allowance_balance(target) + public.earned_balance(target);
$$;

create or replace function public.token_breakdown()
returns table (total int, allowance int, earned int)
language sql stable security definer set search_path to 'public' as $$
  select public.token_balance(auth.uid()),
         public.allowance_balance(auth.uid()),
         public.earned_balance(auth.uid());
$$;

-- ---------------------------------------------------------------- spending

-- Draws allowance first, then earned, writing one row per bucket touched.
create or replace function public.spend_tokens(
  p_user uuid, p_amount int, p_reason text, p_note text default null
)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v_from_allowance int;
  v_from_earned    int;
begin
  if p_amount <= 0 then
    return;
  end if;

  v_from_allowance := least(p_amount, greatest(0, public.allowance_balance(p_user)));
  v_from_earned    := p_amount - v_from_allowance;

  if v_from_allowance > 0 then
    insert into public.token_ledger (user_id, delta, reason, period, note, bucket)
    values (p_user, -v_from_allowance, p_reason, public.current_token_period(), p_note, 'allowance');
  end if;

  if v_from_earned > 0 then
    insert into public.token_ledger (user_id, delta, reason, period, note, bucket)
    values (p_user, -v_from_earned, p_reason, public.current_token_period(), p_note, 'earned');
  end if;
end $$;

-- ------------------------------------------------------- credits by bucket

create or replace function public.grant_monthly_tokens()
returns table (granted int, skipped int)
language plpgsql security definer set search_path to 'public' as $$
declare
  v_period  date := public.current_token_period();
  v_default int;
  v_granted int;
  v_eligible int;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Only admins can grant tokens';
  end if;

  select s.monthly_allowance into v_default from public.vending_settings s where s.id;

  select count(*) into v_eligible
    from public.profiles p
   where p.role::text <> 'pending'
     and coalesce(p.monthly_token_allowance, v_default) > 0;

  with inserted as (
    insert into public.token_ledger (user_id, delta, reason, period, granted_by, bucket)
    select p.id,
           coalesce(p.monthly_token_allowance, v_default),
           'monthly_grant',
           v_period,
           auth.uid(),
           'allowance'
      from public.profiles p
     where p.role::text <> 'pending'
       and coalesce(p.monthly_token_allowance, v_default) > 0
    on conflict do nothing
    returning 1
  )
  select count(*)::int into v_granted from inserted;

  return query select v_granted, (v_eligible - v_granted)::int;
end $$;

-- Admin top-ups land in `earned` so they do not quietly expire at month end;
-- deductions draw allowance first, like any other spend.
create or replace function public.adjust_tokens(target uuid, amount int, note text default null)
returns int
language plpgsql security definer set search_path to 'public' as $$
declare
  v_balance int;
begin
  if not public.is_admin() then
    raise exception 'Only admins can adjust tokens';
  end if;
  if amount = 0 then
    raise exception 'Adjustment must be non-zero';
  end if;

  perform 1 from public.token_ledger l where l.user_id = target for update;

  v_balance := public.token_balance(target);
  if v_balance + amount < 0 then
    raise exception 'Adjustment would leave a negative balance (have %, adjusting %)', v_balance, amount;
  end if;

  if amount > 0 then
    insert into public.token_ledger (user_id, delta, reason, period, note, granted_by, bucket)
    values (target, amount, 'admin_adjustment', public.current_token_period(), note, auth.uid(), 'earned');
  else
    perform public.spend_tokens(target, -amount, 'admin_adjustment', note);
  end if;

  return public.token_balance(target);
end $$;

-- Timer rewards and their revocations are earned.
create or replace function public.award_timer_report_token()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_per    int;
  v_cap    int;
  v_earned int;
  v_award  int;
begin
  select tokens_per_timer_report, max_earned_tokens_per_month
    into v_per, v_cap
    from public.vending_settings where id;

  if coalesce(v_per, 0) <= 0 then
    return new;
  end if;

  select coalesce(sum(l.delta), 0)::int into v_earned
    from public.token_ledger l
   where l.user_id = new.user_id
     and l.reason in ('timer_reward','timer_revoked')
     and l.period = public.current_token_period();

  v_award := least(v_per, greatest(0, v_cap - v_earned));
  if v_award <= 0 then
    return new;
  end if;

  insert into public.token_ledger (user_id, delta, reason, period, note, source_id, bucket)
  values (new.user_id, v_award, 'timer_reward', public.current_token_period(),
          'Timer report', new.id, 'earned');

  return new;
end $$;

create or replace function public.revoke_timer_report_token()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_id     bigint;
  v_delta  int;
  v_period date;
begin
  select l.id, l.delta, l.period
    into v_id, v_delta, v_period
    from public.token_ledger l
   where l.reason = 'timer_reward' and l.source_id = old.id
   limit 1;

  if v_id is null then
    return old;
  end if;

  insert into public.token_ledger (user_id, delta, reason, period, note, source_id, bucket)
  values (old.user_id, -v_delta, 'timer_revoked', v_period, 'Timer report deleted', old.id, 'earned')
  on conflict do nothing;

  return old;
end $$;

-- ---------------------------------------------------------------- checkout

create or replace function public.vending_checkout(p_items jsonb)
returns table (ok boolean, reason text, packs_bought int, spent int, balance int, restocked boolean)
language plpgsql security definer set search_path to 'public' as $$
declare
  me          uuid := auth.uid();
  se          public.vending_session;
  v_cycle     bigint;
  v_total     int := 0;
  v_balance   int;
  v_cooldown  numeric;
  v_restocked boolean := false;
  it          record;
  v_have      int;
  v_arts      bigint[];
begin
  perform 1 from public.vending_state where id for update;
  select * into se from public.vending_session where id for update;

  if se.holder_id is null or se.holder_id <> me or se.expires_at <= now() then
    return query select false, 'not_holder', 0, 0, public.token_balance(me), false; return;
  end if;
  v_cycle := se.cycle_no;

  for it in select (e->>'set_code')::text as set_code, (e->>'qty')::int as qty
              from jsonb_array_elements(p_items) e loop
    if it.qty is null or it.qty <= 0 or it.set_code is null then
      return query select false, 'bad_request', 0, 0, public.token_balance(me), false; return;
    end if;
    select quantity into v_have from public.vending_stock
      where cycle_no = v_cycle and set_code = it.set_code for update;
    if v_have is null or v_have < it.qty then
      return query select false, 'insufficient_stock', 0, 0, public.token_balance(me), false; return;
    end if;
    v_total := v_total + it.qty;
  end loop;

  if v_total = 0 then
    return query select false, 'empty_cart', 0, 0, public.token_balance(me), false; return;
  end if;

  v_balance := public.token_balance(me);
  if v_balance < v_total then
    return query select false, 'insufficient_tokens', 0, 0, v_balance, false; return;
  end if;

  for it in select (e->>'set_code')::text as set_code, (e->>'qty')::int as qty
              from jsonb_array_elements(p_items) e loop
    update public.vending_stock
       set quantity = quantity - it.qty
     where cycle_no = v_cycle and set_code = it.set_code;

    select array_agg(vp.id) into v_arts
      from public.vending_packs vp
     where vp.set_code = it.set_code and vp.is_active;

    if v_arts is null or array_length(v_arts, 1) is null then
      return query select false, 'no_art_for_set', 0, 0, public.token_balance(me), false; return;
    end if;

    insert into public.user_packs (user_id, pack_id, cycle_no)
    select me, v_arts[1 + floor(random() * array_length(v_arts, 1))::int], v_cycle
      from generate_series(1, it.qty);
  end loop;

  -- Allowance first, then earned.
  perform public.spend_tokens(me, v_total, 'purchase',
    v_total || ' pack' || case when v_total = 1 then '' else 's' end);

  select cooldown_hours into v_cooldown from public.vending_settings where id;
  update public.profiles
     set vending_cooldown_until = now() + make_interval(hours => floor(v_cooldown)::int,
                                                        mins  => ((v_cooldown - floor(v_cooldown)) * 60)::int)
   where id = me;

  v_restocked := public.maybe_restock(v_cycle);

  perform public.vending_release();

  return query select true, 'ok', v_total, v_total, public.token_balance(me), v_restocked;
end $$;

-- ------------------------------------------------------------------ views

create or replace view public.v_token_balances as
  select p.id as user_id,
         p.username,
         p.display_name,
         p.role,
         coalesce(p.monthly_token_allowance,
                  (select s.monthly_allowance from public.vending_settings s where s.id)) as effective_allowance,
         public.token_balance(p.id)     as balance,
         public.allowance_balance(p.id) as allowance_balance,
         public.earned_balance(p.id)    as earned_balance
    from public.profiles p;

grant select on public.v_token_balances to authenticated;
