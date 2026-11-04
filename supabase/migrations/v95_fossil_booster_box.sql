-- A Fossil Booster Box, beside the Base Set one (v62): a sealed 1st Edition
-- box of 36 Fossil packs. Like it, it's kept sealed in your collection (v63)
-- and opened later into 36 unopened packs, each one of Fossil's wrappers
-- (Zapdos, Aerodactyl or Lapras) at random (open_box), and can be sold on the
-- market or shown on the shelf.
--
-- The Base Set box's terms: 36 tokens, 5 boxes, one per trainer, on the shelf
-- 15% of restocks. Image: /products/fossil-booster-box.webp. Change any of it
-- in Admin -> VVM -> Packs. Safe to re-run.
insert into public.vending_boxes (set_code, name, description, packs, token_price, total_quantity, per_user_limit, appearance_rate, sort_order, image_url)
values ('base3', 'Fossil Booster Box',
        'A sealed 1st Edition box of 36 Fossil packs: Zapdos, Aerodactyl and Lapras wrappers, with Dragonite, Gengar and the legendary birds among the holos. 36 packs for 36 tokens, one box per trainer. The packs land in your collection unopened.',
        36, 36, 5, 1, 15, 2, '/products/fossil-booster-box.webp')
on conflict (set_code, name) do nothing;
