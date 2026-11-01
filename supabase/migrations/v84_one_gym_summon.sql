-- One Gym Summon at a time. The battle game already won't sell one while
-- there's a summon in your Bag; this is the server's backstop for a second
-- device or a crafted request.
--
-- Buying puts supplies in user_items (vending_checkout, v66), which the game
-- then collects into its Bag (battle_take_items sets the count back to 0).
-- A purchase that would leave a member holding more than one Gym Summon -
-- one still waiting in user_items, or one in their saved Bag
-- (game_saves.data.bag, keys summon:<gym>) - raises gym_summon_limit, which
-- undoes the whole checkout (no tokens spent). The game shows "you already
-- have a Gym Summon: use it first".
--
-- Only increases are checked, so collecting (setting the count to 0) is
-- never refused. Safe to re-run.

create or replace function public.one_gym_summon()
returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if new.item_key <> 'gym_summon' or new.qty <= coalesce(case when tg_op = 'UPDATE' then old.qty end, 0) then
    return new;
  end if;
  if new.qty > 1 or exists (
    select 1 from public.game_saves g, jsonb_each_text(coalesce(g.data->'bag', '{}'::jsonb)) b
     where g.user_id = new.user_id and b.key ~ '^summon:[0-9]+$' and b.value ~ '^[0-9.]+$' and b.value::numeric > 0
  ) then
    raise exception 'gym_summon_limit' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists user_items_one_gym_summon on public.user_items;
create trigger user_items_one_gym_summon
  before insert or update of qty on public.user_items
  for each row execute function public.one_gym_summon();

revoke all on function public.one_gym_summon() from public, anon, authenticated;
