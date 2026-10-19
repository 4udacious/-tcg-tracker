-- Cleaning can now work on creases too.
--
-- A clean that goes well (the 32 in 33) also has a 40% chance at the
-- crease: a light one is pressed out entirely, and a crease or a heavy one
-- is flattened down to a light one. It is the biggest thing a clean can do
-- for a grade - a crease caps a card at 4 and a heavy one at 3, a light one
-- only at 6 - so it is a chance, not a given. A clean that goes wrong still
-- only does harm.
--
-- Same signature and result as before, so grants and callers carry over.

create or replace function public.collect_cleaning(p_user_card_id bigint)
returns table (ok boolean, reason text, outcome text, improved integer,
               corners smallint, edges smallint, surface smallint, border_wear smallint,
               crease smallint, holes smallint, rips smallint)
language plpgsql security definer set search_path to 'public' as $function$
declare
  me uuid := auth.uid(); v public.user_cards; pct int := 0; v_out text;
  c smallint; e smallint; s smallint; b smallint; cr smallint;
begin
  select * into v from public.user_cards u where u.id = p_user_card_id for update;
  if v.id is null or v.user_id <> me then
    return query select false, 'not_yours', null::text, null::int, null::smallint, null::smallint, null::smallint, null::smallint, null::smallint, null::smallint, null::smallint; return;
  end if;
  if v.cleaning_started_at is null then
    return query select false, 'not_cleaning', null::text, null::int, null::smallint, null::smallint, null::smallint, null::smallint, null::smallint, null::smallint, null::smallint; return;
  end if;
  if now() < v.cleaning_ready_at then
    return query select false, 'not_ready', null::text, null::int, null::smallint, null::smallint, null::smallint, null::smallint, null::smallint, null::smallint, null::smallint; return;
  end if;

  c := v.corners; e := v.edges; s := v.surface; b := v.border_wear; cr := v.crease;
  if random() < 0.03 then
    -- Scrubbed too hard: the surface comes back scratched, and a third of
    -- the time it has been bent in the handling.
    v_out := 'damaged';
    s := greatest(0, s - (5 + floor(random() * 11)::int));
    if random() < 0.35 then cr := least(3, cr + 1); end if;
  else
    v_out := 'cleaned';
    pct := 10 + floor(random() * 21)::int;
    c := least(100, c + round((100 - c) * pct / 100.0));
    e := least(100, e + round((100 - e) * pct / 100.0));
    s := least(100, s + round((100 - s) * pct / 100.0));
    b := least(100, b + round((100 - b) * pct / 100.0));
    -- Pressed and humidified: a light crease can come out entirely, a
    -- major one can come down to light.
    if cr > 0 and random() < 0.4 then
      cr := case when cr = 1 then 0 else 1 end;
    end if;
  end if;

  update public.user_cards u set corners = c, edges = e, surface = s, border_wear = b, crease = cr,
         cleaning_started_at = null, cleaning_ready_at = null where u.id = p_user_card_id;
  return query select true, 'ok', v_out, pct, c, e, s, b, cr, v.holes, v.rips;
end $function$;
