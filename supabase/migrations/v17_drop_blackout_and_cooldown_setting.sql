-- Two changes:
--
-- 1. Retire the blacked-out status. It read as "the app is broken" rather
--    than as atmosphere, and maintenance already covers "not usable right
--    now" while actually explaining itself. The enum value is left in place
--    (dropping an enum member is disruptive and buys nothing) but the
--    generator never selects it again, and any machine currently sitting in
--    that state is moved on immediately.
--
--    Its weight is redistributed to keep the share of time the machine is
--    buyable near where it was measured before (~62%):
--      in_stock 50%, out_of_stock 28%, maintenance 22%
--    which works out to roughly 59% of time buyable, since buyable cycles
--    run 7-10 minutes against maintenance at 2-3.
--
-- 2. Expose the purchase cooldown as an admin setting. The column already
--    existed with a 3 hour default; this adds it to the settings function so
--    the admin panel can change it without a migration.

create or replace function public.get_vending_state()
returns table (
  status        text,
  cycle_no      bigint,
  ends_at       timestamptz,
  seconds_left  int,
  frozen        boolean,
  holder_id     uuid,
  holder_name   text,
  holder_expires timestamptz
)
language plpgsql security definer set search_path to 'public' as $$
declare
  st         public.vending_state;
  se         public.vending_session;
  v_next     public.vending_status;
  v_roll     numeric;
  v_duration interval;
  v_guard    int := 0;
  v_name     text;
begin
  select * into st from public.vending_state where id for update;
  select * into se from public.vending_session where id for update;

  if se.holder_id is not null and se.expires_at <= now() then
    if st.frozen_since is not null then
      st.ends_at := st.ends_at + (now() - st.frozen_since);
      st.frozen_since := null;
    end if;
    update public.vending_session
       set holder_id = null, claimed_at = null, expires_at = null, cycle_no = null
     where id;
    se.holder_id := null;
  end if;

  -- A machine left sitting on the retired status should not wait out its
  -- cycle showing a screen we no longer ship.
  if st.status = 'blacked_out' and se.holder_id is null then
    st.ends_at := least(st.ends_at, now());
  end if;

  if se.holder_id is null then
    if st.ends_at < now() - interval '1 hour' then
      st.ends_at := now();
    end if;

    while st.ends_at <= now() and v_guard < 40 loop
      v_guard := v_guard + 1;
      v_roll := random();

      if (st.ends_at - st.last_instock_at) > interval '50 minutes' then
        v_next := 'in_stock';
      elsif v_roll < 0.50 then
        v_next := 'in_stock';
      elsif v_roll < 0.78 then
        v_next := 'out_of_stock';
      else
        v_next := 'maintenance';
      end if;

      -- Never show the same non-buyable screen twice running.
      if v_next = st.status and v_next in ('out_of_stock','maintenance') then
        v_next := 'in_stock';
      end if;

      if v_next = 'maintenance' then
        v_duration := make_interval(secs => 120 + floor(random() * 60)::int);
      else
        v_duration := make_interval(secs => 420 + floor(random() * 180)::int);
      end if;

      st.cycle_no   := st.cycle_no + 1;
      st.status     := v_next;
      st.started_at := st.ends_at;
      st.ends_at    := st.ends_at + v_duration;
      if v_next = 'in_stock' then
        st.last_instock_at := st.started_at;
      end if;

      if v_next in ('in_stock','out_of_stock') then
        perform public.build_vending_stock(st.cycle_no, v_next = 'out_of_stock');
      end if;
    end loop;
  end if;

  update public.vending_state
     set status = st.status, cycle_no = st.cycle_no, started_at = st.started_at,
         ends_at = st.ends_at, last_instock_at = st.last_instock_at,
         frozen_since = st.frozen_since
   where id;

  select coalesce(p.display_name, p.username) into v_name
    from public.profiles p where p.id = se.holder_id;

  return query
    select st.status::text,
           st.cycle_no,
           st.ends_at,
           greatest(0, extract(epoch from (
             st.ends_at - coalesce(st.frozen_since, now())
           ))::int),
           st.frozen_since is not null,
           se.holder_id,
           v_name,
           se.expires_at;
end $$;

-- Gains the cooldown parameter, so the signature changes and the old one
-- must be dropped rather than replaced.
drop function if exists public.update_vending_settings(int, int, boolean);

create or replace function public.update_vending_settings(
  p_monthly_allowance     int,
  p_per_cycle_pack_cap    int default null,
  p_tokens_expire_monthly boolean default true,
  p_cooldown_hours        numeric default 3
)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can change vending settings';
  end if;
  if p_cooldown_hours < 0 then
    raise exception 'Cooldown cannot be negative';
  end if;
  update public.vending_settings
     set monthly_allowance     = p_monthly_allowance,
         per_cycle_pack_cap    = p_per_cycle_pack_cap,
         tokens_expire_monthly = p_tokens_expire_monthly,
         cooldown_hours        = p_cooldown_hours,
         updated_at            = now(),
         updated_by            = auth.uid()
   where id;
end $$;
