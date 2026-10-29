-- Shareable interest-check links.
--
-- A member can turn on a link to their interest list and send it to anyone
-- (friends, a card shop, Discord). It opens a read-only page,
-- /share/interest/<token>, that works without signing in. The page shows the
-- member's name and their live entries (still in date, or "forever"), with
-- each product's set, game, photo and note.
--
-- The token is random (32 hex characters), never the username, so links can't
-- be guessed. Resetting swaps in a new token, so an old link stops working;
-- turning the link off deletes it. Pending members get no page.
--
-- The table has no policies and is reached only through these functions:
--   interest_share_token()         the caller's current token, or null
--   create_interest_share_link()   makes a token, or replaces the old one (reset)
--   revoke_interest_share_link()   turns the link off
--   shared_interest_list(token)    the public page's data; also granted to anon

create table if not exists public.interest_share_links (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  token      text not null unique,
  created_at timestamptz not null default now()
);

alter table public.interest_share_links enable row level security;

create or replace function public.interest_share_token()
returns text
language sql stable security definer set search_path to 'public' as $$
  select token from public.interest_share_links where user_id = auth.uid();
$$;

create or replace function public.create_interest_share_link()
returns text
language plpgsql security definer set search_path to 'public' as $$
declare
  v_token text := replace(gen_random_uuid()::text, '-', '');
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  insert into public.interest_share_links (user_id, token)
  values (auth.uid(), v_token)
  on conflict (user_id) do update set token = excluded.token, created_at = now();
  return v_token;
end;
$$;

create or replace function public.revoke_interest_share_link()
returns void
language sql security definer set search_path to 'public' as $$
  delete from public.interest_share_links where user_id = auth.uid();
$$;

-- One row per live entry; a member with nothing tracked gets one row with the
-- name and null product fields, so the page can still say who it belongs to.
create or replace function public.shared_interest_list(p_token text)
returns table (
  display_name text, product_name text, set_name text, game text,
  image_url text, note text, forever boolean, added_at timestamptz
)
language sql stable security definer set search_path to 'public' as $$
  with owner as (
    select pr.id, coalesce(nullif(pr.display_name, ''), pr.username) as name
      from public.interest_share_links l
      join public.profiles pr on pr.id = l.user_id
     where l.token = p_token
       and pr.role <> 'pending'
  )
  select o.name, p.name, s.name, s.game, p.image_url, pi.note,
         pi.expires_at is null, pi.created_at
    from owner o
    left join public.product_interest pi
      on pi.user_id = o.id
     and (pi.expires_at is null or pi.expires_at > now())
    left join public.products p on p.id = pi.product_id
    left join public.sets s on s.id = p.set_id
   order by s.game nulls last, s.sort_order, s.name, p.sort_order, p.name;
$$;

revoke all on function public.create_interest_share_link() from public, anon;
revoke all on function public.revoke_interest_share_link() from public, anon;
revoke all on function public.interest_share_token() from public, anon;
grant execute on function public.create_interest_share_link() to authenticated;
grant execute on function public.revoke_interest_share_link() to authenticated;
grant execute on function public.interest_share_token() to authenticated;
grant execute on function public.shared_interest_list(text) to anon, authenticated;
