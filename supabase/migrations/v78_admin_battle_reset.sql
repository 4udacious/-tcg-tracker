-- Admins can start the battle game over on their own account (Settings →
-- Battles → Start over), to play through from the beginning again.
--
-- admin_reset_my_battle_progress() deletes the caller's account save
-- (game_saves) and their once-per-account payout record (battle_milestones,
-- v77), so replayed badges, League, rival and glitcher wins pay again. The
-- page then clears the browser's copy of the save, which would otherwise
-- upload itself back. Admins only: for members it would be a way to collect
-- the one-time payouts again. Daily battle awards (battle_awards) are left
-- as they are, so the day's limit still counts what was earned today.
--
-- Safe to re-run.

create or replace function public.admin_reset_my_battle_progress()
returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admins only';
  end if;
  delete from public.game_saves where user_id = auth.uid();
  delete from public.battle_milestones where user_id = auth.uid();
end $$;

revoke all on function public.admin_reset_my_battle_progress() from public, anon;
grant execute on function public.admin_reset_my_battle_progress() to authenticated;
