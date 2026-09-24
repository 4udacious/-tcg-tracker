-- Serve product images from our own /public/products instead of TCGplayer's CDN.
--
-- v7 seeded image_url with TCGplayer CDN links. Those worked but left the
-- images dependent on a third party that could block hotlinking at any time.
-- The files now live in the repo and are served by our own domain.
--
-- Filenames are derived from set name + product name, slugified: lowercased,
-- every run of non-alphanumeric characters collapsed to a single dash, and
-- leading/trailing dashes trimmed. That mirrors exactly how the files were
-- named on disk, so this rewrite needs no per-product lookup table.
--
-- Scoped to rows still pointing at the TCGplayer CDN, so any image an admin
-- has since set by hand is left alone.

update public.products p
   set image_url = '/products/'
                || trim(both '-' from
                     lower(regexp_replace(s.name || ' ' || p.name, '[^a-zA-Z0-9]+', '-', 'g'))
                   )
                || '.jpg'
  from public.sets s
 where p.set_id = s.id
   and p.image_url like 'https://tcgplayer-cdn.tcgplayer.com/%';
