-- Count each completed game once, regardless of its player count.
create view public.avalon_side_stats as
with game_winners as (
  select game_id,
    min(case when won then side when side = 'good' then 'evil' else 'good' end) as winner
  from public.avalon_game_results
  group by game_id
)
select count(*)::integer as games,
  count(*) filter (where winner = 'good')::integer as good_wins,
  count(*) filter (where winner = 'evil')::integer as evil_wins
from game_winners;

revoke all on public.avalon_side_stats from anon, authenticated;
grant select on public.avalon_side_stats to service_role;
