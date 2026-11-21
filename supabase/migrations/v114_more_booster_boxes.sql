-- Three more booster boxes, beside Base Set (v62) and Fossil (v95): Jungle,
-- Team Rocket and One Piece's Romance Dawn (OP-01). Like them, each is kept
-- sealed in your collection (v63) and opened later into its unopened packs,
-- each one of the set's wrappers at random (open_box), and can be sold on the
-- market or shown on the shelf.
--
-- Jungle and Team Rocket: 1st Edition boxes of 36 packs, on the Fossil box's
-- terms (36 tokens, 5 boxes, one per trainer, on the shelf 15% of restocks).
-- Romance Dawn: the English display of 24 packs of 12 cards, so 24 tokens, on
-- the same terms otherwise. Images: /products/<set>-booster-box.webp. Change
-- any of it in Admin -> VVM -> Packs. Safe to re-run.
insert into public.vending_boxes (set_code, name, description, packs, token_price, total_quantity, per_user_limit, appearance_rate, sort_order, image_url)
values
  ('base2', 'Jungle Booster Box',
   'A sealed 1st Edition box of 36 Jungle packs: Wigglytuff, Scyther and Flareon wrappers, with Snorlax, Scyther, Vaporeon and Mr. Mime among the holos. 36 packs for 36 tokens, one box per trainer. The packs land in your collection unopened.',
   36, 36, 5, 1, 15, 3, '/products/jungle-booster-box.webp'),
  ('base5', 'Team Rocket Booster Box',
   'A sealed 1st Edition box of 36 Team Rocket packs: Giovanni, Jessie & James, Dark Gyarados and Rocket Gang wrappers, with Dark Charizard, Dark Blastoise and Dark Dragonite among the holos, and Dark Raichu, the secret rare. 36 packs for 36 tokens, one box per trainer. The packs land in your collection unopened.',
   36, 36, 5, 1, 15, 4, '/products/team-rocket-booster-box.webp'),
  ('op01', 'Romance Dawn Booster Box',
   'A sealed display of 24 Romance Dawn packs, 12 cards each: Luffy, Zoro and Law among the Leaders, Shanks and Yamato as the Secret Rares. 24 packs for 24 tokens, one box per trainer. The packs land in your collection unopened.',
   24, 24, 5, 1, 15, 5, '/products/romance-dawn-booster-box.webp')
on conflict (set_code, name) do nothing;
