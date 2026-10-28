-- Booster boxes in the VVM: a whole box of one set's packs bought at once.
-- The first is a Base Set box, 36 packs for 36 tokens.
--
-- A box has its own limited stock (total_quantity), separate from the set's
-- single-pack supply: Base Set's 72 single packs are all claimed, and boxes
-- don't draw on that. Like everything else on the shelf, a box only turns up
-- now and then: at each restock it's stocked (one of it) with a chance of
-- appearance_rate percent, while any are left. per_user_limit caps how many
-- one member may ever buy (one Base Set box each).
--
-- Bought, a box lands as its packs, unopened, in the buyer's packs (each
-- with a random wrapper of the set, as single packs get), and counts as
-- buying packs: the cooldown and the restock roll follow, and Recent buys
-- shows the packs. vending_checkout takes boxes as a fourth, optional
-- argument (p_boxes), so callers that don't sell boxes (the battle game's
-- machine) work unchanged.
--
-- Safe to re-run.

create table if not exists public.vending_boxes (
  id                bigserial primary key,
  set_code          text not null,
  name              text not null,
  description       text,
  packs             integer not null check (packs > 0),
  token_price       numeric(12,2) not null check (token_price >= 0),
  total_quantity    integer not null check (total_quantity >= 0),
  claimed_quantity  integer not null default 0 check (claimed_quantity >= 0 and claimed_quantity <= total_quantity),
  per_user_limit    integer check (per_user_limit is null or per_user_limit > 0),
  appearance_rate   integer not null default 15 check (appearance_rate between 0 and 100),
  is_active         boolean not null default true,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  unique (set_code, name)
);

-- What's on the shelf this cycle.
create table if not exists public.vending_box_stock (
  cycle_no  bigint not null,
  box_id    bigint not null references public.vending_boxes(id) on delete cascade,
  quantity  integer not null check (quantity >= 0),
  primary key (cycle_no, box_id)
);

-- Who bought which box, for the per-member limit.
create table if not exists public.user_vending_boxes (
  id         bigserial primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  box_id     bigint not null references public.vending_boxes(id) on delete cascade,
  cycle_no   bigint,
  bought_at  timestamptz not null default now()
);
create index if not exists user_vending_boxes_user_box on public.user_vending_boxes (user_id, box_id);

-- Read and written through the functions below; members may see their own purchases.
alter table public.vending_boxes enable row level security;
alter table public.vending_box_stock enable row level security;
alter table public.user_vending_boxes enable row level security;
drop policy if exists user_vending_boxes_select on public.user_vending_boxes;
create policy user_vending_boxes_select on public.user_vending_boxes
  for select using (user_id = auth.uid() or public.is_mod());
revoke all on public.vending_boxes, public.vending_box_stock from anon, authenticated;
revoke all on public.user_vending_boxes from anon;
revoke insert, update, delete, truncate, references, trigger on public.user_vending_boxes from authenticated;

insert into public.vending_boxes (set_code, name, description, packs, token_price, total_quantity, per_user_limit, appearance_rate, sort_order)
values ('base1', 'Base Set Booster Box',
        'A sealed box of 36 Base Set packs: Charizard, Blastoise and Venusaur wrappers, the holos that started it all. 36 packs for 36 tokens, one box per trainer. The packs land in your collection unopened.',
        36, 36, 5, 1, 15, 1)
on conflict (set_code, name) do nothing;

/* The boxes on the shelf this cycle, with what's left of each and how many you've bought. */
create or replace function public.get_vending_box_stock(p_cycle bigint)
returns table (box_id bigint, set_code text, set_name text, name text, description text, packs integer,
               token_price numeric, quantity integer, remaining integer, per_user_limit integer, owned integer, pack_images text[])
language sql stable security definer set search_path to 'public' as $$
  select b.id, b.set_code,
         (select vp.set_name from public.vending_packs vp where vp.set_code = b.set_code limit 1),
         b.name, b.description, b.packs, b.token_price,
         s.quantity,
         (b.total_quantity - b.claimed_quantity),
         b.per_user_limit,
         coalesce((select count(*)::int from public.user_vending_boxes u where u.box_id = b.id and u.user_id = auth.uid()), 0),
         (select array_agg(vp.image_url order by vp.sort_order) from public.vending_packs vp where vp.set_code = b.set_code and vp.is_active)
    from public.vending_box_stock s
    join public.vending_boxes b on b.id = s.box_id
   where s.cycle_no = p_cycle and b.is_active and public.is_member()
   order by b.sort_order, b.name;
$$;
revoke execute on function public.get_vending_box_stock(bigint) from public, anon;
grant execute on function public.get_vending_box_stock(bigint) to authenticated;

/* The restock, as before (v24), with boxes rolled onto the shelf by their appearance rate. */
create or replace function public.build_vending_stock(p_cycle bigint, p_sold_out boolean)
returns void
language plpgsql security definer set search_path to 'public' as $function$
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

  -- Boxes: one on the shelf, now and then, while any are left.
  insert into public.vending_box_stock (cycle_no, box_id, quantity)
  select p_cycle, b.id, 1
    from public.vending_boxes b
   where b.is_active
     and b.claimed_quantity < b.total_quantity
     and random() * 100 < b.appearance_rate
  on conflict (cycle_no, box_id) do nothing;
end $function$;

/*
 * Checkout, as before (v56), with boxes (p_boxes: [{ box_id, qty }]). The
 * old three-argument version is replaced, not overloaded, so a call naming
 * only p_items, p_tickets and p_supplies still resolves to one function.
 */
drop function if exists public.vending_checkout(jsonb, jsonb, jsonb);
create or replace function public.vending_checkout(p_items jsonb, p_tickets jsonb default '[]'::jsonb, p_supplies jsonb default '[]'::jsonb, p_boxes jsonb default '[]'::jsonb)
returns table (ok boolean, reason text, packs_bought integer, spent numeric, balance numeric, restocked boolean, tickets_bought integer, supplies_bought integer, boxes_bought integer)
language plpgsql security definer set search_path to 'public' as $function$
declare
  me           uuid := auth.uid();
  se           public.vending_session;
  v_cycle      bigint;
  v_packs      int := 0;
  v_tickets    int := 0;
  v_supplies   int := 0;
  v_boxes      int := 0;
  v_box_packs  int := 0;
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
  v_box        public.vending_boxes;
begin
  perform 1 from public.vending_state where id for update;
  select * into se from public.vending_session where id for update;

  if se.holder_id is null or se.holder_id <> me or se.expires_at <= now() then
    return query select false, 'not_holder', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
  end if;
  v_cycle := se.cycle_no;

  for it in select (e->>'set_code')::text as set_code, (e->>'qty')::int as qty
              from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) e loop
    if it.qty is null or it.qty <= 0 or it.set_code is null then
      return query select false, 'bad_request', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
    end if;
    select quantity into v_have from public.vending_stock
      where cycle_no = v_cycle and set_code = it.set_code for update;
    if v_have is null or v_have < it.qty then
      return query select false, 'insufficient_stock', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
    end if;

    -- Lifetime inventory for the set, locked so two buyers can't both pass.
    select i.total_quantity, (i.total_quantity - i.claimed_quantity)
      into v_set_total, v_set_left
      from public.vending_set_info i
     where i.set_code = it.set_code for update;
    if v_set_total is not null and coalesce(v_set_left, 0) < it.qty then
      return query select false, 'set_sold_out', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
    end if;

    v_packs := v_packs + it.qty;
    v_cost  := v_cost + it.qty;
  end loop;

  for it in select (e->>'ticket_id')::bigint as ticket_id, (e->>'qty')::int as qty
              from jsonb_array_elements(coalesce(p_tickets, '[]'::jsonb)) e loop
    if it.qty is null or it.qty <= 0 or it.ticket_id is null then
      return query select false, 'bad_request', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
    end if;

    select s.quantity into v_have from public.vending_ticket_stock s
      where s.cycle_no = v_cycle and s.ticket_id = it.ticket_id for update;
    if v_have is null or v_have < it.qty then
      return query select false, 'insufficient_stock', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
    end if;

    select t.token_price, (t.total_quantity - t.claimed_quantity), t.per_user_limit
      into v_price, v_remaining, v_limit
      from public.raffle_tickets t
     where t.id = it.ticket_id and t.is_active
       and (t.starts_at is null or now() >= t.starts_at)
       and (t.ends_at   is null or now() <  t.ends_at)
     for update;

    if v_price is null then
      return query select false, 'ticket_unavailable', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
    end if;
    if v_remaining < it.qty then
      return query select false, 'ticket_sold_out', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
    end if;

    if v_limit is not null then
      select count(*)::int into v_owned
        from public.user_raffle_tickets u
       where u.ticket_id = it.ticket_id and u.user_id = me;
      if v_owned + it.qty > v_limit then
        return query select false, 'ticket_limit_reached', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
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
      return query select false, 'bad_request', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
    end if;

    if not exists (select 1 from public.vvm_supply_stock st
                    where st.cycle_no = v_cycle and st.supply_key = it.key) then
      return query select false, 'supply_not_stocked', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
    end if;

    select s.token_price, s.kind, s.contents
      into v_price, v_kind, v_contents
      from public.vvm_supplies s
     where s.key = it.key and s.is_active
     for share;

    if v_price is null then
      return query select false, 'supply_unavailable', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
    end if;
    if v_kind = 'bundle' and exists (
         select 1 from jsonb_each(v_contents) c
          where not exists (select 1 from public.vvm_supplies i
                             where i.key = c.key and i.kind = 'item')) then
      return query select false, 'supply_unavailable', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
    end if;

    v_supplies := v_supplies + it.qty;
    v_cost     := v_cost + (it.qty * v_price);
  end loop;

  -- Boxes: on the shelf this cycle, some left, and within your limit. The
  -- box row is locked so two buyers can't both take the last one.
  for it in select (e->>'box_id')::bigint as box_id, (e->>'qty')::int as qty
              from jsonb_array_elements(coalesce(p_boxes, '[]'::jsonb)) e loop
    if it.qty is null or it.qty <= 0 or it.box_id is null then
      return query select false, 'bad_request', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
    end if;

    select s.quantity into v_have from public.vending_box_stock s
      where s.cycle_no = v_cycle and s.box_id = it.box_id for update;
    if v_have is null or v_have < it.qty then
      return query select false, 'insufficient_stock', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
    end if;

    select * into v_box from public.vending_boxes b where b.id = it.box_id and b.is_active for update;
    if v_box.id is null then
      return query select false, 'box_unavailable', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
    end if;
    if v_box.total_quantity - v_box.claimed_quantity < it.qty then
      return query select false, 'box_sold_out', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
    end if;
    if v_box.per_user_limit is not null then
      select count(*)::int into v_owned from public.user_vending_boxes u where u.box_id = it.box_id and u.user_id = me;
      if v_owned + it.qty > v_box.per_user_limit then
        return query select false, 'box_limit_reached', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
      end if;
    end if;
    if not exists (select 1 from public.vending_packs vp where vp.set_code = v_box.set_code and vp.is_active) then
      return query select false, 'no_art_for_set', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
    end if;

    v_boxes     := v_boxes + it.qty;
    v_box_packs := v_box_packs + it.qty * v_box.packs;
    v_cost      := v_cost + (it.qty * v_box.token_price);
  end loop;

  if v_packs + v_tickets + v_supplies + v_boxes = 0 then
    return query select false, 'empty_cart', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
  end if;

  v_balance := public.token_balance(me);
  if v_balance < v_cost then
    return query select false, 'insufficient_tokens', 0, 0::numeric, v_balance, false, 0, 0, 0; return;
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
      return query select false, 'no_art_for_set', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0; return;
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

  -- Boxes open into their packs, each with a random wrapper of the set.
  for it in select (e->>'box_id')::bigint as box_id, (e->>'qty')::int as qty
              from jsonb_array_elements(coalesce(p_boxes, '[]'::jsonb)) e loop
    select * into v_box from public.vending_boxes b where b.id = it.box_id;
    update public.vending_box_stock set quantity = quantity - it.qty where cycle_no = v_cycle and box_id = it.box_id;
    update public.vending_boxes set claimed_quantity = claimed_quantity + it.qty where id = it.box_id;
    insert into public.user_vending_boxes (user_id, box_id, cycle_no)
    select me, it.box_id, v_cycle from generate_series(1, it.qty);

    select array_agg(vp.id) into v_arts
      from public.vending_packs vp
     where vp.set_code = v_box.set_code and vp.is_active;
    insert into public.user_packs (user_id, pack_id, cycle_no)
    select me, v_arts[1 + floor(random() * array_length(v_arts, 1))::int], v_cycle
      from generate_series(1, it.qty * v_box.packs);
  end loop;

  v_note := array_to_string(array_remove(array[
    case when v_boxes > 0
         then v_boxes || ' booster box' || case when v_boxes = 1 then '' else 'es' end end,
    case when v_packs > 0
         then v_packs || ' pack' || case when v_packs = 1 then '' else 's' end end,
    case when v_tickets > 0
         then v_tickets || ' raffle ticket' || case when v_tickets = 1 then '' else 's' end end,
    case when v_supplies > 0
         then v_supplies || ' battle suppl' || case when v_supplies = 1 then 'y' else 'ies' end end
  ], null), ', ');

  perform public.spend_tokens(me, v_cost, 'purchase', v_note);

  -- The cooldown and the restock roll are about packs and tickets (a box is
  -- packs). A supplies-only checkout skips both.
  if v_packs + v_tickets + v_boxes > 0 then
    select cooldown_hours into v_cooldown from public.vending_settings where id;
    update public.profiles
       set vending_cooldown_until = now() + make_interval(hours => floor(v_cooldown)::int,
                                                          mins  => ((v_cooldown - floor(v_cooldown)) * 60)::int)
     where id = me;

    v_restocked := public.maybe_restock(v_cycle);
  end if;

  perform public.vending_release();

  return query select true, 'ok', v_packs + v_box_packs, v_cost, public.token_balance(me), v_restocked, v_tickets, v_supplies, v_boxes;
end $function$;

revoke execute on function public.vending_checkout(jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.vending_checkout(jsonb, jsonb, jsonb, jsonb) to authenticated;
