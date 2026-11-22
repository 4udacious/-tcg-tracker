-- The Game Corner's background sound, turned up or down from Admin -> VVM -> Game Corner: the music over the PA and
-- the casino floor, each as a percentage of the level the page plays it at (100 is as it was before this, 0 silent,
-- 200 twice as loud). game_corner_state hands them to the page as `sound`, so a change reaches everyone in the Game
-- Corner within a second. Players' own switches (the sound menu) still turn either off for themselves.
--
-- Safe to re-run.

alter table public.game_corner_settings
  add column if not exists music_level    smallint not null default 100 check (music_level between 0 and 200),
  add column if not exists ambience_level smallint not null default 100 check (ambience_level between 0 and 200);

/** Admins: the music's and the casino floor's levels, percent. */
create or replace function public.set_game_corner_sound(p_music integer, p_ambience integer)
returns public.game_corner_settings
language plpgsql security definer set search_path to 'public' as $$
declare s public.game_corner_settings;
begin
  if not public.is_admin() then raise exception 'Only admins can change the Game Corner'; end if;
  update public.game_corner_settings
     set music_level = greatest(0, least(200, p_music)), ambience_level = greatest(0, least(200, p_ambience)),
         updated_at = now(), updated_by = auth.uid()
   where id returning * into s;
  return s;
end $$;

/** v117's state, with the sound levels. */
create or replace function public.game_corner_state()
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); s public.game_corner_settings; v_slots jsonb; v_t smallint;
begin
  if not public.is_member() then raise exception 'members_only' using errcode = 'P0001'; end if;
  select * into s from public.game_corner_settings where id;
  perform public.game_corner_roulette_settle();
  update public.game_corner_slots set seen_at = now() where user_id = me;
  update public.game_corner_bj_seats set seen_at = now() where user_id = me;
  for v_t in select table_no from public.game_corner_bj_tables order by table_no loop
    perform public.game_corner_bj_advance(v_t);
  end loop;

  select jsonb_agg(jsonb_build_object(
           'machine', m.machine,
           'high', m.high_roller,
           'player', case when m.user_id is not null and m.seen_at > now() - interval '2 minutes' then coalesce(p.display_name, p.username) end,
           'avatar', case when m.user_id is not null and m.seen_at > now() - interval '2 minutes' then p.avatar_url end,
           'mine', m.user_id = me,
           'reels', to_jsonb(m.last_reels), 'lines', to_jsonb(m.last_lines), 'bet', m.last_bet, 'win', m.last_win, 'at', m.last_at, 'spins', m.spins) order by m.machine)
    into v_slots
    from public.game_corner_slots m left join public.profiles p on p.id = m.user_id;

  return jsonb_build_object(
    'now', now(),
    'open', s.is_open,
    'caps', jsonb_build_object('min', s.min_bet, 'slots', s.slots_max_bet, 'roulette', s.roulette_max_bet, 'blackjack', s.blackjack_max_bet,
                               'high', jsonb_build_object('min', s.high_min_bet, 'slots', s.high_slots_max_bet, 'roulette', s.high_roulette_max_bet, 'blackjack', s.high_blackjack_max_bet)),
    'sound', jsonb_build_object('music', s.music_level, 'ambience', s.ambience_level),
    'balance', public.token_balance(me),
    'slots', v_slots,
    'roulette', public.game_corner_roulette_view(me, 1),
    'roulette_high', public.game_corner_roulette_view(me, 2),
    'blackjack', public.game_corner_bj_view(me));
end $$;

revoke execute on function public.set_game_corner_sound(integer, integer) from public, anon;
grant execute on function public.set_game_corner_sound(integer, integer) to authenticated;
revoke execute on function public.game_corner_state() from public, anon;
grant execute on function public.game_corner_state() to authenticated;
