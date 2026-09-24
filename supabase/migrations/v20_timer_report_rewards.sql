-- Earn a token for reporting a vending timer, hit or miss, up to a monthly cap.
--
-- Awarded by a trigger on timer_reports rather than by the client calling an
-- RPC after logging. A client-side award can simply not be made - by a bug, a
-- dropped request, or someone using the API directly - and it could also be
-- called without a report existing. The trigger cannot be bypassed or forged.
--
-- The award is keyed to the report via token_ledger.source_id with a unique
-- index, so a report can never be paid for twice.
--
-- Note on deletes: removing a timer report does not claw the token back, and
-- logging a fresh report earns again. The monthly cap is what bounds this -
-- somebody can reach the cap with throwaway reports, but no faster than they
-- could with real ones, and they cannot exceed it.

alter table public.vending_settings
  add column if not exists tokens_per_timer_report int not null default 1
    check (tokens_per_timer_report >= 0),
  add column if not exists max_earned_tokens_per_month int not null default 15
    check (max_earned_tokens_per_month >= 0);

-- Ledger gains a reason and a link back to what earned it.
alter table public.token_ledger drop constraint if exists token_ledger_reason_check;
alter table public.token_ledger add constraint token_ledger_reason_check
  check (reason in ('monthly_grant','admin_adjustment','purchase','refund','timer_reward'));

alter table public.token_ledger
  add column if not exists source_id bigint;

-- One award per timer report, ever.
create unique index if not exists token_ledger_one_award_per_source
  on public.token_ledger (reason, source_id) where source_id is not null;

-- How much a member has earned from reports this period, and the ceiling.
create or replace function public.timer_reward_status()
returns table (earned int, cap int, per_report int, balance int)
language sql stable security definer set search_path to 'public' as $$
  select coalesce((
           select sum(l.delta)::int from public.token_ledger l
            where l.user_id = auth.uid()
              and l.reason = 'timer_reward'
              and l.period = public.current_token_period()
         ), 0),
         s.max_earned_tokens_per_month,
         s.tokens_per_timer_report,
         public.token_balance(auth.uid())
    from public.vending_settings s where s.id;
$$;

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
     and l.reason = 'timer_reward'
     and l.period = public.current_token_period();

  -- Pay the remainder if the next award would cross the cap, so the last
  -- report before the ceiling is not silently worth nothing.
  v_award := least(v_per, greatest(0, v_cap - v_earned));
  if v_award <= 0 then
    return new;
  end if;

  insert into public.token_ledger (user_id, delta, reason, period, note, source_id)
  values (new.user_id, v_award, 'timer_reward', public.current_token_period(),
          'Timer report', new.id)
  on conflict do nothing;

  return new;
end $$;

drop trigger if exists timer_report_awards_token on public.timer_reports;
create trigger timer_report_awards_token
  after insert on public.timer_reports
  for each row execute function public.award_timer_report_token();

-- Settings function gains the two new knobs (signature change, so drop first).
drop function if exists public.update_vending_settings(int, int, boolean, numeric);

create or replace function public.update_vending_settings(
  p_monthly_allowance          int,
  p_per_cycle_pack_cap         int default null,
  p_tokens_expire_monthly      boolean default true,
  p_cooldown_hours             numeric default 3,
  p_tokens_per_timer_report    int default 1,
  p_max_earned_tokens_per_month int default 15
)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can change vending settings';
  end if;
  if p_cooldown_hours < 0 then
    raise exception 'Cooldown cannot be negative';
  end if;
  if p_tokens_per_timer_report < 0 or p_max_earned_tokens_per_month < 0 then
    raise exception 'Reward values cannot be negative';
  end if;
  update public.vending_settings
     set monthly_allowance            = p_monthly_allowance,
         per_cycle_pack_cap           = p_per_cycle_pack_cap,
         tokens_expire_monthly        = p_tokens_expire_monthly,
         cooldown_hours               = p_cooldown_hours,
         tokens_per_timer_report      = p_tokens_per_timer_report,
         max_earned_tokens_per_month  = p_max_earned_tokens_per_month,
         updated_at                   = now(),
         updated_by                   = auth.uid()
   where id;
end $$;
