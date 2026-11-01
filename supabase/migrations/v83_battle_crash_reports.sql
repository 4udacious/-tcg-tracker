-- Crash reports from the battle game. Some members' phones reload the game in
-- the middle of a battle (the browser killing the page). The game keeps a
-- small note while a battle is on screen; when it starts and finds the last
-- session ended mid-battle, it sends that note here.
--
--   battle_crash_reports           one row per report: the member, when, the
--                                  note (kind of battle, opponent, the last
--                                  lines shown, the music, script errors,
--                                  game version) and the device (browser,
--                                  screen, memory, cores)
--   battle_report_crash(note, device)
--                                  members: send one (at most 10 a day, each
--                                  part at most 8 KB)
--
-- Admins read them in Admin → VVM → Crash reports; members can't read any.
-- Safe to re-run (no drops: a new table).

create table if not exists public.battle_crash_reports (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  note        jsonb not null,
  device      jsonb not null,
  created_at  timestamptz not null default now()
);
create index if not exists battle_crash_reports_created_at on public.battle_crash_reports (created_at desc);

alter table public.battle_crash_reports enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'battle_crash_reports' and policyname = 'battle_crash_reports_admin') then
    create policy battle_crash_reports_admin on public.battle_crash_reports for select to authenticated using (public.is_admin());
  end if;
end $$;
revoke insert, update, delete, truncate, references, trigger on public.battle_crash_reports from authenticated;
revoke all on public.battle_crash_reports from anon;

create or replace function public.battle_report_crash(p_note jsonb, p_device jsonb)
returns boolean
language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid();
begin
  if me is null or not public.is_member() then return false; end if;
  if p_note is null or jsonb_typeof(p_note) <> 'object' or octet_length(p_note::text) > 8192 then return false; end if;
  if p_device is null or jsonb_typeof(p_device) <> 'object' or octet_length(p_device::text) > 8192 then return false; end if;
  perform pg_advisory_xact_lock(hashtext('battle_crash:' || me::text));
  if (select count(*) from public.battle_crash_reports r where r.user_id = me and r.created_at > now() - interval '1 day') >= 10 then return false; end if;
  insert into public.battle_crash_reports (user_id, note, device) values (me, p_note, p_device);
  return true;
end $$;

revoke all on function public.battle_report_crash(jsonb, jsonb) from public, anon;
grant execute on function public.battle_report_crash(jsonb, jsonb) to authenticated;
