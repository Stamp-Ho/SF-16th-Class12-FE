-- Avalon state includes secret roles and unrevealed actions. Keep direct access
-- to the state table revoked even while row level security is disabled.
alter table public.avalon_rooms disable row level security;

-- Signals contain only room IDs and versions and are readable by signed-in users.
drop policy if exists "Authenticated users can see room change signals"
  on public.avalon_room_signals;
alter table public.avalon_room_signals disable row level security;
