-- The slots by room: you pick the main floor or the high-limit room (as at the roulette and the blackjack tables), and
-- a free machine there is yours, instead of picking a machine. The page shows only the machines people are at, so
-- they appear as seats fill.
--
-- game_corner_slot_take(high): keeps the machine you're at if it's in that room; otherwise the first free one there
-- (nobody's, or nobody's looked in 2 minutes), moving you from any other. 'room_full' if there's none.
-- game_corner_slot_sit and _leave (v115) stay for pages from before this.
--
-- Safe to re-run.

create or replace function public.game_corner_slot_take(p_high boolean)
returns smallint
language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); v_machine smallint;
begin
  if not public.is_member() then raise exception 'members_only' using errcode = 'P0001'; end if;
  if not (select g.is_open from public.game_corner_settings g where g.id) and not public.is_admin() then raise exception 'closed' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtext('game_corner:' || me::text));
  select machine into v_machine from public.game_corner_slots where user_id = me and high_roller = coalesce(p_high, false);
  if v_machine is not null then
    update public.game_corner_slots set seen_at = now() where machine = v_machine;
    return v_machine;
  end if;
  -- The first free machine in the room (an empty one before one whose player has wandered off); two people asking at
  -- once get different ones.
  select machine into v_machine from public.game_corner_slots
   where high_roller = coalesce(p_high, false) and (user_id is null or seen_at < now() - interval '2 minutes')
   order by user_id is not null, machine
   limit 1
   for update skip locked;
  if v_machine is null then raise exception 'room_full' using errcode = 'P0001'; end if;
  update public.game_corner_slots set user_id = null where user_id = me;
  update public.game_corner_slots
     set user_id = me, seen_at = now(), last_reels = null, last_lines = null, last_bet = null, last_win = null, last_at = null
   where machine = v_machine;
  return v_machine;
end $$;

revoke execute on function public.game_corner_slot_take(boolean) from public, anon;
grant execute on function public.game_corner_slot_take(boolean) to authenticated;
