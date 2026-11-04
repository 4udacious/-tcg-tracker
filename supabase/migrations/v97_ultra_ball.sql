-- Ultra Ball in the machine's supply catalog. In the battle game it catches at
-- ×2 (a Poké Ball ×1, a Great Ball ×1.5: game.js BALL_CATCH). Bought at the
-- VVM it lands in user_items like the other items, and the game collects it
-- into the Bag (it maps ultra_ball to 'ultra'). A game from before this asks
-- only for keys it knows, so one bought before a member updates waits on the
-- account.
--
-- On from the start; priced and stocked above the Great Ball; change any of it
-- in Admin -> VVM. Safe to re-run.
insert into public.vvm_supplies (key, kind, name, description, token_price, appearance_rate, is_active, sort_order, max_per_checkout, daily_limit) values
  ('ultra_ball', 'item', 'Ultra Ball', 'Catch rate ×2', 0.70, 8, true, 55, 10, null)
on conflict (key) do nothing;
