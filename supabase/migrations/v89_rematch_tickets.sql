-- Rematch tickets: a Gym Leader, an Elite Four member (Johto or Kanto), Red or
-- Alex, back for another battle, for anyone who has beaten them before. Each is
-- its own supply (27), 1 token, one a checkout, on the machine's shelf at
-- random like any supply (3% each a restock, the same shelf for everyone;
-- change any of it in Admin -> VVM). The game collects one into the Bag as a
-- ticket for that opponent; used, it's a 1v1 or a 2v2 (they send out two),
-- their team fully evolved at your level.
--
-- Only for an opponent you've beaten: buying one needs that battle's paid
-- milestone (battle_milestones: gym:N, elite:NAME, kanto:NAME, rival:0 for
-- Alex). A trigger on user_items checks it, like one_gym_summon (v84), and
-- raises rematch_not_beaten, which undoes the whole checkout. The game greys
-- the tile out first. Safe to re-run (no drops).

insert into public.vvm_supplies (key, kind, name, description, token_price, appearance_rate, is_active, sort_order, max_per_checkout) values
  ('rematch_gym_0', 'item', 'Falkner Rematch', 'Rematch Falkner, Gym Leader: 1v1 or 2v2', 1.00, 3, true, 200, 1),
  ('rematch_gym_1', 'item', 'Bugsy Rematch', 'Rematch Bugsy, Gym Leader: 1v1 or 2v2', 1.00, 3, true, 201, 1),
  ('rematch_gym_2', 'item', 'Whitney Rematch', 'Rematch Whitney, Gym Leader: 1v1 or 2v2', 1.00, 3, true, 202, 1),
  ('rematch_gym_3', 'item', 'Morty Rematch', 'Rematch Morty, Gym Leader: 1v1 or 2v2', 1.00, 3, true, 203, 1),
  ('rematch_gym_4', 'item', 'Chuck Rematch', 'Rematch Chuck, Gym Leader: 1v1 or 2v2', 1.00, 3, true, 204, 1),
  ('rematch_gym_5', 'item', 'Jasmine Rematch', 'Rematch Jasmine, Gym Leader: 1v1 or 2v2', 1.00, 3, true, 205, 1),
  ('rematch_gym_6', 'item', 'Pryce Rematch', 'Rematch Pryce, Gym Leader: 1v1 or 2v2', 1.00, 3, true, 206, 1),
  ('rematch_gym_7', 'item', 'Clair Rematch', 'Rematch Clair, Gym Leader: 1v1 or 2v2', 1.00, 3, true, 207, 1),
  ('rematch_gym_8', 'item', 'Brock Rematch', 'Rematch Brock, Gym Leader: 1v1 or 2v2', 1.00, 3, true, 208, 1),
  ('rematch_gym_9', 'item', 'Misty Rematch', 'Rematch Misty, Gym Leader: 1v1 or 2v2', 1.00, 3, true, 209, 1),
  ('rematch_gym_10', 'item', 'Lt. Surge Rematch', 'Rematch Lt. Surge, Gym Leader: 1v1 or 2v2', 1.00, 3, true, 210, 1),
  ('rematch_gym_11', 'item', 'Erika Rematch', 'Rematch Erika, Gym Leader: 1v1 or 2v2', 1.00, 3, true, 211, 1),
  ('rematch_gym_12', 'item', 'Janine Rematch', 'Rematch Janine, Gym Leader: 1v1 or 2v2', 1.00, 3, true, 212, 1),
  ('rematch_gym_13', 'item', 'Sabrina Rematch', 'Rematch Sabrina, Gym Leader: 1v1 or 2v2', 1.00, 3, true, 213, 1),
  ('rematch_gym_14', 'item', 'Blaine Rematch', 'Rematch Blaine, Gym Leader: 1v1 or 2v2', 1.00, 3, true, 214, 1),
  ('rematch_gym_15', 'item', 'Blue Rematch', 'Rematch Blue, Gym Leader: 1v1 or 2v2', 1.00, 3, true, 215, 1),
  ('rematch_elite_will', 'item', 'Will Rematch', 'Rematch Will, Johto Elite Four: 1v1 or 2v2', 1.00, 3, true, 216, 1),
  ('rematch_elite_koga', 'item', 'Koga Rematch', 'Rematch Koga, Johto Elite Four: 1v1 or 2v2', 1.00, 3, true, 217, 1),
  ('rematch_elite_bruno', 'item', 'Bruno Rematch', 'Rematch Bruno, Johto Elite Four: 1v1 or 2v2', 1.00, 3, true, 218, 1),
  ('rematch_elite_karen', 'item', 'Karen Rematch', 'Rematch Karen, Johto Elite Four: 1v1 or 2v2', 1.00, 3, true, 219, 1),
  ('rematch_elite_lance', 'item', 'Lance Rematch', 'Rematch Lance, Johto Elite Four: 1v1 or 2v2', 1.00, 3, true, 220, 1),
  ('rematch_kanto_lorelei', 'item', 'Lorelei Rematch', 'Rematch Lorelei, Kanto Elite Four: 1v1 or 2v2', 1.00, 3, true, 221, 1),
  ('rematch_kanto_bruno', 'item', 'Bruno Rematch (Kanto)', 'Rematch Bruno, Kanto Elite Four: 1v1 or 2v2', 1.00, 3, true, 222, 1),
  ('rematch_kanto_agatha', 'item', 'Agatha Rematch', 'Rematch Agatha, Kanto Elite Four: 1v1 or 2v2', 1.00, 3, true, 223, 1),
  ('rematch_kanto_lance', 'item', 'Lance Rematch (Kanto)', 'Rematch Lance, Kanto Elite Four: 1v1 or 2v2', 1.00, 3, true, 224, 1),
  ('rematch_kanto_red', 'item', 'Red Rematch', 'Rematch Red, Pokémon Trainer: 1v1 or 2v2', 1.00, 3, true, 225, 1),
  ('rematch_alex', 'item', 'Alex Rematch', 'Rematch Alex, your rival: 1v1 or 2v2', 1.00, 3, true, 226, 1)
on conflict (key) do nothing;

/** The milestone a rematch ticket needs: the battle it's a rematch of. Null for any other supply. */
create or replace function public.rematch_milestone(p_key text)
returns text
language sql immutable set search_path to 'public' as $function$
  select m from (values
    ('rematch_gym_0', 'gym:0'),
    ('rematch_gym_1', 'gym:1'),
    ('rematch_gym_2', 'gym:2'),
    ('rematch_gym_3', 'gym:3'),
    ('rematch_gym_4', 'gym:4'),
    ('rematch_gym_5', 'gym:5'),
    ('rematch_gym_6', 'gym:6'),
    ('rematch_gym_7', 'gym:7'),
    ('rematch_gym_8', 'gym:8'),
    ('rematch_gym_9', 'gym:9'),
    ('rematch_gym_10', 'gym:10'),
    ('rematch_gym_11', 'gym:11'),
    ('rematch_gym_12', 'gym:12'),
    ('rematch_gym_13', 'gym:13'),
    ('rematch_gym_14', 'gym:14'),
    ('rematch_gym_15', 'gym:15'),
    ('rematch_elite_will', 'elite:WILL'),
    ('rematch_elite_koga', 'elite:KOGA'),
    ('rematch_elite_bruno', 'elite:BRUNO'),
    ('rematch_elite_karen', 'elite:KAREN'),
    ('rematch_elite_lance', 'elite:LANCE'),
    ('rematch_kanto_lorelei', 'kanto:LORELEI'),
    ('rematch_kanto_bruno', 'kanto:BRUNO'),
    ('rematch_kanto_agatha', 'kanto:AGATHA'),
    ('rematch_kanto_lance', 'kanto:LANCE'),
    ('rematch_kanto_red', 'kanto:RED'),
    ('rematch_alex', 'rival:0')
  ) t(k, m) where k = p_key;
$function$;

create or replace function public.rematch_needs_win()
returns trigger
language plpgsql security definer set search_path to 'public' as $function$
declare v_need text := public.rematch_milestone(new.item_key);
begin
  if v_need is null or new.qty <= coalesce(case when tg_op = 'UPDATE' then old.qty end, 0) then return new; end if;
  if not exists (select 1 from public.battle_milestones m where m.user_id = new.user_id and m.key = v_need) then
    raise exception 'rematch_not_beaten' using errcode = 'P0001';
  end if;
  return new;
end $function$;
revoke all on function public.rematch_needs_win() from public, anon, authenticated;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'user_items_rematch_needs_win') then
    create trigger user_items_rematch_needs_win before insert or update of qty on public.user_items
      for each row execute function public.rematch_needs_win();
  end if;
end $$;
