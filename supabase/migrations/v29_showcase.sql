-- Showcase: a trainer's display room, visible to anyone who visits them.
--
-- Twelve slots across four shelves. A slot points at one of your own cards,
-- raw or slabbed - the renderer decides which way to draw it from the card's
-- own grade, so nothing here needs to know about slabs.
--
-- Lighting is per trainer and purely cosmetic, stored rather than computed so
-- a visitor sees the room the way its owner arranged it.

create table if not exists public.showcase_settings (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  -- 0 cold white through 100 warm amber.
  warmth     smallint not null default 55 check (warmth between 0 and 100),
  brightness smallint not null default 60 check (brightness between 0 and 100),
  shelf      text     not null default 'oak'
             check (shelf in ('oak','walnut','slate','white')),
  updated_at timestamptz not null default now()
);

create table if not exists public.showcase_slots (
  user_id      uuid     not null references public.profiles(id) on delete cascade,
  slot         smallint not null check (slot between 0 and 11),
  -- Cascades: a card that leaves the collection leaves the shelf with it.
  user_card_id bigint   not null references public.user_cards(id) on delete cascade,
  placed_at    timestamptz not null default now(),
  primary key (user_id, slot),
  -- One card cannot stand in two places at once.
  unique (user_card_id)
);

create index if not exists showcase_slots_user_idx on public.showcase_slots (user_id);

alter table public.showcase_settings enable row level security;
alter table public.showcase_slots    enable row level security;

-- Anyone signed in may look; only the owner may arrange.
create policy showcase_settings_read on public.showcase_settings
  for select using (auth.uid() is not null);
create policy showcase_settings_write on public.showcase_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy showcase_slots_read on public.showcase_slots
  for select using (auth.uid() is not null);
create policy showcase_slots_write on public.showcase_slots
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Placing a card. Ownership is checked here rather than trusted from the
-- client, and the upsert means dropping a card onto an occupied slot
-- replaces what was there.
create or replace function public.set_showcase_slot(p_slot int, p_user_card_id bigint)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  me uuid := auth.uid();
begin
  if p_slot < 0 or p_slot > 11 then
    raise exception 'No such shelf slot';
  end if;
  if not exists (select 1 from public.user_cards c
                  where c.id = p_user_card_id and c.user_id = me) then
    raise exception 'That card is not yours';
  end if;

  -- A card may only stand in one slot, so free its old one first.
  delete from public.showcase_slots
   where user_id = me and user_card_id = p_user_card_id;

  insert into public.showcase_slots (user_id, slot, user_card_id)
  values (me, p_slot, p_user_card_id)
  on conflict (user_id, slot)
  do update set user_card_id = excluded.user_card_id, placed_at = now();
end $$;

create or replace function public.clear_showcase_slot(p_slot int)
returns void language sql security definer set search_path to 'public' as $$
  delete from public.showcase_slots
   where user_id = auth.uid() and slot = p_slot;
$$;

create or replace function public.update_showcase_lighting(
  p_warmth int, p_brightness int, p_shelf text
) returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  insert into public.showcase_settings (user_id, warmth, brightness, shelf, updated_at)
  values (auth.uid(),
          greatest(0, least(100, p_warmth)),
          greatest(0, least(100, p_brightness)),
          p_shelf, now())
  on conflict (user_id) do update
    set warmth = excluded.warmth,
        brightness = excluded.brightness,
        shelf = excluded.shelf,
        updated_at = now();
end $$;

-- Everything a visitor needs to draw someone's room, in one call.
create or replace function public.get_showcase(p_user uuid)
returns table (
  slot smallint, user_card_id bigint, card_id bigint,
  name text, number text, rarity char(1), image_url text, set_code text,
  center_x smallint, center_y smallint, corners smallint, edges smallint,
  surface smallint, border_wear smallint, wear_seed int, grade smallint
)
language sql stable security definer set search_path to 'public' as $$
  select s.slot, s.user_card_id, c.id,
         c.name, c.number, c.rarity, c.image_url, c.set_code,
         uc.center_x, uc.center_y, uc.corners, uc.edges,
         uc.surface, uc.border_wear, uc.wear_seed,
         case when uc.graded_at is not null then uc.grade else null end
    from public.showcase_slots s
    join public.user_cards uc   on uc.id = s.user_card_id
    join public.vending_cards c on c.id = uc.card_id
   where s.user_id = p_user
   order by s.slot;
$$;
