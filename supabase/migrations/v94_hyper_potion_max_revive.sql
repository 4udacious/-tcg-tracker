-- Hyper Potion and Max Revive in the machine's supply catalog. In the battle
-- game a Hyper Potion heals 90% of a Pokémon's HP (after the Potion's 30% and
-- the Super Potion's 60%), and a Max Revive brings a fainted one back at full
-- HP (a Revive, half). Bought at the VVM they land in user_items like the
-- other items, and the game collects them into the Bag (battle_take_items; it
-- maps hyper_potion to 'hyper' and max_revive to 'maxrevive'). A game from
-- before this asks only for keys it knows, so one bought before a member
-- updates waits on the account.
--
-- On from the start; prices, shelf chances and limits set above the Super
-- Potion and Revive; change any of it in Admin -> VVM. Safe to re-run.
insert into public.vvm_supplies (key, kind, name, description, token_price, appearance_rate, is_active, sort_order, max_per_checkout, daily_limit) values
  ('hyper_potion', 'item', 'Hyper Potion', 'Heals 90% HP', 0.90, 12, true, 25, 3, 6),
  ('max_revive', 'item', 'Max Revive', 'Revives a fainted Pokémon at full HP', 1.20, 8, true, 32, 2, 4)
on conflict (key) do nothing;
