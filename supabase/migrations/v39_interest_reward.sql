-- A fortnightly reward for keeping your interest check current.
--
-- Periods run 1st-14th and 15th-end of month, so there are two a month and
-- they never drift. A member qualifies by having added something to their
-- interest list inside the current period: product_interest records
-- created_at, which makes "did you touch your list this fortnight" a
-- question the database can answer, where "did you adjust it" in the
-- abstract is not.
--
-- Claims are tracked in their own table rather than by scanning the ledger.
-- The ledger's `period` column means the monthly token period and is load
-- bearing for allowance expiry; overloading it with a fortnight would have
-- quietly changed what expires when.

alter table public.vending_settings
  add column if not exists interest_reward_tokens numeric(12,2) not null default 15
    check (interest_reward_tokens >= 0);

create table if not exists public.interest_rewards (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  period     date not null,
  amount     numeric(12,2) not null,
  granted_at timestamptz not null default now(),
  primary key (user_id, period)
);

alter table public.interest_rewards enable row level security;
create policy interest_rewards_read_own on public.interest_rewards
  for select using (user_id = auth.uid() or public.is_mod());

alter table public.token_ledger drop constraint if exists token_ledger_reason_check;
alter table public.token_ledger add constraint token_ledger_reason_check
  check (reason in ('monthly_grant','admin_adjustment','purchase','refund',
                    'timer_reward','timer_revoked','rebucket','grading',
                    'market_buy','market_sale','bid_hold','bid_refund',
                    'interest_reward'));

/** The fortnight containing a moment: the 1st or the 15th. */
create or replace function public.interest_period(p_at timestamptz default now())
returns date language sql immutable as $$
  select case when extract(day from p_at) < 15
              then date_trunc('month', p_at)::date
              else (date_trunc('month', p_at) + interval '14 days')::date
         end;
$$;

/** Where a member stands this fortnight, for the banner on the interest page. */
create or replace function public.interest_reward_status()
returns table (
  amount numeric, period_start date, period_ends date,
  updated boolean, claimed boolean
)
language sql stable security definer set search_path to 'public' as $$
  select s.interest_reward_tokens,
         public.interest_period(),
         case when extract(day from now()) < 15
              then (date_trunc('month', now()) + interval '14 days')::date
              else (date_trunc('month', now()) + interval '1 month')::date
         end,
         exists (select 1 from public.product_interest pi
                  where pi.user_id = auth.uid()
                    and pi.created_at >= public.interest_period()),
         exists (select 1 from public.interest_rewards r
                  where r.user_id = auth.uid()
                    and r.period = public.interest_period())
    from public.vending_settings s where s.id;
$$;

-- Lazy, like everything else here: no cron, the member collects it.
create or replace function public.claim_interest_reward()
returns table (ok boolean, reason text, amount numeric, balance numeric)
language plpgsql security definer set search_path to 'public' as $$
declare
  me       uuid := auth.uid();
  v_amount numeric(12,2);
  v_period date := public.interest_period();
begin
  if me is null then
    return query select false, 'not_signed_in', 0::numeric, 0::numeric; return;
  end if;

  select s.interest_reward_tokens into v_amount from public.vending_settings s where s.id;
  if coalesce(v_amount, 0) <= 0 then
    return query select false, 'reward_off', 0::numeric, public.token_balance(me); return;
  end if;

  if not exists (select 1 from public.product_interest pi
                  where pi.user_id = me and pi.created_at >= v_period) then
    return query select false, 'not_updated', v_amount, public.token_balance(me); return;
  end if;

  -- The primary key is what actually prevents a double claim; two tabs
  -- racing both pass the check above.
  begin
    insert into public.interest_rewards (user_id, period, amount)
    values (me, v_period, v_amount);
  exception when unique_violation then
    return query select false, 'already_claimed', v_amount, public.token_balance(me); return;
  end;

  insert into public.token_ledger (user_id, delta, reason, period, note, bucket)
  values (me, v_amount, 'interest_reward', public.current_token_period(),
          'Interest check kept current', 'earned');

  return query select true, 'ok', v_amount, public.token_balance(me);
end $$;

-- update_vending_settings also gained p_interest_reward_tokens; see the live
-- definition, which is otherwise unchanged from v37.
