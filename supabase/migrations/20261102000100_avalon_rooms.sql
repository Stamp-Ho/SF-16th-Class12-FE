create table if not exists public.avalon_rooms (
  id uuid primary key default gen_random_uuid(),
  host_user_id uuid not null references auth.users(id),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  version bigint not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists avalon_rooms_host_idx on public.avalon_rooms(host_user_id);
create index if not exists avalon_rooms_state_idx on public.avalon_rooms using gin(state jsonb_path_ops);

-- All game state, including hidden roles and unflipped cards, is private.
-- Only authenticated server actions using the service role read this table.
alter table public.avalon_rooms enable row level security;
revoke all on public.avalon_rooms from anon, authenticated;

-- Realtime sends only a room ID and version. Hidden game state stays private.
create table if not exists public.avalon_room_signals (
  room_id uuid primary key references public.avalon_rooms(id) on delete cascade,
  version bigint not null,
  updated_at timestamptz not null default now()
);
alter table public.avalon_room_signals enable row level security;
grant select on public.avalon_room_signals to authenticated;
create policy "Authenticated users can see room change signals"
  on public.avalon_room_signals for select to authenticated using (true);

create or replace function public.avalon_signal_room_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    delete from public.avalon_room_signals where room_id = old.id;
    return old;
  end if;
  insert into public.avalon_room_signals(room_id, version, updated_at)
  values(new.id, new.version, now())
  on conflict(room_id) do update set version = excluded.version, updated_at = excluded.updated_at;
  return new;
end;
$$;
create trigger avalon_room_change_signal
after insert or update or delete on public.avalon_rooms
for each row execute function public.avalon_signal_room_change();

alter publication supabase_realtime add table public.avalon_room_signals;
