-- One clean per card, for good.
--
-- Each clean takes 10-30% off whatever wear is left and may flatten a
-- crease, so sending the same card back again and again would walk any card
-- up toward mint for 2 tokens a time. A copy can now be cleaned once.
--
-- The count lives on the card itself, so it follows the card through the
-- market and through being slabbed and cracked: buying a cleaned card, or
-- cracking one, does not buy another clean. It is counted when the card is
-- sent, so a card at the cleaners already has its one.
--
-- No backfill: no card had been cleaned before this went in.

alter table public.user_cards
  add column if not exists times_cleaned smallint not null default 0;

create or replace function public.submit_for_cleaning(p_user_card_id bigint)
returns table (ok boolean, reason text, ready_at timestamptz, balance numeric)
language plpgsql security definer set search_path to 'public' as $function$
declare me uuid := auth.uid(); v_card public.user_cards; v_cost numeric(12,2); v_days numeric; v_ready timestamptz;
begin
  select s.cleaning_cost, s.cleaning_days into v_cost, v_days from public.vending_settings s where s.id;
  select * into v_card from public.user_cards where id = p_user_card_id for update;
  if v_card.id is null or v_card.user_id <> me then return query select false, 'not_yours', null::timestamptz, public.token_balance(me); return; end if;
  if v_card.market_listing_id is not null then return query select false, 'listed', null::timestamptz, public.token_balance(me); return; end if;
  if v_card.graded_at is not null or v_card.grading_started_at is not null then return query select false, 'not_raw', null::timestamptz, public.token_balance(me); return; end if;
  if v_card.cleaning_started_at is not null then return query select false, 'already_cleaning', v_card.cleaning_ready_at, public.token_balance(me); return; end if;
  if v_card.times_cleaned >= 1 then return query select false, 'already_cleaned', null::timestamptz, public.token_balance(me); return; end if;
  if public.token_balance(me) < v_cost then return query select false, 'insufficient_tokens', null::timestamptz, public.token_balance(me); return; end if;
  perform public.spend_tokens(me, v_cost, 'cleaning', 'Card cleaning');
  v_ready := now() + make_interval(mins => round(v_days * 24 * 60)::int);
  update public.user_cards
     set cleaning_started_at = now(), cleaning_ready_at = v_ready, times_cleaned = times_cleaned + 1
   where id = p_user_card_id;
  delete from public.showcase_slots where user_id = me and user_card_id = p_user_card_id;
  return query select true, 'ok', v_ready, public.token_balance(me);
end $function$;
