-- More product photos for the games v71 added.
--
--   Booster boxes from TCGplayer's product images (product-images.tcgplayer.com):
--     FB09 Dual Evolution (670183), FB10 Cross Force (675645),
--     FB11 Brightness of Hope (695727), GD04 Phantom Aria (682302).
--   Magic Play Boosters (Single Packs) for Lorwyn Eclipsed, Reality Fracture,
--     Secrets of Strixhaven and Teenage Mutant Ninja Turtles, cut out of the
--     Play Booster shots on magic.wizards.com (the same photos as v71's
--     Play Booster Box images). The Hobbit's shot shows the German pack, so it
--     isn't used.
--
-- Put on white, 200 px wide, named by the same slug rule as v8, v45, v70 and
-- v71. Only fills an empty image_url, so an image set from the admin catalog
-- is never replaced. Safe to re-run.

update public.products p
   set image_url = '/products/'
       || trim(both '-' from lower(regexp_replace(s.name || ' ' || p.name, '[^a-zA-Z0-9]+', '-', 'g')))
       || '.jpg'
  from public.sets s, (values
    ('FB09 Dual Evolution', 'Booster Box'), ('FB10 Cross Force', 'Booster Box'),
    ('FB11 Brightness of Hope', 'Booster Box'), ('GD04 Phantom Aria', 'Booster Box'),
    ('Lorwyn Eclipsed', 'Single Packs'), ('Reality Fracture', 'Single Packs'),
    ('Secrets of Strixhaven', 'Single Packs'), ('Teenage Mutant Ninja Turtles', 'Single Packs')
  ) as v(set_name, product_name)
 where s.id = p.set_id
   and s.name = v.set_name
   and p.name = v.product_name
   and p.image_url is null;
