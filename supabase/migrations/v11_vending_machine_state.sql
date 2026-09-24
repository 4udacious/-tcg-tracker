-- Virtual vending machine, phase 2: the pack catalog and the global state machine.
--
-- Why the state advances lazily
-- -----------------------------
-- There is exactly one state row, and whoever reads it after it has expired
-- advances it inside a locked transaction. That means:
--   * every user sees an identical status, because there is only one row;
--   * no scheduled job is needed, so nothing can silently stop running;
--   * clients don't need realtime. Everyone knows `ends_at`, so every client
--     refetches at the same wall-clock instant and flips together.
--
-- Status weighting (per the agreed schedule):
--   in_stock 55%, out_of_stock 25%, blacked_out 10%, maintenance 10%.
-- Buyable cycles run 7-10 minutes; blackout and maintenance are deliberately
-- short at 2-3 minutes, because ten minutes of a dead screen reads as broken
-- rather than atmospheric. A forced in_stock cycle also fires if none has
-- started in the last 50 minutes, so the machine can never feel abandoned.

-- ------------------------------------------------------------ pack catalog

create table if not exists public.vending_packs (
  id         bigint generated always as identity primary key,
  set_name   text not null,
  pack_name  text not null,
  image_url  text not null,
  sort_order int  not null default 0,
  is_active  boolean not null default true,
  unique (set_name, pack_name)
);

insert into public.vending_packs (set_name, pack_name, image_url, sort_order) values
  ('Base Set',    'Venusaur',        '/packs/base-set-venusaur.webp',          1),
  ('Base Set',    'Charizard',       '/packs/base-set-charizard.webp',         2),
  ('Base Set',    'Blastoise',       '/packs/base-set-blastoise.webp',         3),
  ('Jungle',      'Wigglytuff',      '/packs/jungle-wigglytuff.webp',         11),
  ('Jungle',      'Scyther',         '/packs/jungle-scyther.webp',            12),
  ('Jungle',      'Flareon',         '/packs/jungle-flareon.webp',            13),
  ('Fossil',      'Zapdos',          '/packs/fossil-zapdos.webp',             21),
  ('Fossil',      'Aerodactyl',      '/packs/fossil-aerodactyl.webp',         22),
  ('Fossil',      'Lapras',          '/packs/fossil-lapras.webp',             23),
  ('Team Rocket', 'Giovanni',        '/packs/team-rocket-giovanni.webp',      31),
  ('Team Rocket', 'Jessie & James',  '/packs/team-rocket-jessie-james.webp',  32),
  ('Team Rocket', 'Dark Gyarados',   '/packs/team-rocket-dark-gyarados.webp', 33),
  ('Team Rocket', 'Rocket Gang',     '/packs/team-rocket-rocket-gang.webp',   34)
on conflict (set_name, pack_name) do update
  set image_url = excluded.image_url, sort_order = excluded.sort_order;

-- -------------------------------------------------------------- machine state

do $$ begin
  create type public.vending_status as enum ('in_stock','out_of_stock','blacked_out','maintenance');
exception when duplicate_object then null; end $$;

create table if not exists public.vending_state (
  id              boolean primary key default true check (id),
  status          public.vending_status not null default 'in_stock',
  cycle_no        bigint not null default 1,
  started_at      timestamptz not null default now(),
  ends_at         timestamptz not null default now() + interval '8 minutes',
  -- When an in_stock cycle last began, so the "never go an hour without a
  -- restock" guarantee is a simple comparison rather than a history scan.
  last_instock_at timestamptz not null default now()
);

alter table public.vending_state
  add column if not exists last_instock_at timestamptz not null default now();

insert into public.vending_state (id) values (true) on conflict (id) do nothing;

-- Stock for a given cycle. Out-of-stock cycles also get rows, at quantity 0,
-- so that screen can show real pack art under SOLD OUT banners the way the
-- physical machine does.
create table if not exists public.vending_stock (
  id       bigint generated always as identity primary key,
  cycle_no bigint not null,
  pack_id  bigint not null references public.vending_packs(id) on delete cascade,
  quantity int not null check (quantity >= 0),
  unique (cycle_no, pack_id)
);

create index if not exists vending_stock_cycle_idx on public.vending_stock (cycle_no);

-- ----------------------------------------------------------------- advancing

-- Builds the stock listing for a cycle. `p_sold_out` produces the
-- out-of-stock display: the same kind of assortment, all at zero.
create or replace function public.build_vending_stock(p_cycle bigint, p_sold_out boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v_variety int := 3 + floor(random() * 5)::int;  -- 3-7 different packs on offer
begin
  insert into public.vending_stock (cycle_no, pack_id, quantity)
  select p_cycle,
         p.id,
         case when p_sold_out then 0 else 1 + floor(random() * 6)::int end
    from (
      select id from public.vending_packs where is_active order by random() limit v_variety
    ) p
  on conflict (cycle_no, pack_id) do nothing;
end $$;

create or replace function public.get_vending_state()
returns table (
  status       text,
  cycle_no     bigint,
  ends_at      timestamptz,
  seconds_left int
)
language plpgsql security definer set search_path to 'public' as $$
declare
  st         public.vending_state;
  v_next     public.vending_status;
  v_roll     numeric;
  v_duration interval;
  v_guard    int := 0;
begin
  select * into st from public.vending_state where id for update;

  -- If nobody has looked at the machine for a long time, don't grind through
  -- every missed cycle - just start a fresh one from now.
  if st.ends_at < now() - interval '1 hour' then
    st.ends_at := now();
  end if;

  while st.ends_at <= now() and v_guard < 40 loop
    v_guard := v_guard + 1;

    v_roll := random();

    if (st.ends_at - st.last_instock_at) > interval '50 minutes' then
      v_next := 'in_stock';                     -- never let the machine feel abandoned
    elsif v_roll < 0.55 then
      v_next := 'in_stock';
    elsif v_roll < 0.80 then
      v_next := 'out_of_stock';
    elsif v_roll < 0.90 then
      v_next := 'blacked_out';
    else
      v_next := 'maintenance';
    end if;

    -- Never show the same dead screen twice in a row.
    if v_next = st.status and v_next in ('blacked_out','maintenance','out_of_stock') then
      v_next := 'in_stock';
    end if;

    if v_next in ('blacked_out','maintenance') then
      v_duration := make_interval(secs => 120 + floor(random() * 60)::int);   -- 2-3 min
    else
      v_duration := make_interval(secs => 420 + floor(random() * 180)::int);  -- 7-10 min
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

  update public.vending_state
     set status = st.status, cycle_no = st.cycle_no,
         started_at = st.started_at, ends_at = st.ends_at,
         last_instock_at = st.last_instock_at
   where id;

  return query
    select st.status::text, st.cycle_no, st.ends_at,
           greatest(0, extract(epoch from (st.ends_at - now()))::int);
end $$;

create or replace function public.get_vending_stock(p_cycle bigint)
returns table (pack_id bigint, set_name text, pack_name text, image_url text, quantity int)
language sql stable security definer set search_path to 'public' as $$
  select p.id, p.set_name, p.pack_name, p.image_url, s.quantity
    from public.vending_stock s
    join public.vending_packs p on p.id = s.pack_id
   where s.cycle_no = p_cycle
   order by p.sort_order;
$$;

-- ----------------------------------------------------------------------- RLS

alter table public.vending_packs enable row level security;
alter table public.vending_state enable row level security;
alter table public.vending_stock enable row level security;

drop policy if exists vending_packs_read on public.vending_packs;
create policy vending_packs_read on public.vending_packs
  for select using (auth.uid() is not null);

drop policy if exists vending_state_read on public.vending_state;
create policy vending_state_read on public.vending_state
  for select using (auth.uid() is not null);

drop policy if exists vending_stock_read on public.vending_stock;
create policy vending_stock_read on public.vending_stock
  for select using (auth.uid() is not null);
