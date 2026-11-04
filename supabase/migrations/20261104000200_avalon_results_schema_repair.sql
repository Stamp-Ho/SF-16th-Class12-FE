-- Repair databases that created avalon_game_results before player_name was added.
alter table public.avalon_game_results
  add column if not exists player_name text;

-- Recover names for already recorded games when their final room state remains.
update public.avalon_game_results as result
set player_name = coalesce(
  (select player.value->>'name'
   from public.avalon_rooms as room
   cross join lateral jsonb_array_elements(room.state->'players') as player(value)
   where room.id = result.room_id
     and player.value->>'id' = result.player_id::text
   limit 1),
  (select account.raw_user_meta_data->>'name'
   from auth.users as account
   where account.id = result.player_id),
  result.player_id::text
)
where result.player_name is null or result.player_name = '';

alter table public.avalon_game_results
  alter column player_name set not null;

create or replace function public.avalon_record_game_result()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.state->>'phase' is distinct from 'finished' and new.state->>'phase' = 'finished' then
    insert into public.avalon_game_results (game_id, room_id, player_id, player_name, side, won)
    select coalesce((new.state->>'gameId')::uuid, new.id), new.id,
      (player.value->>'id')::uuid, player.value->>'name',
      coalesce(player.value->>'currentSide', player.value->>'side'),
      coalesce(player.value->>'currentSide', player.value->>'side') = new.state->>'winner'
    from jsonb_array_elements(new.state->'players') as player(value)
    on conflict (game_id, player_id) do nothing;
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.avalon_rooms'::regclass
      and tgname = 'avalon_record_game_result'
  ) then
    create trigger avalon_record_game_result
    after update on public.avalon_rooms
    for each row execute function public.avalon_record_game_result();
  end if;
end;
$$;

insert into public.avalon_game_results (game_id, room_id, player_id, player_name, side, won, completed_at)
select coalesce((room.state->>'gameId')::uuid, room.id), room.id,
  (player.value->>'id')::uuid, player.value->>'name',
  coalesce(player.value->>'currentSide', player.value->>'side'),
  coalesce(player.value->>'currentSide', player.value->>'side') = room.state->>'winner',
  room.updated_at
from public.avalon_rooms as room
cross join lateral jsonb_array_elements(room.state->'players') as player(value)
where room.state->>'phase' = 'finished'
  and room.state->>'winner' in ('good', 'evil')
  and coalesce(player.value->>'currentSide', player.value->>'side') in ('good', 'evil')
on conflict (game_id, player_id) do nothing;

drop view if exists public.avalon_player_stats;
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
