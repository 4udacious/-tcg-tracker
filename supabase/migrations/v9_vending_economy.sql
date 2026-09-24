-- Virtual vending machine, phase 1: the token economy.
--
-- Design notes
-- ------------
-- Tokens are an append-only ledger rather than a running balance column.
-- A ledger is auditable ("why does this person have 14 tokens?"), reversible,
-- and cannot drift the way an incremented counter can under concurrency.
--
-- Monthly expiry falls out of the data model instead of needing a sweep job:
-- every row is tagged with the `period` (first day of its month) it belongs
-- to, and a balance is only ever summed within the current period. When the
-- month turns over, last month's rows simply stop counting. Nothing to run,
-- nothing to miss, and the history stays intact for auditing.
--
-- Periods are computed in America/Los_Angeles, not UTC, so the month rolls
-- over at local midnight for this (Seattle-based) community rather than at
-- 4-5pm the previous day.
--
-- All writes go through SECURITY DEFINER functions. No client can insert a
-- ledger row directly, so tokens cannot be minted from the browser.

-- ---------------------------------------------------------------- settings

create table if not exists public.vending_settings (
  id                    boolean primary key default true check (id),
  monthly_allowance     int not null default 10 check (monthly_allowance >= 0),
  -- Both of these are policy knobs rather than hardcoded behaviour, so they
  -- can be changed later without a migration.
  tokens_expire_monthly boolean not null default true,
  per_cycle_pack_cap    int check (per_cycle_pack_cap is null or per_cycle_pack_cap > 0),
  updated_at            timestamptz not null default now(),
  updated_by            uuid references public.profiles(id)
);

insert into public.vending_settings (id) values (true) on conflict (id) do nothing;

-- Per-user override of the monthly allowance. NULL = use the global default.
alter table public.profiles
  add column if not exists monthly_token_allowance int
    check (monthly_token_allowance is null or monthly_token_allowance >= 0);

-- ------------------------------------------------------------------ ledger

create table if not exists public.token_ledger (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  delta      int  not null check (delta <> 0),
  reason     text not null check (reason in ('monthly_grant','admin_adjustment','purchase','refund')),
  period     date not null,
  note       text check (note is null or char_length(note) <= 200),
  granted_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- At most one automatic grant per user per month. This is what makes the
-- grant safely re-runnable: a second run inserts nothing rather than paying
-- everyone twice.
create unique index if not exists token_ledger_one_grant_per_period
  on public.token_ledger (user_id, period) where reason = 'monthly_grant';

create index if not exists token_ledger_user_period_idx
  on public.token_ledger (user_id, period);

-- --------------------------------------------------------------- functions

create or replace function public.current_token_period()
returns date language sql stable as $$
  select date_trunc('month', (now() at time zone 'America/Los_Angeles'))::date;
$$;

create or replace function public.token_balance(target uuid)
returns int language sql stable security definer set search_path to 'public' as $$
  select coalesce(sum(l.delta), 0)::int
    from public.token_ledger l
   where l.user_id = target
     and (
       -- When expiry is off, every period counts toward the balance.
       not (select s.tokens_expire_monthly from public.vending_settings s where s.id)
       or l.period = public.current_token_period()
     );
$$;

create or replace view public.v_token_balances as
  select p.id as user_id,
         p.username,
         p.display_name,
         p.role,
         coalesce(p.monthly_token_allowance,
                  (select s.monthly_allowance from public.vending_settings s where s.id)) as effective_allowance,
         public.token_balance(p.id) as balance
    from public.profiles p;

-- Grants the monthly allowance to every approved user for the current period.
-- Safe to run repeatedly: the partial unique index makes re-runs a no-op, so
-- the scheduled job and the manual button can never double-pay.
--
-- Callable by an admin, or by the scheduler (which runs with no JWT, so
-- auth.uid() is null).
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
    insert into public.token_ledger (user_id, delta, reason, period, granted_by)
    select p.id,
           coalesce(p.monthly_token_allowance, v_default),
           'monthly_grant',
           v_period,
           auth.uid()
      from public.profiles p
     where p.role::text <> 'pending'
       and coalesce(p.monthly_token_allowance, v_default) > 0
    on conflict do nothing
    returning 1
  )
  select count(*)::int into v_granted from inserted;

  return query select v_granted, (v_eligible - v_granted)::int;
end;
$$;

-- Ad-hoc admin top-up or deduction, for mid-month adjustments.
-- Refuses to push a balance below zero.
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

  -- Lock this user's rows so two concurrent adjustments can't both read the
  -- same starting balance and each pass the check below.
  perform 1 from public.token_ledger l where l.user_id = target for update;

  v_balance := public.token_balance(target);
  if v_balance + amount < 0 then
    raise exception 'Adjustment would leave a negative balance (have %, adjusting %)', v_balance, amount;
  end if;

  insert into public.token_ledger (user_id, delta, reason, period, note, granted_by)
  values (target, amount, 'admin_adjustment', public.current_token_period(), note, auth.uid());

  return public.token_balance(target);
end;
$$;

create or replace function public.update_vending_settings(
  p_monthly_allowance int,
  p_per_cycle_pack_cap int default null,
  p_tokens_expire_monthly boolean default true
)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can change vending settings';
  end if;
  update public.vending_settings
     set monthly_allowance     = p_monthly_allowance,
         per_cycle_pack_cap    = p_per_cycle_pack_cap,
         tokens_expire_monthly = p_tokens_expire_monthly,
         updated_at            = now(),
         updated_by            = auth.uid()
   where id;
end;
$$;

-- -------------------------------------------------------------------- RLS

alter table public.token_ledger     enable row level security;
alter table public.vending_settings enable row level security;

drop policy if exists token_ledger_read_own on public.token_ledger;
create policy token_ledger_read_own on public.token_ledger
  for select using (user_id = auth.uid() or public.is_mod());

-- Deliberately no insert/update/delete policies: writes happen only through
-- the SECURITY DEFINER functions above.

drop policy if exists vending_settings_read on public.vending_settings;
create policy vending_settings_read on public.vending_settings
  for select using (auth.uid() is not null);

grant select on public.v_token_balances to authenticated;
