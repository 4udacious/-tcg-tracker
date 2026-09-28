-- Cap how many copies of a raffle ticket one member may hold.
--
-- Already applied to the live database. Kept here as the record of the change.
--
-- NULL means no cap. The check lives in vending_checkout rather than in a
-- constraint, because the limit is about a member's holdings across rows, not
-- about any single row.

alter table public.raffle_tickets
  add column if not exists per_user_limit integer
  check (per_user_limit is null or per_user_limit > 0);

-- get_vending_ticket_stock gains per_user_limit and the viewer's current
-- holding, so the machine can grey out a ticket they have maxed rather than
-- letting them cart it and fail at checkout. Return type changes, so drop.
drop function if exists public.get_vending_ticket_stock(bigint);

create function public.get_vending_ticket_stock(p_cycle bigint)
returns table (
  ticket_id bigint, name text, description text, rarity text, image_url text,
  token_price integer, quantity integer, remaining integer,
  per_user_limit integer, owned integer
)
language sql
security definer
set search_path to 'public'
as $function$
  select t.id, t.name, t.description, t.rarity, t.image_url, t.token_price,
         s.quantity,
         (t.total_quantity - t.claimed_quantity) as remaining,
         t.per_user_limit,
         coalesce((select count(*)::int from public.user_raffle_tickets u
                    where u.ticket_id = t.id and u.user_id = auth.uid()), 0) as owned
    from public.vending_ticket_stock s
    join public.raffle_tickets t on t.id = s.ticket_id
   where s.cycle_no = p_cycle
     and t.is_active
   order by public.raffle_rarity_chance(t.rarity) asc, t.name;
$function$;

-- vending_checkout keeps its signature and return type; the ticket validation
-- loop gains this check, counted under the row lock already taken on
-- raffle_tickets so two concurrent checkouts cannot both slip past it:
--
--   if v_limit is not null then
--     select count(*) into v_owned from user_raffle_tickets
--      where ticket_id = it.ticket_id and user_id = me;
--     if v_owned + it.qty > v_limit then
--       return ... 'ticket_limit_reached' ...
--     end if;
--   end if;
--
-- The full body lives in the database.
