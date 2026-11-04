create table public.avalon_game_results (
  game_id uuid not null,
  room_id uuid not null,
  player_id uuid not null references auth.users(id),
  player_name text not null,
  side text not null check (side in ('good', 'evil')),
  won boolean not null,
  completed_at timestamptz not null default now(),
  primary key (game_id, player_id)
);

alter table public.avalon_game_results enable row level security;
revoke all on public.avalon_game_results from anon, authenticated;

create function public.avalon_record_game_result()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.state->>'phase' is distinct from 'finished' and new.state->>'phase' = 'finished' then
    insert into public.avalon_game_results (game_id, room_id, player_id, player_name, side, won)
    select coalesce((new.state->>'gameId')::uuid, new.id), new.id, (p.value->>'id')::uuid, p.value->>'name', p.value->>'currentSide',
      p.value->>'currentSide' = new.state->>'winner'
    from jsonb_array_elements(new.state->'players') as p(value)
    on conflict (game_id, player_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger avalon_record_game_result
after update on public.avalon_rooms
for each row execute function public.avalon_record_game_result();

-- Migrate games that finished before this trigger existed.
insert into public.avalon_game_results (game_id, room_id, player_id, player_name, side, won, completed_at)
select coalesce((room.state->>'gameId')::uuid, room.id), room.id,
  (p.value->>'id')::uuid, p.value->>'name',
  coalesce(p.value->>'currentSide', p.value->>'side'),
  coalesce(p.value->>'currentSide', p.value->>'side') = room.state->>'winner',
  room.updated_at
from public.avalon_rooms as room
cross join lateral jsonb_array_elements(room.state->'players') as p(value)
where room.state->>'phase' = 'finished'
  and room.state->>'winner' in ('good', 'evil')
  and coalesce(p.value->>'currentSide', p.value->>'side') in ('good', 'evil')
on conflict (game_id, player_id) do nothing;

create view public.avalon_player_stats as
select player_id,
  (array_agg(player_name order by completed_at desc))[1] as player_name,
  count(*)::integer as games,
  count(*) filter (where won)::integer as wins,
  count(*) filter (where side = 'good')::integer as good_games,
  count(*) filter (where side = 'good' and won)::integer as good_wins,
  count(*) filter (where side = 'evil')::integer as evil_games,
  count(*) filter (where side = 'evil' and won)::integer as evil_wins
from public.avalon_game_results
group by player_id;
revoke all on public.avalon_player_stats from anon, authenticated;
grant select on public.avalon_player_stats to service_role;
