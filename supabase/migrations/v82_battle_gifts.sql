-- Pokémon gifts for the battle game: an admin sends a member a species (for
-- Discord activities, say) from Admin → VVM, and their game collects it.
--
--   battle_gifts                  one row per gift: the species, an optional
--                                 level (null: a wild one's level when it's
--                                 collected), an optional note, who sent it,
--                                 and when it was collected
--   admin_gift_pokemon(user, species, level, note)
--                                 admins: send one
--   battle_pending_gifts()        the caller's gifts not yet collected
--   battle_ack_gifts(ids)         the caller's game has them (in its save):
--                                 mark them collected
--
-- The game rolls each gift as it would a wild Pokémon (random IVs and
-- nature, the same shiny odds) and puts it in the party, or the Box when the
-- party is full. It keeps the ids it has added in its save and only then
-- acknowledges them, so a gift is neither lost (not acknowledged yet: offered
-- again) nor added twice (already in the save: skipped).
--
-- Safe to re-run.

create table if not exists public.battle_gifts (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  species     text not null check (species ~ '^[A-Z0-9 .''♀♂:-]{1,24}$'),
  level       integer check (level between 1 and 100),
  note        text check (char_length(note) <= 120),
  given_by    uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  claimed_at  timestamptz
);
create index if not exists battle_gifts_pending on public.battle_gifts (user_id) where claimed_at is null;
create index if not exists battle_gifts_created_at on public.battle_gifts (created_at desc);

alter table public.battle_gifts enable row level security;
drop policy if exists battle_gifts_select on public.battle_gifts;
create policy battle_gifts_select on public.battle_gifts
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
revoke insert, update, delete, truncate, references, trigger on public.battle_gifts from authenticated;
revoke all on public.battle_gifts from anon;

create or replace function public.admin_gift_pokemon(p_user uuid, p_species text, p_level integer default null, p_note text default null)
returns bigint
language plpgsql security definer set search_path to 'public' as $$
declare
  v_species text := upper(trim(p_species));
  v_id      bigint;
begin
  if not public.is_admin() then
    raise exception 'Only admins can send Pokémon gifts';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_user and p.role <> 'pending') then
    raise exception 'No such member' using errcode = '22023';
  end if;
  if v_species is null or v_species !~ '^[A-Z0-9 .''♀♂:-]{1,24}$' then
    raise exception 'Pick a Pokémon' using errcode = '22023';
  end if;
  if p_level is not null and p_level not between 1 and 100 then
    raise exception 'The level must be between 1 and 100' using errcode = '22023';
  end if;
  insert into public.battle_gifts (user_id, species, level, note, given_by)
  values (p_user, v_species, p_level, nullif(left(trim(coalesce(p_note, '')), 120), ''), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.battle_pending_gifts()
returns table (id bigint, species text, level integer, note text, created_at timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select g.id, g.species, g.level, g.note, g.created_at
    from public.battle_gifts g
   where g.user_id = auth.uid() and g.claimed_at is null and public.is_member()
   order by g.id
   limit 20
$$;

create or replace function public.battle_ack_gifts(p_ids bigint[])
returns integer
language plpgsql security definer set search_path to 'public' as $$
declare n integer;
begin
  update public.battle_gifts g set claimed_at = now()
   where g.user_id = auth.uid() and g.id = any(p_ids) and g.claimed_at is null;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.admin_gift_pokemon(uuid, text, integer, text) from public, anon;
revoke all on function public.battle_pending_gifts() from public, anon;
revoke all on function public.battle_ack_gifts(bigint[]) from public, anon;
grant execute on function public.admin_gift_pokemon(uuid, text, integer, text) to authenticated;
grant execute on function public.battle_pending_gifts() to authenticated;
grant execute on function public.battle_ack_gifts(bigint[]) to authenticated;
