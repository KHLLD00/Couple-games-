-- The security-hardening migration created rooms_members_select /
-- rounds_members_select but never dropped the original permissive
-- rooms_read / rounds_read policies (using (true), public role).
-- Postgres OR's RLS policies together, so the open policies were still
-- letting anyone with the anon key read every room and round.
drop policy if exists "rooms_read" on public.rooms;
drop policy if exists "rounds_read" on public.rounds;
