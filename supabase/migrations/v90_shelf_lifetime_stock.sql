-- The machine's shelf showed each set's restock quantity (vending_stock) and
-- ignored its lifetime inventory (vending_set_info: total_quantity -
-- claimed_quantity). A set sold out for good could still show "1 left" (a
-- restock had put 4 Neo Discovery packs out when at most one was left), and
-- checkout then refused it as set_sold_out: muoli's "sold out when I buy
-- them together" after the last pack of each had gone.
--
-- get_vending_stock now reports the smaller of the two, so a set with none
-- left for good shows 0 and the game leaves it off the shelf (it already
-- hides packs at 0), and the cart can't hold more than is really left.
-- Same signature and columns; checkout already enforced both. Safe to re-run.
create or replace function public.get_vending_stock(p_cycle bigint)
returns table (set_code text, set_name text, display_image_url text, quantity integer, description text)
language sql stable security definer set search_path to 'public' as $function$
  select s.set_code, p.set_name, p.image_url,
         greatest(0, least(s.quantity, coalesce(i.total_quantity - i.claimed_quantity, s.quantity)))::integer,
         i.description
    from public.vending_stock s
    join public.vending_packs p on p.id = s.display_pack_id
    left join public.vending_set_info i on i.set_code = s.set_code
   where s.cycle_no = p_cycle
   order by p.sort_order;
$function$;
