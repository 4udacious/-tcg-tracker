-- Trade binder appearance: each member can give their binder a title, a
-- cover colour and pattern, a page layout (9-pocket pages or a plain grid)
-- and the order visitors see it in first. Kept beside the "looking for" note
-- (trade_binder_notes), returned as `style` by trade_binder() and
-- trade_binders(), set with trade_binder_set_style(). Safe to re-run.

alter table public.trade_binder_notes add column if not exists title text;
alter table public.trade_binder_notes add column if not exists cover text not null default 'red';
alter table public.trade_binder_notes add column if not exists pattern text not null default 'plain';
alter table public.trade_binder_notes add column if not exists layout text not null default 'pages';
alter table public.trade_binder_notes add column if not exists sort text not null default 'set';
alter table public.trade_binder_notes drop constraint if exists trade_binder_notes_style_check;
alter table public.trade_binder_notes add constraint trade_binder_notes_style_check check (
  (title is null or char_length(title) <= 40)
  and cover in ('red', 'blue', 'green', 'purple', 'black', 'gold', 'pink', 'teal')
  and pattern in ('plain', 'dots', 'stripes', 'holo', 'stars')
  and layout in ('pages', 'grid')
  and sort in ('set', 'name', 'rarity', 'grade', 'newest'));

/** A member's binder style as the client reads it (defaults when they've never set one). */
create or replace function public.trade_binder_style(p_user uuid)
returns jsonb language sql stable security definer set search_path to 'public' as $function$
  select coalesce((select jsonb_build_object('title', n.title, 'cover', n.cover, 'pattern', n.pattern, 'layout', n.layout, 'sort', n.sort)
    from public.trade_binder_notes n where n.user_id = p_user),
    jsonb_build_object('title', null, 'cover', 'red', 'pattern', 'plain', 'layout', 'pages', 'sort', 'set'))
$function$;
revoke all on function public.trade_binder_style(uuid) from public, anon, authenticated;

/** Set your binder's look. Unknown values fall back to the defaults rather than failing. */
create or replace function public.trade_binder_set_style(p_title text, p_cover text, p_pattern text, p_layout text, p_sort text)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare me uuid := auth.uid();
  v_title text := nullif(btrim(left(coalesce(p_title, ''), 40)), '');
  v_cover text := case when p_cover in ('red', 'blue', 'green', 'purple', 'black', 'gold', 'pink', 'teal') then p_cover else 'red' end;
  v_pattern text := case when p_pattern in ('plain', 'dots', 'stripes', 'holo', 'stars') then p_pattern else 'plain' end;
  v_layout text := case when p_layout in ('pages', 'grid') then p_layout else 'pages' end;
  v_sort text := case when p_sort in ('set', 'name', 'rarity', 'grade', 'newest') then p_sort else 'set' end;
begin
  if me is null or not public.is_member() then return null; end if;
  insert into public.trade_binder_notes (user_id, title, cover, pattern, layout, sort, updated_at)
  values (me, v_title, v_cover, v_pattern, v_layout, v_sort, now())
  on conflict (user_id) do update set title = excluded.title, cover = excluded.cover, pattern = excluded.pattern,
    layout = excluded.layout, sort = excluded.sort, updated_at = now();
  return public.trade_binder_style(me);
end $function$;
revoke all on function public.trade_binder_set_style(text, text, text, text, text) from public, anon;
grant execute on function public.trade_binder_set_style(text, text, text, text, text) to authenticated;

/** One member's binder: their name, note, style and every free item in it. */
create or replace function public.trade_binder(p_user uuid)
returns jsonb language sql stable security definer set search_path to 'public' as $function$
  select case when public.is_member() then jsonb_build_object(
    'user_id', p.id, 'username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url,
    'note', (select note from public.trade_binder_notes where user_id = p.id),
    'style', public.trade_binder_style(p.id),
    'items', coalesce((select jsonb_agg(x) from public.trade_binder_free_items(p.id) x), '[]'::jsonb))
  end
  from public.profiles p where p.id = p_user
$function$;
revoke all on function public.trade_binder(uuid) from public, anon;
grant execute on function public.trade_binder(uuid) to authenticated;

-- The list gains a column, so it's dropped and made again (in this one transaction).
drop function if exists public.trade_binders();
create function public.trade_binders()
returns table(user_id uuid, username text, display_name text, avatar_url text, note text, items integer, images text[], updated_at timestamptz, style jsonb)
language sql stable security definer set search_path to 'public' as $function$
  with b as (
    select i.user_id, array_agg(x->>'image_url') filter (where x->>'image_url' is not null) imgs, count(*)::int n
    from (select distinct user_id from public.trade_binder_items) i
    cross join lateral public.trade_binder_free_items(i.user_id) x
    group by i.user_id
  )
  select p.id, p.username, p.display_name, p.avatar_url, nt.note, b.n, b.imgs[1:4],
    greatest(nt.updated_at, (select max(added_at) from public.trade_binder_items t where t.user_id = p.id)),
    public.trade_binder_style(p.id)
  from b join public.profiles p on p.id = b.user_id left join public.trade_binder_notes nt on nt.user_id = p.id
  where public.is_member()
  order by 8 desc nulls last
$function$;
revoke all on function public.trade_binders() from public, anon;
grant execute on function public.trade_binders() to authenticated;
