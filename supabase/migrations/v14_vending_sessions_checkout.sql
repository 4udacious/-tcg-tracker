-- Virtual vending machine, phase 3: exclusive sessions, checkout, cooldown.
--
-- Exclusivity is what makes this safe rather than merely thematic. Because
-- only one person can hold the machine, checkout needs no defensive locking
-- against other buyers -- nobody else can touch the stock while you hold it.
-- The single contended operation in the whole feature is claiming, which is
-- one row and one invariant:
--
--   update ... set holder = me where holder is null or expires_at < now()
--
-- Whoever's update returns a row owns the machine. Everyone else's returns
-- nothing and is told who beat them.
--
-- Freezing: while the machine is held, the status cycle does not advance, so
-- stock and status cannot shuffle mid-purchase. The frozen duration is added
-- back to ends_at on release, so a hold costs nobody their cycle time.
--
-- Nothing here trusts the client: the holder, the balance, the stock levels
-- and the cooldown are all re-checked inside the transaction that spends.

-- ------------------------------------------------------------ tunable knobs

alter table public.vending_settings
  add column if not exists session_timeout_seconds int not null default 60
    check (session_timeout_seconds between 15 and 600),
  add column if not exists cooldown_hours numeric not null default 3
    check (cooldown_hours >= 0),
  add column if not exists restock_chance numeric not null default 0.20
    check (restock_chance between 0 and 1);

alter table public.vending_state
  add column if not exists frozen_since timestamptz;

alter table public.profiles
  add column if not exists vending_cooldown_until timestamptz;

-- ------------------------------------------------------------------ session

create table if not exists public.vending_session (
  id         boolean primary key default true check (id),
  holder_id  uuid references public.profiles(id) on delete set null,
  claimed_at timestamptz,
  expires_at timestamptz,
  cycle_no   bigint
);

insert into public.vending_session (id) values (true) on conflict (id) do nothing;

-- Packs a member owns. One row per physical pack rather than a quantity, so
-- the pack-opening feature can flip `opened_at` per pack without splitting
-- rows later.
create table if not exists public.user_packs (
  id          bigint generated always as identity primary key,
  user_id     uuid   not null references public.profiles(id) on delete cascade,
  pack_id     bigint not null references public.vending_packs(id),
  cycle_no    bigint not null,
  acquired_at timestamptz not null default now(),
  opened_at   timestamptz
);

create index if not exists user_packs_user_idx on public.user_packs (user_id, acquired_at desc);

-- --------------------------------------------------------------- restocking

-- Rolled after every purchase. If the buyer emptied the machine it reloads a
-- fresh selection so whoever is waiting still has something to buy; if stock
-- remains it tops up instead of replacing.
create or replace function public.maybe_restock(p_cycle bigint)
returns boolean language plpgsql security definer set search_path to 'public' as $$
declare
  v_chance    numeric;
  v_remaining int;
begin
  select restock_chance into v_chance from public.vending_settings where id;
  if random() >= v_chance then
    return false;
  end if;

  select coalesce(sum(quantity), 0) into v_remaining
    from public.vending_stock where cycle_no = p_cycle;

  if v_remaining = 0 then
    -- Cleared out: drop the spent rows and load a brand new selection.
    delete from public.vending_stock where cycle_no = p_cycle;
    perform public.build_vending_stock(p_cycle, false);
  else
    -- Still has stock: top up existing packs, and sometimes add another pack.
    update public.vending_stock
       set quantity = quantity + 1 + floor(random() * 3)::int
     where cycle_no = p_cycle
       and pack_id in (
         select pack_id from public.vending_stock
          where cycle_no = p_cycle order by random() limit 2
       );

    insert into public.vending_stock (cycle_no, pack_id, quantity)
    select p_cycle, p.id, 1 + floor(random() * 4)::int
      from public.vending_packs p
     where p.is_active
       and not exists (select 1 from public.vending_stock s
                        where s.cycle_no = p_cycle and s.pack_id = p.id)
     order by random() limit 1
    on conflict (cycle_no, pack_id) do nothing;
  end if;

  return true;
end $$;

-- ------------------------------------------------------- state, with freeze

-- The signature gains freeze/holder columns, so the old one must go first.
drop function if exists public.get_vending_state();

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

  -- Lazily expire an abandoned hold: someone claimed the machine and their
  -- phone went to sleep. Give back the frozen time so nobody loses a cycle.
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

  -- While held, the cycle is frozen: no advancing, no restock shuffle.
  if se.holder_id is null then
    if st.ends_at < now() - interval '1 hour' then
      st.ends_at := now();
    end if;

    while st.ends_at <= now() and v_guard < 40 loop
      v_guard := v_guard + 1;
      v_roll := random();

      if (st.ends_at - st.last_instock_at) > interval '50 minutes' then
        v_next := 'in_stock';
      elsif v_roll < 0.45 then
        v_next := 'in_stock';
      elsif v_roll < 0.70 then
        v_next := 'out_of_stock';
      elsif v_roll < 0.85 then
        v_next := 'blacked_out';
      else
        v_next := 'maintenance';
      end if;

      if v_next = st.status then
        if v_next = 'blacked_out' then v_next := 'maintenance';
        elsif v_next = 'maintenance' then v_next := 'blacked_out';
        elsif v_next = 'out_of_stock' then v_next := 'in_stock';
        end if;
      end if;

      if v_next in ('blacked_out','maintenance') then
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
           -- A frozen clock reports the time that was left when it froze.
           greatest(0, extract(epoch from (
             st.ends_at - coalesce(st.frozen_since, now())
           ))::int),
           st.frozen_since is not null,
           se.holder_id,
           v_name,
           se.expires_at;
end $$;

-- ------------------------------------------------------------------- claim

create or replace function public.vending_claim()
returns table (ok boolean, reason text, holder_name text, expires_at timestamptz)
language plpgsql security definer set search_path to 'public' as $$
declare
  me        uuid := auth.uid();
  st        record;
  se        public.vending_session;
  v_timeout int;
  v_cooldown timestamptz;
  v_name    text;
begin
  if me is null then
    return query select false, 'not_signed_in', null::text, null::timestamptz; return;
  end if;

  -- Settles any expired hold and advances the cycle if needed.
  select * into st from public.get_vending_state();

  select vending_cooldown_until into v_cooldown from public.profiles where id = me;
  if v_cooldown is not null and v_cooldown > now() then
    return query select false, 'cooldown', null::text, v_cooldown; return;
  end if;

  if st.status <> 'in_stock' then
    return query select false, 'not_stocked', null::text, null::timestamptz; return;
  end if;

  if public.token_balance(me) <= 0 then
    return query select false, 'no_tokens', null::text, null::timestamptz; return;
  end if;

  if coalesce((select sum(quantity) from public.vending_stock where cycle_no = st.cycle_no), 0) <= 0 then
    return query select false, 'empty', null::text, null::timestamptz; return;
  end if;

  select session_timeout_seconds into v_timeout from public.vending_settings where id;
  select * into se from public.vending_session where id for update;

  if se.holder_id is not null and se.holder_id <> me then
    select coalesce(p.display_name, p.username) into v_name
      from public.profiles p where p.id = se.holder_id;
    return query select false, 'busy', v_name, se.expires_at; return;
  end if;

  update public.vending_session
     set holder_id  = me,
         claimed_at = coalesce(claimed_at, now()),
         expires_at = now() + make_interval(secs => v_timeout),
         cycle_no   = st.cycle_no
   where id;

  -- Freeze the status clock for the duration of the hold.
  update public.vending_state set frozen_since = coalesce(frozen_since, now()) where id;

  return query
    select true, 'claimed', null::text, (now() + make_interval(secs => v_timeout));
end $$;

-- Extends the hold. Called while the buyer is actively interacting; the
-- one-minute window is one minute of *inactivity*, not a hard cap.
create or replace function public.vending_heartbeat()
returns timestamptz language plpgsql security definer set search_path to 'public' as $$
declare
  me uuid := auth.uid();
  v_timeout int;
  v_new timestamptz;
begin
  select session_timeout_seconds into v_timeout from public.vending_settings where id;
  update public.vending_session
     set expires_at = now() + make_interval(secs => v_timeout)
   where id and holder_id = me and expires_at > now()
   returning expires_at into v_new;
  return v_new;
end $$;

create or replace function public.vending_release()
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  me uuid := auth.uid();
  v_frozen timestamptz;
begin
  if not exists (select 1 from public.vending_session where id and holder_id = me) then
    return;
  end if;
  select frozen_since into v_frozen from public.vending_state where id for update;
  if v_frozen is not null then
    update public.vending_state
       set ends_at = ends_at + (now() - v_frozen), frozen_since = null
     where id;
  end if;
  update public.vending_session
     set holder_id = null, claimed_at = null, expires_at = null, cycle_no = null
   where id;
end $$;

-- ---------------------------------------------------------------- checkout

-- p_items: [{"pack_id": 1, "qty": 2}, ...]
create or replace function public.vending_checkout(p_items jsonb)
returns table (ok boolean, reason text, packs_bought int, spent int, balance int, restocked boolean)
language plpgsql security definer set search_path to 'public' as $$
declare
  me        uuid := auth.uid();
  se        public.vending_session;
  v_cycle   bigint;
  v_total   int := 0;
  v_balance int;
  v_cooldown numeric;
  v_restocked boolean := false;
  it        record;
  v_have    int;
begin
  -- Always take vending_state before vending_session. Every function here
  -- follows that order; mixing it would risk a deadlock between a checkout
  -- and a concurrent state advance.
  perform 1 from public.vending_state where id for update;
  select * into se from public.vending_session where id for update;

  if se.holder_id is null or se.holder_id <> me or se.expires_at <= now() then
    return query select false, 'not_holder', 0, 0, public.token_balance(me), false; return;
  end if;
  v_cycle := se.cycle_no;

  -- Total up and validate the request before spending anything.
  for it in select (e->>'pack_id')::bigint as pack_id, (e->>'qty')::int as qty
              from jsonb_array_elements(p_items) e loop
    if it.qty is null or it.qty <= 0 then
      return query select false, 'bad_request', 0, 0, public.token_balance(me), false; return;
    end if;
    select quantity into v_have from public.vending_stock
      where cycle_no = v_cycle and pack_id = it.pack_id for update;
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

  -- Commit: decrement stock, hand over the packs, charge the tokens.
  for it in select (e->>'pack_id')::bigint as pack_id, (e->>'qty')::int as qty
              from jsonb_array_elements(p_items) e loop
    update public.vending_stock
       set quantity = quantity - it.qty
     where cycle_no = v_cycle and pack_id = it.pack_id;

    insert into public.user_packs (user_id, pack_id, cycle_no)
    select me, it.pack_id, v_cycle from generate_series(1, it.qty);
  end loop;

  insert into public.token_ledger (user_id, delta, reason, period, note)
  values (me, -v_total, 'purchase', public.current_token_period(),
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

-- -------------------------------------------------------------------- RLS

alter table public.vending_session enable row level security;
alter table public.user_packs      enable row level security;

drop policy if exists vending_session_read on public.vending_session;
create policy vending_session_read on public.vending_session
  for select using (auth.uid() is not null);

drop policy if exists user_packs_read_own on public.user_packs;
create policy user_packs_read_own on public.user_packs
  for select using (user_id = auth.uid() or public.is_mod());
