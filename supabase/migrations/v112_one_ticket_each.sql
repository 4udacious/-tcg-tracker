-- One of each rematch and double battle ticket at a time.
--
-- A member may hold tickets for different opponents (Falkner's and Bugsy's
-- rematches, Brock & Misty's double battle), but only one for each: another
-- for the same battle once that one is used. The battle game already greys
-- out a ticket you hold; this is the server's backstop, like one_gym_summon
-- (v84).
--
-- Buying puts a supply in user_items (vending_checkout), which the game then
-- collects into its Bag (battle_take_items sets the count back to 0). A
-- purchase that would leave a member with more than one of the same ticket -
-- one still waiting in user_items, or one in their saved Bag
-- (game_saves.data.bag: rematch_<id> is rematch:<id> there, double_<id> is
-- double:<id>) - raises ticket_limit, which undoes the whole checkout (no
-- tokens spent). The game says "you already have that ticket: use it first".
--
-- Tickets already held stay: a member with two of the same keeps both, and
-- can buy another once they've used them. Only increases are checked, so
-- collecting (setting the count to 0) is never refused. Safe to re-run.

create or replace function public.one_ticket_each()
returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare
  v_bag text;
begin
  if new.qty <= coalesce(case when tg_op = 'UPDATE' then old.qty end, 0) then return new; end if;
  if new.item_key like 'rematch\_%' then v_bag := 'rematch:' || substr(new.item_key, 9);
  elsif new.item_key like 'double\_%' then v_bag := 'double:' || substr(new.item_key, 8);
  else return new;
  end if;
  if new.qty > 1 or exists (
    select 1 from public.game_saves g
     where g.user_id = new.user_id
       and coalesce(g.data->'bag'->>v_bag, '0') ~ '^[0-9.]+$'
       and (g.data->'bag'->>v_bag)::numeric > 0
  ) then
    raise exception 'ticket_limit' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists user_items_one_ticket_each on public.user_items;
create trigger user_items_one_ticket_each
  before insert or update of qty on public.user_items
  for each row execute function public.one_ticket_each();

revoke all on function public.one_ticket_each() from public, anon, authenticated;
