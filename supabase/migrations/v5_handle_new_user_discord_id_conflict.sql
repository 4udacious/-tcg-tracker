-- Harden handle_new_user against a discord_id unique violation.
--
-- profiles has UNIQUE (discord_id), but the trigger's ON CONFLICT clause only
-- covered (id). If a Discord account signed up again under a new auth.users id
-- while an older profile row still held that discord_id, the insert raised an
-- unhandled unique_violation. That aborted the INSERT into auth.users, so the
-- signup was rolled back entirely and the user was stuck in a login loop with
-- no account ever being created.
--
-- Fix, in two layers:
--   1. Release the discord_id from any *other* profile row before inserting.
--   2. If a unique violation still slips through (e.g. a concurrent signup),
--      retry with discord_id = NULL rather than aborting. The column is
--      nullable and already NULL for pre-existing rows, so degrading that one
--      field is strictly better than blocking authentication.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_discord_id text := coalesce(
    new.raw_user_meta_data->>'provider_id',
    new.raw_user_meta_data->>'sub'
  );
  v_username text := coalesce(
    new.raw_user_meta_data->>'user_name',
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'full_name'
  );
  v_display_name text := new.raw_user_meta_data->>'full_name';
  v_avatar_url   text := new.raw_user_meta_data->>'avatar_url';
begin
  -- 1. Release the discord_id from any stale profile belonging to another user.
  if v_discord_id is not null then
    update public.profiles
       set discord_id = null
     where discord_id = v_discord_id
       and id <> new.id;
  end if;

  insert into public.profiles (id, discord_id, username, display_name, avatar_url, role)
  values (new.id, v_discord_id, v_username, v_display_name, v_avatar_url, 'pending')
  on conflict (id) do update
    set discord_id = excluded.discord_id,
        username   = excluded.username,
        avatar_url = excluded.avatar_url;

  return new;

exception
  -- 2. Last-resort fallback: never let profile bookkeeping block a signup.
  when unique_violation then
    raise warning 'handle_new_user: discord_id conflict for %, inserting without it', new.id;
    insert into public.profiles (id, discord_id, username, display_name, avatar_url, role)
    values (new.id, null, v_username, v_display_name, v_avatar_url, 'pending')
    on conflict (id) do update
      set username   = excluded.username,
          avatar_url = excluded.avatar_url;
    return new;
end;
$function$;
