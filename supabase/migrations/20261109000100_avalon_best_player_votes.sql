alter table public.avalon_game_results
  add column if not exists best_player_votes integer not null default 0;

update public.avalon_game_results set best_player_votes = 0 where best_player_votes is null;
alter table public.avalon_game_results alter column best_player_votes set default 0;
alter table public.avalon_game_results alter column best_player_votes set not null;

create or replace function public.avalon_record_game_result()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.state->>'phase' is distinct from 'finished' and new.state->>'phase' = 'finished' then
    insert into public.avalon_game_results (game_id, room_id, player_id, player_name, side, won, best_player_votes)
    select coalesce((new.state->>'gameId')::uuid, new.id), new.id,
      (player.value->>'id')::uuid, player.value->>'name',
      coalesce(player.value->>'currentSide', player.value->>'side'),
      coalesce(player.value->>'currentSide', player.value->>'side') = new.state->>'winner',
      coalesce((
        select count(*)::integer
        from jsonb_each(coalesce(new.state->'bestPlayerVotes', '{}'::jsonb)) as ballot(voter_id, target_id)
        where ballot.target_id <> 'null'::jsonb
          and ballot.target_id #>> '{}' = player.value->>'id'
      ), 0)
    from jsonb_array_elements(new.state->'players') as player(value)
    on conflict (game_id, player_id) do nothing;
  end if;
  return new;
end;
$$;
