-- Virtual grading: pay tokens, wait, then the numbers behind the condition
-- are unsealed and the card carries a grade.
--
-- Cost and wait are settings rather than constants, like every other lever in
-- this economy, defaulting to the 3 tokens / 7 days asked for. A short wait
-- is also the only practical way to test the flow.
--
-- The grade is frozen at collection rather than computed on read. Once a card
-- comes back graded that number is the card's, and retuning the curve later
-- must not silently regrade everyone's collection.

alter table public.vending_settings
  add column if not exists grading_cost int     not null default 3,
  add column if not exists grading_days numeric not null default 7;

alter table public.user_cards
  add column if not exists grading_started_at timestamptz,
  add column if not exists grading_ready_at   timestamptz,
  add column if not exists graded_at          timestamptz,
  add column if not exists grade              smallint check (grade between 1 and 10);

-- Finding the cards a member has out for grading.
create index if not exists user_cards_grading_idx
  on public.user_cards (user_id, grading_ready_at)
  where grading_started_at is not null and graded_at is null;

alter table public.token_ledger drop constraint if exists token_ledger_reason_check;
alter table public.token_ledger add constraint token_ledger_reason_check
  check (reason in ('monthly_grant','admin_adjustment','purchase','refund',
                    'timer_reward','timer_revoked','rebucket','grading'));

-- Readable by any member: the VVM needs the price before it can offer it,
-- and vending_settings itself is not theirs to read.
create or replace function public.grading_settings()
returns table (cost int, days numeric)
language sql stable security definer set search_path to 'public' as $$
  select s.grading_cost, s.grading_days from public.vending_settings s where s.id;
$$;

-- ------------------------------------------------------------------ submit
create or replace function public.submit_for_grading(p_user_card_id bigint)
returns table (ok boolean, reason text, ready_at timestamptz, balance int)
language plpgsql security definer set search_path to 'public' as $$
declare
  me      uuid := auth.uid();
  v_card  public.user_cards;
  v_cost  int;
  v_days  numeric;
  v_ready timestamptz;
begin
  select s.grading_cost, s.grading_days into v_cost, v_days
    from public.vending_settings s where s.id;

  -- Locked, so a double tap cannot pay twice for one card.
  select * into v_card from public.user_cards where id = p_user_card_id for update;

  if v_card.id is null or v_card.user_id <> me then
    return query select false, 'not_yours', null::timestamptz, public.token_balance(me); return;
  end if;
  if v_card.grading_started_at is not null then
    return query select false, 'already_submitted', v_card.grading_ready_at, public.token_balance(me); return;
  end if;
  if public.token_balance(me) < v_cost then
    return query select false, 'insufficient_tokens', null::timestamptz, public.token_balance(me); return;
  end if;

  -- Allowance first, then earned, like every other spend.
  perform public.spend_tokens(me, v_cost, 'grading', 'Grading submission');

  v_ready := now() + make_interval(mins => round(v_days * 24 * 60)::int);
  update public.user_cards
     set grading_started_at = now(),
         grading_ready_at   = v_ready
   where id = p_user_card_id;

  return query select true, 'ok', v_ready, public.token_balance(me);
end $$;

-- ----------------------------------------------------------------- collect
-- Lazy, like the vending cycle: nothing sweeps the table, the grade is struck
-- when the member comes back for it. A card sitting ready is just waiting.
create or replace function public.collect_grade(p_user_card_id bigint)
returns table (ok boolean, reason text, grade int)
language plpgsql security definer set search_path to 'public' as $$
declare
  me uuid := auth.uid();
  v  public.user_cards;
  g  int;
begin
  select * into v from public.user_cards where id = p_user_card_id for update;

  if v.id is null or v.user_id <> me then
    return query select false, 'not_yours', null::int; return;
  end if;
  if v.graded_at is not null then
    return query select true, 'already_graded', v.grade::int; return;
  end if;
  if v.grading_started_at is null then
    return query select false, 'not_submitted', null::int; return;
  end if;
  if now() < v.grading_ready_at then
    return query select false, 'not_ready', null::int; return;
  end if;

  g := public.card_grade(v.center_x, v.center_y, v.corners, v.edges, v.surface, v.border_wear);

  update public.user_cards
     set graded_at = now(), grade = g
   where id = p_user_card_id;

  return query select true, 'ok', g;
end $$;

-- -------------------------------------------------------------- admin knob
drop function if exists public.update_vending_settings(integer, integer, boolean, numeric, integer, integer);

create or replace function public.update_vending_settings(
  p_monthly_allowance integer,
  p_per_cycle_pack_cap integer default null,
  p_tokens_expire_monthly boolean default true,
  p_cooldown_hours numeric default 3,
  p_tokens_per_timer_report integer default 1,
  p_max_earned_tokens_per_month integer default 15,
  p_grading_cost integer default 3,
  p_grading_days numeric default 7
) returns void
language plpgsql security definer set search_path to 'public' as $$
declare
  v_new_until timestamptz;
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
  if p_grading_cost < 0 or p_grading_days < 0 then
    raise exception 'Grading values cannot be negative';
  end if;

  update public.vending_settings
     set monthly_allowance            = p_monthly_allowance,
         per_cycle_pack_cap           = p_per_cycle_pack_cap,
         tokens_expire_monthly        = p_tokens_expire_monthly,
         cooldown_hours               = p_cooldown_hours,
         tokens_per_timer_report      = p_tokens_per_timer_report,
         max_earned_tokens_per_month  = p_max_earned_tokens_per_month,
         grading_cost                 = p_grading_cost,
         grading_days                 = p_grading_days,
         updated_at                   = now(),
         updated_by                   = auth.uid()
   where id;

  -- Shorten (never extend) cooldowns already in flight.
  v_new_until := now() + make_interval(
    hours => floor(p_cooldown_hours)::int,
    mins  => ((p_cooldown_hours - floor(p_cooldown_hours)) * 60)::int
  );

  update public.profiles
     set vending_cooldown_until = case
           when p_cooldown_hours = 0 then null
           else least(vending_cooldown_until, v_new_until)
         end
   where vending_cooldown_until is not null
     and vending_cooldown_until > now();
end $$;
