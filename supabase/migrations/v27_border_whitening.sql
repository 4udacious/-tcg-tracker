-- Border whitening as its own condition axis.
--
-- Distinct from `edges`, which is the cut itself - the white core showing at
-- the very perimeter. This is the coloured border face going chalky and pale
-- inward from the edge, worst near the corners. On yellow-bordered cards it
-- is the most recognisable wear there is, so it earns its own score rather
-- than being folded into edge wear.
--
-- Adding a fourth subscore to a weakest-link grade drags the curve down: over
-- 60k draws, gem rate fell 1.3% -> 1.0% and grade 9 fell 9.9% -> 9.3%. The
-- subscore exponent moves 1.65 -> 1.72 to compensate, which restores it:
--   10 1.2%   9 10.5%   8 25.9%   7 29.7%   6 19.6%   5 9.6%   4 3.6%

alter table public.user_cards
  add column if not exists border_wear smallint not null default 100
    check (border_wear between 0 and 100);

drop function if exists public.roll_card_condition(bigint);

create or replace function public.roll_card_condition(p_nonce bigint)
returns table (center_x smallint, center_y smallint,
               corners smallint, edges smallint, surface smallint,
               border_wear smallint, wear_seed int)
language sql volatile as $$
  with g as (
    select (random() + random() + random()) / 3 as q
     where p_nonce is not null   -- forces per-row evaluation; see v26
  )
  select
    (round(sign(random() - 0.5) * 100
           * power((random() + random()) / 2, 2.2)
           * (1 - 0.8 * q)))::smallint,
    (round(sign(random() - 0.5) * 100
           * power((random() + random()) / 2, 2.2)
           * (1 - 0.8 * q)))::smallint,
    (greatest(0, least(100, round(100 - 62 * power(1 - q, 1.72)
                                  + (random() - random()) * 6))))::smallint,
    (greatest(0, least(100, round(100 - 62 * power(1 - q, 1.72)
                                  + (random() - random()) * 6))))::smallint,
    (greatest(0, least(100, round(100 - 62 * power(1 - q, 1.72)
                                  + (random() - random()) * 6))))::smallint,
    (greatest(0, least(100, round(100 - 62 * power(1 - q, 1.72)
                                  + (random() - random()) * 6))))::smallint,
    (floor(random() * 2147483000))::int
  from g;
$$;

-- Existing cards keep the condition they were pulled with. Re-rolling would
-- be simpler but would quietly reshuffle every card members already own,
-- including the 49 gem-mint ones. Instead the new axis is derived from each
-- card's own level, so it correlates the way a fresh roll would.
update public.user_cards
   set border_wear = greatest(0, least(100,
         round((corners + edges + surface) / 3.0 + (random() - random()) * 6)))::smallint;

-- ------------------------------------------------------------------- grade
drop function if exists public.card_grade(smallint, smallint, smallint, smallint, smallint);

create or replace function public.card_grade(
  p_center_x smallint, p_center_y smallint,
  p_corners smallint, p_edges smallint, p_surface smallint, p_border smallint
) returns int language sql immutable as $$
  select least(
    case
      when greatest(abs(p_center_x), abs(p_center_y)) <= 10 then 10
      when greatest(abs(p_center_x), abs(p_center_y)) <= 20 then 9
      when greatest(abs(p_center_x), abs(p_center_y)) <= 30 then 8
      when greatest(abs(p_center_x), abs(p_center_y)) <= 40 then 7
      when greatest(abs(p_center_x), abs(p_center_y)) <= 50 then 6
      when greatest(abs(p_center_x), abs(p_center_y)) <= 62 then 5
      else 4
    end,
    case
      when least(p_corners, p_edges, p_surface, p_border) >= 95 then 10
      when least(p_corners, p_edges, p_surface, p_border) >= 89 then 9
      when least(p_corners, p_edges, p_surface, p_border) >= 81 then 8
      when least(p_corners, p_edges, p_surface, p_border) >= 72 then 7
      when least(p_corners, p_edges, p_surface, p_border) >= 63 then 6
      when least(p_corners, p_edges, p_surface, p_border) >= 54 then 5
      else 4
    end
  );
$$;

-- ---------------------------------------------------------------- open_pack
drop function if exists public.open_pack(bigint);

create or replace function public.open_pack(p_user_pack_id bigint)
returns table (card_id bigint, name text, rarity char(1), number text, image_url text, slot int,
               center_x smallint, center_y smallint,
               corners smallint, edges smallint, surface smallint,
               border_wear smallint, wear_seed int)
language plpgsql security definer set search_path to 'public' as $$
declare
  me       uuid := auth.uid();
  v_pack   public.user_packs;
  v_code   text;
  v_rare   char(1);
begin
  select * into v_pack from public.user_packs where id = p_user_pack_id for update;

  if v_pack.id is null or v_pack.user_id <> me then
    raise exception 'That pack is not yours';
  end if;
  if v_pack.opened_at is not null then
    raise exception 'That pack is already open';
  end if;

  select p.set_code into v_code from public.vending_packs p where p.id = v_pack.pack_id;
  if v_code is null then
    raise exception 'That pack has no card pool';
  end if;

  if random() < 0.02
     and exists (select 1 from public.vending_cards vc
                  where vc.set_code = v_code and vc.rarity = 'S') then
    v_rare := 'S';
  elsif random() < 0.3333 then
    v_rare := 'H';
  else
    v_rare := 'R';
  end if;

  return query
  with picks as (
    select id, 1 as grp from (
      select c.id from public.vending_cards c
       where c.set_code = v_code and c.rarity = 'C' order by random() limit 7) a
    union all
    select id, 2 from (
      select c.id from public.vending_cards c
       where c.set_code = v_code and c.rarity = 'U' order by random() limit 3) b
    union all
    select id, 3 from (
      select c.id from public.vending_cards c
       where c.set_code = v_code and c.rarity = v_rare order by random() limit 1) d
  ),
  -- Correlated on p.id, so each card in the pack rolls its own condition.
  rolled as (
    select p.id, p.grp, r.center_x, r.center_y, r.corners, r.edges, r.surface,
           r.border_wear, r.wear_seed
      from picks p
      cross join lateral public.roll_card_condition(p.id) r
  ),
  inserted as (
    insert into public.user_cards (user_id, card_id, user_pack_id,
                                   center_x, center_y, corners, edges, surface,
                                   border_wear, wear_seed)
    select me, x.id, p_user_pack_id,
           x.center_x, x.center_y, x.corners, x.edges, x.surface,
           x.border_wear, x.wear_seed
      from rolled x
    returning user_cards.card_id
  ),
  marked as (
    update public.user_packs set opened_at = now() where id = p_user_pack_id returning 1
  )
  select c.id, c.name, c.rarity, c.number, c.image_url,
         row_number() over (order by x.grp, random())::int,
         x.center_x, x.center_y, x.corners, x.edges, x.surface,
         x.border_wear, x.wear_seed
    from rolled x
    join public.vending_cards c on c.id = x.id
   where (select count(*) from inserted) > 0
     and (select count(*) from marked) > 0;
end $$;
