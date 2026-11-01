-- Full Heal in the machine's supply catalog: cures any status (poison, bad
-- poison, paralysis, burn, freeze, sleep) in the battle game. Bought at the
-- VVM it lands in user_items like the other items, and the game collects it
-- into the Bag (battle_take_items; the game maps full_heal to its own
-- 'fullheal', which it already had for Play mode and battle rewards).
--
-- On from the start, at the game's own defaults (0.50 tokens, on the shelf
-- 1 stocked tap in 10); change either in Admin -> VVM. Safe to re-run.
insert into public.vvm_supplies (key, kind, name, description, token_price, appearance_rate, is_active, sort_order)
values ('full_heal', 'item', 'Full Heal', 'Cures any status', 0.5, 10, true, 35)
on conflict (key) do nothing;
