-- Per-copy card condition.
--
-- Every pulled copy gets its own centering, corners, edges and surface, so
-- two copies of the same Charizard are genuinely different objects. Condition
-- is rolled at pull time and shown visually straight away; the NUMBERS stay
-- hidden in the UI until a card comes back from grading (a later migration).
--
-- Applied live as v26 + v26b + v26c + v26d; consolidated here because three
-- of those were same-session fixes. See the LATERAL note below - that trap
-- bit this feature twice and is worth reading before touching this file.
--
-- Scores are 0-100, 100 = flawless. Centering is signed deviation from a
-- perfect cut on each axis, 0 = dead centre. It is a relative scale, not a
-- literal border ratio: the renderer crops into the art to fake the offset,
-- and spending the full border width of travel would leave even a perfect
-- card with no border left, so 100 lands around a 65/35 split on screen.
-- wear_seed deterministically places the scratch and dent overlays so a given
-- copy always looks the same.

alter table public.user_cards
  add column if not exists center_x smallint not null default 0 check (center_x between -100 and 100),
  add column if not exists center_y smallint not null default 0 check (center_y between -100 and 100),
  add column if not exists corners  smallint not null default 100 check (corners between 0 and 100),
  add column if not exists edges    smallint not null default 100 check (edges between 0 and 100),
  add column if not exists surface  smallint not null default 100 check (surface between 0 and 100),
  add column if not exists wear_seed int not null default 0;

-- Each card draws one latent quality `q` and the three subscores hang off it
-- with small per-axis noise, so flaws correlate the way a real card's do - a
-- clean card is clean all over (measured r = 0.95 between subscores).
-- Centering gets its own roll biased toward straight, scaled by `q`, so a
-- well-made card is usually well-cut but can still come out crooked (r =
-- -0.25 against build quality). That is the interesting lottery: everything
-- else can be perfect and the cut alone ruins it.
--
-- Tuned against card_grade() over 80k simulated draws:
--   10  1.3%   9  10.0%   8  25.1%   7  29.8%   6  20.4%   5  10.0%   4  3.5%
--
-- p_nonce exists only to make the function correlated with the calling row.
-- Without a parameter reference in the body, `cross join lateral
-- roll_card_condition()` is uncorrelated, so Postgres evaluates it ONCE and
-- every card in the pack - or every row in a backfill - comes out identical.
create or replace function public.roll_card_condition(p_nonce bigint)
returns table (center_x smallint, center_y smallint,
               corners smallint, edges smallint, surface smallint, wear_seed int)
language sql volatile as $$
  with g as (
    -- Three uniforms averaged: a bell on [0,1] rather than a flat draw, so
    -- most cards are middling and both extremes stay rare.
    select (random() + random() + random()) / 3 as q
     where p_nonce is not null   -- forces per-row evaluation; see above
  )
  select
    (round(sign(random() - 0.5) * 100
           * power((random() + random()) / 2, 2.2)
           * (1 - 0.8 * q)))::smallint,
    (round(sign(random() - 0.5) * 100
           * power((random() + random()) / 2, 2.2)
           * (1 - 0.8 * q)))::smallint,
    (greatest(0, least(100, round(100 - 62 * power(1 - q, 1.65)
                                  + (random() - random()) * 6))))::smallint,
    (greatest(0, least(100, round(100 - 62 * power(1 - q, 1.65)
                                  + (random() - random()) * 6))))::smallint,
    (greatest(0, least(100, round(100 - 62 * power(1 - q, 1.65)
                                  + (random() - random()) * 6))))::smallint,
    (floor(random() * 2147483000))::int
  from g;
$$;

-- Backfill cards pulled before condition existed.
--
-- A row subquery in SET is the form that works here. An UPDATE cannot
-- reference its target table from a LATERAL in the FROM clause at all
-- (42P10), and putting the latent in a plain FROM subquery makes it
-- uncorrelated - one roll shared by every row. This calls the function once
-- per row with that row's id, so the three subscores keep sharing one latent.
update public.user_cards uc
   set (center_x, center_y, corners, edges, surface, wear_seed)
       = (select r.center_x, r.center_y, r.corners, r.edges, r.surface, r.wear_seed
            from public.roll_card_condition(uc.id) r);

-- ------------------------------------------------------------------- grade
-- The number a member sees only once a card comes back from grading. Weakest
-- link wins, the way real grading works: one chewed corner caps the whole
-- card no matter how clean the rest is.
create or replace function public.card_grade(
  p_center_x smallint, p_center_y smallint,
  p_corners smallint, p_edges smallint, p_surface smallint
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
      when least(p_corners, p_edges, p_surface) >= 95 then 10
      when least(p_corners, p_edges, p_surface) >= 89 then 9
      when least(p_corners, p_edges, p_surface) >= 81 then 8
      when least(p_corners, p_edges, p_surface) >= 72 then 7
      when least(p_corners, p_edges, p_surface) >= 63 then 6
      when least(p_corners, p_edges, p_surface) >= 54 then 5
      else 4
    end
  );
$$;

-- ---------------------------------------------------------------- open_pack
-- Rolls and returns condition alongside each card, so the opening animation
-- can reveal it immediately.
create or replace function public.open_pack(p_user_pack_id bigint)
returns table (card_id bigint, name text, rarity char(1), number text, image_url text, slot int,
               center_x smallint, center_y smallint,
               corners smallint, edges smallint, surface smallint, wear_seed int)
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
    select p.id, p.grp, r.center_x, r.center_y, r.corners, r.edges, r.surface, r.wear_seed
      from picks p
      cross join lateral public.roll_card_condition(p.id) r
  ),
  inserted as (
    insert into public.user_cards (user_id, card_id, user_pack_id,
                                   center_x, center_y, corners, edges, surface, wear_seed)
    select me, x.id, p_user_pack_id,
           x.center_x, x.center_y, x.corners, x.edges, x.surface, x.wear_seed
      from rolled x
    returning user_cards.card_id
  ),
  marked as (
    update public.user_packs set opened_at = now() where id = p_user_pack_id returning 1
  )
  select c.id, c.name, c.rarity, c.number, c.image_url,
         row_number() over (order by x.grp, random())::int,
         x.center_x, x.center_y, x.corners, x.edges, x.surface, x.wear_seed
    from rolled x
    join public.vending_cards c on c.id = x.id
   where (select count(*) from inserted) > 0
     and (select count(*) from marked) > 0;
end $$;
