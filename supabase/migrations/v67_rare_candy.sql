-- Rare Candy in the machine's supply catalog: raises one Pokémon a level in
-- the battle game (the Bag, Medicine pocket). Bought at the VVM it lands in
-- user_items like the other items, and the game collects it into the Bag
-- (battle_take_items; the game maps rare_candy to its own 'rarecandy').
--
-- Off to start with, like every supply: switch it on, and set its price and
-- appearance rate, in admin. The game also hands Rare Candies out as battle
-- rewards (Gym Leaders, Alex, Herb and Paul); those go straight into the
-- game's save and need nothing here.
insert into public.vvm_supplies (key, kind, name, description, token_price, appearance_rate, is_active, sort_order)
values ('rare_candy', 'item', 'Rare Candy', 'Raises one Pokémon a level', 1.5, 10, false, 85)
on conflict (key) do nothing;
