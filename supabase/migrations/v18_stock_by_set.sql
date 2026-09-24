-- Stock is now sold by SET, not by pack art, and restocks are small.
--
-- Before: each cycle offered 3-7 specific pack arts at 1-6 each, so up to 42
-- packs were available and you bought the exact art you saw.
--
-- Now: a cycle offers 1-5 packs TOTAL spread across sets. Each set on offer
-- shows a single representative art, and the art you actually receive is
-- rolled per pack at checkout. You are buying "a Base Set pack", and which
-- of the three Base Set wrappers you get is luck.
--
-- The scarcity is deliberate and severe: 1-5 packs per restock against 37
-- members means most cycles sell out. The exclusive session, the cooldown
-- and the restock roll are what keep that from being purely first-come.

drop table if exists public.vending_stock;

create table public.vending_stock (
  id              bigint generated always as identity primary key,
  cycle_no        bigint not null,
  set_code        text   not null,
  -- The art shown on the machine for this set this cycle. Fixed at build
  -- time so the display does not shuffle while someone is looking at it.
  display_pack_id bigint not null references public.vending_packs(id) on delete cascade,
  quantity        int    not null check (quantity >= 0),
  unique (cycle_no, set_code)
);

create index vending_stock_cycle_idx on public.vending_stock (cycle_no);

alter table public.vending_stock enable row level security;

drop policy if exists vending_stock_read on public.vending_stock;
create policy vending_stock_read on public.vending_stock
  for select using (auth.uid() is not null);

-- Builds a cycle's offer.
--
-- Note on randomness: the per-unit set pick uses random() in the select list
-- of a generate_series, which is evaluated per row. An uncorrelated scalar
-- subquery would have been evaluated once and handed every unit the same
-- set - the same trap the display-art pick avoids by being correlated.
create or replace function public.build_vending_stock(p_cycle bigint, p_sold_out boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v_total int;
begin
  if p_sold_out then
    -- A sold-out screen should look like a full machine with everything
    -- gone, so show most sets at zero rather than one lonely tile.
    insert into public.vending_stock (cycle_no, set_code, display_pack_id, quantity)
    select p_cycle, s.set_code,
           (select vp.id from public.vending_packs vp
             where vp.set_code = s.set_code and vp.is_active
             order by random() limit 1),
           0
      from (select distinct set_code from public.vending_packs where is_active) s
     where random() < 0.85
    on conflict (cycle_no, set_code) do nothing;
    return;
  end if;

  v_total := 1 + floor(random() * 5)::int;  -- 1..5 packs for the whole cycle

  insert into public.vending_stock (cycle_no, set_code, display_pack_id, quantity)
  with sets as (
    select set_code,
           row_number() over (order by set_code) as rn,
           count(*) over () as n
      from (select distinct set_code from public.vending_packs where is_active) s
  ),
  units as (
    select 1 + floor(random() * (select n from sets limit 1))::int as pick
      from generate_series(1, v_total)
  ),
  agg as (
    select s.set_code, count(*)::int as qty
      from units u
      join sets s on s.rn = u.pick
     group by s.set_code
  )
  select p_cycle, a.set_code,
         -- Correlated on a.set_code, so this is re-evaluated per set.
         (select vp.id from public.vending_packs vp
           where vp.set_code = a.set_code and vp.is_active
           order by random() limit 1),
         a.qty
    from agg a
  on conflict (cycle_no, set_code) do nothing;
end $$;

create or replace function public.get_vending_stock(p_cycle bigint)
returns table (set_code text, set_name text, display_image_url text, quantity int)
language sql stable security definer set search_path to 'public' as $$
  select s.set_code, p.set_name, p.image_url, s.quantity
    from public.vending_stock s
    join public.vending_packs p on p.id = s.display_pack_id
   where s.cycle_no = p_cycle
   order by p.sort_order;
$$;

-- Top-up after a purchase. Small, to match the new scale.
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
    -- Cleared out: load a fresh offer so whoever is waiting has something.
    delete from public.vending_stock where cycle_no = p_cycle;
    perform public.build_vending_stock(p_cycle, false);
  else
    -- Still has stock: quietly add one or two more.
    update public.vending_stock
       set quantity = quantity + 1 + floor(random() * 2)::int
     where cycle_no = p_cycle
       and set_code = (
         select set_code from public.vending_stock
          where cycle_no = p_cycle order by random() limit 1
       );
  end if;

  return true;
end $$;

-- Checkout now takes sets: [{"set_code": "base1", "qty": 2}]
-- The specific wrapper is rolled per pack, which is the point of the change.
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

    -- LATERAL so the wrapper is drawn per pack. A plain subquery here
    -- references only a PL/pgSQL variable, so Postgres would evaluate it
    -- once and hand every pack in the order the same art.
    insert into public.user_packs (user_id, pack_id, cycle_no)
    select me, pick.id, v_cycle
      from generate_series(1, it.qty) g
      cross join lateral (
        select vp.id from public.vending_packs vp
         where vp.set_code = it.set_code and vp.is_active
         order by random() limit 1
      ) pick;
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
