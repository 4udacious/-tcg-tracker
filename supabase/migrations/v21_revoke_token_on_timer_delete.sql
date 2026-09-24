-- Deleting a timer report takes the token back.
--
-- Recorded as a separate 'timer_revoked' row rather than by deleting the
-- award, so the history shows what happened. The unique index on
-- (reason, source_id) covers both reasons independently: one award and at
-- most one revocation per report.
--
-- The revocation is dated to the AWARD's period, not today. Deleting a
-- report from a previous month would otherwise deduct from this month's
-- balance for a token that already expired - punishing twice for one report.
--
-- Balances are allowed to go negative, deliberately: that is what makes
-- log-delete-relog pointless. Earning is capped on the NET of awards and
-- revocations, so the ceiling cannot be farmed by churning reports.

alter table public.token_ledger drop constraint if exists token_ledger_reason_check;
alter table public.token_ledger add constraint token_ledger_reason_check
  check (reason in ('monthly_grant','admin_adjustment','purchase','refund','timer_reward','timer_revoked'));

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

  -- No award to take back (logged while earning was off, or already at cap).
  if v_id is null then
    return old;
  end if;

  insert into public.token_ledger (user_id, delta, reason, period, note, source_id)
  values (old.user_id, -v_delta, 'timer_revoked', v_period, 'Timer report deleted', old.id)
  on conflict do nothing;

  return old;
end $$;

drop trigger if exists timer_report_revokes_token on public.timer_reports;
create trigger timer_report_revokes_token
  after delete on public.timer_reports
  for each row execute function public.revoke_timer_report_token();

-- Earned-this-period must net off revocations, so a deleted report frees up
-- headroom again rather than permanently consuming a slot.
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

  insert into public.token_ledger (user_id, delta, reason, period, note, source_id)
  values (new.user_id, v_award, 'timer_reward', public.current_token_period(),
          'Timer report', new.id)
  on conflict do nothing;

  return new;
end $$;

create or replace function public.timer_reward_status()
returns table (earned int, cap int, per_report int, balance int)
language sql stable security definer set search_path to 'public' as $$
  select coalesce((
           select sum(l.delta)::int from public.token_ledger l
            where l.user_id = auth.uid()
              and l.reason in ('timer_reward','timer_revoked')
              and l.period = public.current_token_period()
         ), 0),
         s.max_earned_tokens_per_month,
         s.tokens_per_timer_report,
         public.token_balance(auth.uid())
    from public.vending_settings s where s.id;
$$;
