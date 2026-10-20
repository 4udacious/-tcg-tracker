-- Battle supplies in the vending machine: single items and admin-made
-- bundles, bought with tokens off the same shelf as the packs and raffle
-- tickets.
--
-- Applied to the live database with every supply switched off: nothing
-- reaches the shelf until an admin turns it on in Machine Items, and there
-- is nothing to use them on until the battle game is ported. The app as
-- deployed before this keeps working against it (the new checkout defaults
-- p_supplies to an empty list), and the new app only sends p_supplies when
-- supplies are in the cart.
--
-- Shaped like the raffle tickets (v10):
--   vvm_supplies      the catalog: items, and bundles of items
--   vvm_supply_stock  which supplies sit in the machine for a given cycle
--   user_items        what each member holds, one row per item with a count
--
-- appearance_rate is the percent chance a supply is rolled onto the shelf
-- when the machine stocks, the way rarity is for tickets. The roll happens
-- once, in build_vending_stock, so everyone sees the same shelf for a
-- cycle. Unlike packs and tickets, a supply on the shelf has no count: they
-- are consumables, and the scarcity lives in the packs. A checkout line is
-- capped at 20 as a sanity limit.
--
-- A bundle sells as one thing and lands in user_items as its separate
-- items, so the battle game only ever deals with items. A bundle may hold
-- an item that is not sold on its own (the Great Ball starts that way),
-- which makes the bundle the only way to get one.
--
-- Two deliberate departures from how packs and tickets check out:
--   * A checkout of supplies alone does not start the purchase cooldown. A
--     0.20 Poke Ball should not lock someone out of packs for hours.
--   * Nor does it roll for a restock. maybe_restock runs after every pack
--     or ticket purchase; letting a cheap ball trigger it would turn
--     supplies into a way to farm restocks.
-- Buy supplies alongside packs or tickets and the checkout behaves exactly
-- as before. And vending_claim now lets a member in when the packs are gone
-- but supplies are still on the shelf, or the supplies could not be bought.

-- ------------------------------------------------------------------ catalog

create table if not exists public.vvm_supplies (
  key              text primary key check (key ~ '^[a-z][a-z0-9_]{0,39}$'),
  kind             text not null check (kind in ('item','bundle')),
  name             text not null check (char_length(btrim(name)) between 1 and 40),
  -- One line under the name on the shelf, e.g. 'Heals 30% HP'.
  description      text check (description is null or char_length(description) <= 200),
  -- Bundles only: item key -> how many, e.g. {"potion": 3, "revive": 1}.
  contents         jsonb,
  token_price      numeric(12,2) not null check (token_price > 0),
  appearance_rate  integer not null default 0 check (appearance_rate between 0 and 100),
  is_active        boolean not null default true,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references public.profiles(id) on delete set null,
  constraint vvm_supplies_contents_by_kind check (
    (kind = 'item' and contents is null) or
    (kind = 'bundle' and jsonb_typeof(contents) = 'object' and contents <> '{}'::jsonb)
  )
);

-- A bundle's contents can only name items, in whole numbers from 1 to 99.
-- A check constraint cannot look at other rows, so this is a trigger. The
-- key and kind are fixed once made: stock and inventories point at the key,
-- and the battle game will know items by it.
create or replace function public.vvm_supplies_guard()
returns trigger language plpgsql set search_path to 'public' as $fn$
declare
  v_bad text;
begin
  if tg_op = 'UPDATE' and (new.key <> old.key or new.kind <> old.kind) then
    raise exception 'A supply''s key and kind cannot change' using errcode = '22023';
  end if;

  if new.kind = 'bundle' then
    select c.key into v_bad
      from jsonb_each(new.contents) c
     where case when jsonb_typeof(c.value) = 'number'
                then (c.value)::numeric % 1 <> 0 or (c.value)::numeric not between 1 and 99
                else true end
        or not exists (select 1 from public.vvm_supplies i
                        where i.key = c.key and i.kind = 'item')
     limit 1;
    if v_bad is not null then
      raise exception 'Bundle contents must be items, 1 to 99 of each (bad: %)', v_bad
        using errcode = '22023';
    end if;
  end if;

  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end $fn$;

-- Admins' own writes fire it, so they need to be able to run it.
grant execute on function public.vvm_supplies_guard() to authenticated;

drop trigger if exists vvm_supplies_guard on public.vvm_supplies;
create trigger vvm_supplies_guard before insert or update on public.vvm_supplies
  for each row execute function public.vvm_supplies_guard();

-- Items first, in their own statement, so the bundles below can name them.
-- Everything starts switched off (see the header); prices and rates are
-- ready for when an admin turns them on.
insert into public.vvm_supplies
  (key, kind, name, description, token_price, appearance_rate, is_active, sort_order)
values
  ('potion',       'item', 'Potion',       'Heals 30% HP',                   0.25, 40, false, 10),
  ('super_potion', 'item', 'Super Potion', 'Heals 60% HP',                   0.50, 15, false, 20),
  ('revive',       'item', 'Revive',       'Revives a fainted Pokémon at 50% HP', 0.60, 15, false, 30),
  ('poke_ball',    'item', 'Poké Ball',    'Catch rate ×1',                  0.20, 35, false, 40),
  ('great_ball',   'item', 'Great Ball',   'Catch rate ×1.5',                0.40, 10, false, 50)
on conflict (key) do nothing;

insert into public.vvm_supplies
  (key, kind, name, contents, token_price, appearance_rate, is_active, sort_order)
values
  ('healing_bundle', 'bundle', 'Healing Bundle', '{"potion": 3, "revive": 1}',     1.10, 35, false, 110),
  ('catch_bundle',   'bundle', 'Catch Bundle',   '{"poke_ball": 5, "great_ball": 1}', 1.20, 25, false, 120)
on conflict (key) do nothing;

-- -------------------------------------------------------- stock, inventory

create table if not exists public.vvm_supply_stock (
  cycle_no    bigint not null,
  supply_key  text   not null references public.vvm_supplies(key) on delete cascade,
  primary key (cycle_no, supply_key)
);

-- No cascade from the catalog: an item someone holds cannot be deleted out
-- from under them. Items are switched off, not removed.
create table if not exists public.user_items (
  user_id     uuid    not null references public.profiles(id) on delete cascade,
  item_key    text    not null references public.vvm_supplies(key),
  qty         integer not null default 0 check (qty >= 0),
  updated_at  timestamptz not null default now(),
  primary key (user_id, item_key)
);

-- ----------------------------------------------------------------------- RLS

alter table public.vvm_supplies     enable row level security;
alter table public.vvm_supply_stock enable row level security;
alter table public.user_items       enable row level security;

drop policy if exists vvm_supplies_select on public.vvm_supplies;
create policy vvm_supplies_select on public.vvm_supplies
  for select using (public.is_member());
drop policy if exists vvm_supplies_write on public.vvm_supplies;
create policy vvm_supplies_write on public.vvm_supplies
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists vvm_supply_stock_select on public.vvm_supply_stock;
create policy vvm_supply_stock_select on public.vvm_supply_stock
  for select using (public.is_member());

-- Written only by vending_checkout, which runs as its owner.
drop policy if exists user_items_select on public.user_items;
create policy user_items_select on public.user_items
  for select using (user_id = auth.uid() or public.is_mod());

-- Default privileges already leave anon out of new tables (v51); say so
-- here too, and drop the table-level extras PostgREST never needs.
revoke all on public.vvm_supplies, public.vvm_supply_stock, public.user_items from anon;
revoke truncate, references, trigger
  on public.vvm_supplies, public.vvm_supply_stock, public.user_items from authenticated;

-- ------------------------------------------------------------------ stocking

-- The live body from v43, with the supply roll added at the end beside the
-- ticket roll. random() in the WHERE is evaluated per row, so each supply
-- gets its own roll.
create or replace function public.build_vending_stock(p_cycle bigint, p_sold_out boolean)
returns void language plpgsql security definer set search_path to 'public' as $fn$
declare
  v_total int;
begin
  if p_sold_out then
    insert into public.vending_stock (cycle_no, set_code, display_pack_id, quantity)
    select p_cycle, s.set_code,
           (select vp.id from public.vending_packs vp
             where vp.set_code = s.set_code and vp.is_active
             order by random() limit 1),
           0
      from (select distinct set_code from public.vending_packs where is_active) s
      left join public.vending_set_info i on i.set_code = s.set_code
     where coalesce(i.total_quantity - i.claimed_quantity, 1) > 0
       and random() < 0.85
    on conflict (cycle_no, set_code) do nothing;
    return;
  end if;

  v_total := 1 + floor(random() * 5)::int;

  insert into public.vending_stock (cycle_no, set_code, display_pack_id, quantity)
  with sets as (
    -- Only sets with inventory left can be offered. A null total_quantity is
    -- unlimited, represented here as a very large remaining so the same
    -- comparison works for both.
    select vp.set_code,
           coalesce(i.total_quantity - i.claimed_quantity, 2147483647) as remaining,
           row_number() over (order by vp.set_code) as rn,
           count(*) over () as n
      from (select distinct set_code from public.vending_packs where is_active) vp
      left join public.vending_set_info i on i.set_code = vp.set_code
     where coalesce(i.total_quantity - i.claimed_quantity, 1) > 0
  ),
  units as (
    select 1 + floor(random() * (select n from sets limit 1))::int as pick
      from generate_series(1, v_total)
     where exists (select 1 from sets)
  ),
  agg as (
    select s.set_code, s.remaining, count(*)::int as qty
      from units u
      join sets s on s.rn = u.pick
     group by s.set_code, s.remaining
  )
  select p_cycle, a.set_code,
         (select vp.id from public.vending_packs vp
           where vp.set_code = a.set_code and vp.is_active
           order by random() limit 1),
         -- Never offer more than the set actually has left.
         least(a.qty, a.remaining)
    from agg a
   where least(a.qty, a.remaining) > 0
  on conflict (cycle_no, set_code) do nothing;

  insert into public.vending_ticket_stock (cycle_no, ticket_id, quantity)
  select p_cycle, t.id, 1
    from public.raffle_tickets t
   where t.is_active
     and (t.starts_at is null or now() >= t.starts_at)
     and (t.ends_at   is null or now() <  t.ends_at)
     and t.claimed_quantity < t.total_quantity
     and random() < public.raffle_rarity_chance(t.rarity)
  on conflict (cycle_no, ticket_id) do nothing;

  insert into public.vvm_supply_stock (cycle_no, supply_key)
  select p_cycle, s.key
    from public.vvm_supplies s
   where s.is_active
     and random() * 100 < s.appearance_rate
  on conflict (cycle_no, supply_key) do nothing;
end $fn$;

-- What is on the supply shelf this cycle. Bundles come with their contents
-- spelled out (name, count, and each item's own price, so the machine can
-- show what the bundle saves).
create or replace function public.get_vending_supply_stock(p_cycle bigint)
returns table (key text, kind text, name text, description text,
               contents jsonb, token_price numeric)
language sql stable security definer set search_path to 'public' as $fn$
  select s.key, s.kind, s.name, s.description,
         case when s.kind = 'bundle' then (
           select coalesce(jsonb_agg(jsonb_build_object(
                    'key', i.key, 'name', i.name, 'qty', (c.value)::int,
                    'token_price', i.token_price) order by i.sort_order), '[]'::jsonb)
             from jsonb_each(s.contents) c
             join public.vvm_supplies i on i.key = c.key and i.kind = 'item'
         ) end,
         s.token_price
    from public.vvm_supply_stock st
    join public.vvm_supplies s on s.key = st.supply_key
   where st.cycle_no = p_cycle
     and s.is_active
     and public.is_member()
   order by (s.kind = 'bundle'), s.sort_order, s.name;
$fn$;

grant execute on function public.get_vending_supply_stock(bigint) to authenticated;

-- ------------------------------------------------------------------- claim

-- The live body, with one change: an in-stock machine whose packs are gone
-- is still worth claiming while supplies are on the shelf.
create or replace function public.vending_claim()
returns table (ok boolean, reason text, holder_name text, expires_at timestamptz)
language plpgsql security definer set search_path to 'public' as $fn$
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

  if coalesce((select sum(quantity) from public.vending_stock where cycle_no = st.cycle_no), 0) <= 0
     and not exists (select 1 from public.vvm_supply_stock ss
                       join public.vvm_supplies s on s.key = ss.supply_key
                      where ss.cycle_no = st.cycle_no and s.is_active) then
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

  update public.vending_state set frozen_since = coalesce(frozen_since, now()) where id;

  return query
    select true, 'claimed', null::text, (now() + make_interval(secs => v_timeout));
end $fn$;

-- ---------------------------------------------------------------- checkout

-- Gains p_supplies ([{"key": "potion", "qty": 2}]) and supplies_bought. The
-- return type changes, so the old one has to be dropped rather than
-- replaced; leaving it would also make a two-argument call ambiguous.
-- Packs and tickets are the live body unchanged.
drop function if exists public.vending_checkout(jsonb, jsonb);

create or replace function public.vending_checkout(
  p_items    jsonb,
  p_tickets  jsonb default '[]'::jsonb,
  p_supplies jsonb default '[]'::jsonb
)
returns table (ok boolean, reason text, packs_bought integer, spent numeric,
               balance numeric, restocked boolean, tickets_bought integer,
               supplies_bought integer)
language plpgsql security definer set search_path to 'public' as $fn$
declare
  me           uuid := auth.uid();
  se           public.vending_session;
  v_cycle      bigint;
  v_packs      int := 0;
  v_tickets    int := 0;
  v_supplies   int := 0;
  v_cost       numeric(12,2) := 0;
  v_balance    numeric(12,2);
  v_cooldown   numeric;
  v_restocked  boolean := false;
  it           record;
  v_have       int;
  v_arts       bigint[];
  v_price      numeric(12,2);
  v_remaining  int;
  v_limit      int;
  v_owned      int;
  v_note       text;
  v_set_total  int;
  v_set_left   int;
  v_kind       text;
  v_contents   jsonb;
begin
  perform 1 from public.vending_state where id for update;
  select * into se from public.vending_session where id for update;

  if se.holder_id is null or se.holder_id <> me or se.expires_at <= now() then
    return query select false, 'not_holder', 0, 0::numeric, public.token_balance(me), false, 0, 0; return;
  end if;
  v_cycle := se.cycle_no;

  for it in select (e->>'set_code')::text as set_code, (e->>'qty')::int as qty
              from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) e loop
    if it.qty is null or it.qty <= 0 or it.set_code is null then
      return query select false, 'bad_request', 0, 0::numeric, public.token_balance(me), false, 0, 0; return;
    end if;
    select quantity into v_have from public.vending_stock
      where cycle_no = v_cycle and set_code = it.set_code for update;
    if v_have is null or v_have < it.qty then
      return query select false, 'insufficient_stock', 0, 0::numeric, public.token_balance(me), false, 0, 0; return;
    end if;

    -- Lifetime inventory for the set, locked so two buyers can't both pass.
    select i.total_quantity, (i.total_quantity - i.claimed_quantity)
      into v_set_total, v_set_left
      from public.vending_set_info i
     where i.set_code = it.set_code for update;
    if v_set_total is not null and coalesce(v_set_left, 0) < it.qty then
      return query select false, 'set_sold_out', 0, 0::numeric, public.token_balance(me), false, 0, 0; return;
    end if;

    v_packs := v_packs + it.qty;
    v_cost  := v_cost + it.qty;
  end loop;

  for it in select (e->>'ticket_id')::bigint as ticket_id, (e->>'qty')::int as qty
              from jsonb_array_elements(coalesce(p_tickets, '[]'::jsonb)) e loop
    if it.qty is null or it.qty <= 0 or it.ticket_id is null then
      return query select false, 'bad_request', 0, 0::numeric, public.token_balance(me), false, 0, 0; return;
    end if;

    select s.quantity into v_have from public.vending_ticket_stock s
      where s.cycle_no = v_cycle and s.ticket_id = it.ticket_id for update;
    if v_have is null or v_have < it.qty then
      return query select false, 'insufficient_stock', 0, 0::numeric, public.token_balance(me), false, 0, 0; return;
    end if;

    select t.token_price, (t.total_quantity - t.claimed_quantity), t.per_user_limit
      into v_price, v_remaining, v_limit
      from public.raffle_tickets t
     where t.id = it.ticket_id and t.is_active
       and (t.starts_at is null or now() >= t.starts_at)
       and (t.ends_at   is null or now() <  t.ends_at)
     for update;

    if v_price is null then
      return query select false, 'ticket_unavailable', 0, 0::numeric, public.token_balance(me), false, 0, 0; return;
    end if;
    if v_remaining < it.qty then
      return query select false, 'ticket_sold_out', 0, 0::numeric, public.token_balance(me), false, 0, 0; return;
    end if;

    if v_limit is not null then
      select count(*)::int into v_owned
        from public.user_raffle_tickets u
       where u.ticket_id = it.ticket_id and u.user_id = me;
      if v_owned + it.qty > v_limit then
        return query select false, 'ticket_limit_reached', 0, 0::numeric, public.token_balance(me), false, 0, 0; return;
      end if;
    end if;

    v_tickets := v_tickets + it.qty;
    v_cost    := v_cost + (it.qty * v_price);
  end loop;

  -- Supplies: on the shelf this cycle, still switched on, and (for a
  -- bundle) still made of real items. The price is read here, under a
  -- share lock, so an admin edit cannot land between charging and granting.
  for it in select (e->>'key')::text as key, (e->>'qty')::int as qty
              from jsonb_array_elements(coalesce(p_supplies, '[]'::jsonb)) e loop
    if it.qty is null or it.qty <= 0 or it.qty > 20 or it.key is null then
      return query select false, 'bad_request', 0, 0::numeric, public.token_balance(me), false, 0, 0; return;
    end if;

    if not exists (select 1 from public.vvm_supply_stock st
                    where st.cycle_no = v_cycle and st.supply_key = it.key) then
      return query select false, 'supply_not_stocked', 0, 0::numeric, public.token_balance(me), false, 0, 0; return;
    end if;

    select s.token_price, s.kind, s.contents
      into v_price, v_kind, v_contents
      from public.vvm_supplies s
     where s.key = it.key and s.is_active
     for share;

    if v_price is null then
      return query select false, 'supply_unavailable', 0, 0::numeric, public.token_balance(me), false, 0, 0; return;
    end if;
    if v_kind = 'bundle' and exists (
         select 1 from jsonb_each(v_contents) c
          where not exists (select 1 from public.vvm_supplies i
                             where i.key = c.key and i.kind = 'item')) then
      return query select false, 'supply_unavailable', 0, 0::numeric, public.token_balance(me), false, 0, 0; return;
    end if;

    v_supplies := v_supplies + it.qty;
    v_cost     := v_cost + (it.qty * v_price);
  end loop;

  if v_packs + v_tickets + v_supplies = 0 then
    return query select false, 'empty_cart', 0, 0::numeric, public.token_balance(me), false, 0, 0; return;
  end if;

  v_balance := public.token_balance(me);
  if v_balance < v_cost then
    return query select false, 'insufficient_tokens', 0, 0::numeric, v_balance, false, 0, 0; return;
  end if;

  for it in select (e->>'set_code')::text as set_code, (e->>'qty')::int as qty
              from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) e loop
    update public.vending_stock
       set quantity = quantity - it.qty
     where cycle_no = v_cycle and set_code = it.set_code;

    update public.vending_set_info
       set claimed_quantity = claimed_quantity + it.qty
     where set_code = it.set_code and total_quantity is not null;

    select array_agg(vp.id) into v_arts
      from public.vending_packs vp
     where vp.set_code = it.set_code and vp.is_active;

    if v_arts is null or array_length(v_arts, 1) is null then
      return query select false, 'no_art_for_set', 0, 0::numeric, public.token_balance(me), false, 0, 0; return;
    end if;

    insert into public.user_packs (user_id, pack_id, cycle_no)
    select me, v_arts[1 + floor(random() * array_length(v_arts, 1))::int], v_cycle
      from generate_series(1, it.qty);
  end loop;

  for it in select (e->>'ticket_id')::bigint as ticket_id, (e->>'qty')::int as qty
              from jsonb_array_elements(coalesce(p_tickets, '[]'::jsonb)) e loop
    update public.vending_ticket_stock
       set quantity = quantity - it.qty
     where cycle_no = v_cycle and ticket_id = it.ticket_id;

    update public.raffle_tickets
       set claimed_quantity = claimed_quantity + it.qty
     where id = it.ticket_id;

    insert into public.user_raffle_tickets (user_id, ticket_id, cycle_no)
    select me, it.ticket_id, v_cycle from generate_series(1, it.qty);
  end loop;

  -- Items straight in, bundles opened into their items. One upsert for the
  -- lot, summed per item first, because an upsert cannot touch the same row
  -- twice in one statement (a Potion bought alone and in a bundle would).
  if v_supplies > 0 then
    insert into public.user_items as u (user_id, item_key, qty)
    select me, g.item_key, sum(g.qty)::int
      from (
        select s.key as item_key, l.qty
          from jsonb_to_recordset(coalesce(p_supplies, '[]'::jsonb)) as l(key text, qty int)
          join public.vvm_supplies s on s.key = l.key and s.kind = 'item'
        union all
        select c.key, l.qty * (c.value)::int
          from jsonb_to_recordset(coalesce(p_supplies, '[]'::jsonb)) as l(key text, qty int)
          join public.vvm_supplies b on b.key = l.key and b.kind = 'bundle'
          cross join lateral jsonb_each(b.contents) c
      ) g
     group by g.item_key
    on conflict (user_id, item_key) do update
      set qty = u.qty + excluded.qty, updated_at = now();
  end if;

  v_note := array_to_string(array_remove(array[
    case when v_packs > 0
         then v_packs || ' pack' || case when v_packs = 1 then '' else 's' end end,
    case when v_tickets > 0
         then v_tickets || ' raffle ticket' || case when v_tickets = 1 then '' else 's' end end,
    case when v_supplies > 0
         then v_supplies || ' battle suppl' || case when v_supplies = 1 then 'y' else 'ies' end end
  ], null), ', ');

  perform public.spend_tokens(me, v_cost, 'purchase', v_note);

  -- The cooldown and the restock roll are about packs and tickets. A
  -- supplies-only checkout skips both (see the header).
  if v_packs + v_tickets > 0 then
    select cooldown_hours into v_cooldown from public.vending_settings where id;
    update public.profiles
       set vending_cooldown_until = now() + make_interval(hours => floor(v_cooldown)::int,
                                                          mins  => ((v_cooldown - floor(v_cooldown)) * 60)::int)
     where id = me;

    v_restocked := public.maybe_restock(v_cycle);
  end if;

  perform public.vending_release();

  return query select true, 'ok', v_packs, v_cost, public.token_balance(me), v_restocked, v_tickets, v_supplies;
end $fn$;

grant execute on function public.vending_checkout(jsonb, jsonb, jsonb) to authenticated;
