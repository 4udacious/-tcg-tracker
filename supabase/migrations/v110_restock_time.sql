-- How long the VVM stays on each stock before it restocks, set by an admin.
--
-- Each stock cycle (in stock or sold out) runs a random length between a
-- shortest and a longest time, picked afresh every restock: 7 to 10 minutes
-- by default, as it has always been. Maintenance breaks stay 2 to 3 minutes.
--
--   vending_settings.restock_min_seconds / restock_max_seconds
--       60 to 3600 (1 to 60 minutes), the shortest no longer than the longest
--   set_vending_restock_time(min_minutes, max_minutes)
--       admins: change it (Admin -> VVM -> Packs, the restock slider)
--   get_vending_state()
--       as before (v17 onwards), but each stock cycle's length comes from the
--       settings instead of a fixed 420-599 seconds
--
-- A change applies from the next restock: the cycle running now keeps its end.
-- Safe to re-run.

alter table public.vending_settings
  add column if not exists restock_min_seconds integer not null default 420,
  add column if not exists restock_max_seconds integer not null default 600;

alter table public.vending_settings drop constraint if exists vending_settings_restock_range;
alter table public.vending_settings add constraint vending_settings_restock_range
  check (restock_min_seconds between 60 and 3600 and restock_max_seconds between restock_min_seconds and 3600);

comment on column public.vending_settings.restock_min_seconds is
  'The shortest a VVM stock cycle (in stock or sold out) runs before the next restock, in seconds (v110).';
comment on column public.vending_settings.restock_max_seconds is
  'The longest a VVM stock cycle runs before the next restock, in seconds (v110).';

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
language plpgsql security definer set search_path to 'public' as $function$
declare
  st         public.vending_state;
  se         public.vending_session;
  v_next     public.vending_status;
  v_roll     numeric;
  v_duration interval;
  v_guard    int := 0;
  v_name     text;
  v_min      int;
  v_max      int;
begin
  select * into st from public.vending_state where id for update;
  select * into se from public.vending_session where id for update;
  -- The admin's restock time (v110): each stock cycle runs v_min to v_max seconds.
  select s.restock_min_seconds, s.restock_max_seconds into v_min, v_max from public.vending_settings s where s.id;
  v_min := coalesce(v_min, 420); v_max := greatest(v_min, coalesce(v_max, 600));

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

      if v_next = st.status then
        if v_next = 'out_of_stock' then
          v_next := 'maintenance';
        elsif v_next = 'maintenance' then
          v_next := 'out_of_stock';
        end if;
      end if;

      if v_next = 'maintenance' then
        v_duration := make_interval(secs => 120 + floor(random() * 60)::int);
      else
        v_duration := make_interval(secs => v_min + floor(random() * (v_max - v_min + 1))::int);
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
end $function$;

/** Admins: each stock cycle from now on runs between these many minutes (1 to 60). Returns what was saved, in seconds. */
create or replace function public.set_vending_restock_time(p_min_minutes numeric, p_max_minutes numeric)
returns table (min_seconds integer, max_seconds integer)
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_min int := round(p_min_minutes * 60);
  v_max int := round(p_max_minutes * 60);
begin
  if not public.is_admin() then
    raise exception 'Only admins can change the restock time';
  end if;
  if v_min is null or v_max is null or v_min < 60 or v_max > 3600 or v_min > v_max then
    raise exception 'A restock takes 1 to 60 minutes, the shortest no longer than the longest' using errcode = '22023';
  end if;
  update public.vending_settings
     set restock_min_seconds = v_min, restock_max_seconds = v_max, updated_at = now(), updated_by = auth.uid()
   where id;
  return query select v_min, v_max;
end $function$;

revoke execute on function public.set_vending_restock_time(numeric, numeric) from public, anon;
grant execute on function public.set_vending_restock_time(numeric, numeric) to authenticated;
