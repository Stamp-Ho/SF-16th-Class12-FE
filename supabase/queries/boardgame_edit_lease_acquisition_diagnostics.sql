-- Run in Supabase SQL Editor as postgres WHILE a tile is being edited.
-- Do not click Complete: successful save deletes the session's lease.
-- These queries are read-only and do not require pg_cron.

-- 1. Confirm this is an admin SQL query, not an RLS-filtered client query.
select current_user as sql_user, current_database() as database_name,
  clock_timestamp() as server_time;

-- 2. Confirm the deployed acquisition function contains the lease INSERT.
-- Expect one row, the uuid/text/uuid signature, and writes_lease = true.
select p.oid::regprocedure as function_signature,
  p.prosecdef as security_definer,
  pg_get_functiondef(p.oid) ilike '%insert into public.boardgame_tile_edit_leases%'
    as writes_lease
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'acquire_boardgame_edit_lease';

-- 3. Active / expired / missing lease records for each tile showing a lock.
-- No session tokens or user names are returned.
select t.boardgame_id, t.id as tile_id,
  l.tile_id is not null as has_lease,
  l.expires_at,
  l.expires_at > clock_timestamp() as lease_is_active,
  case when l.tile_id is null then null
    else t.locked_by_user_name = l.user_name end as owner_matches
from public.boardgame_tiles t
left join public.boardgame_tile_edit_leases l
  on l.boardgame_id = t.boardgame_id and l.tile_id = t.id
where t.locked_by_user_name is not null
order by t.boardgame_id, t.id;

-- 4. Include newly created tiles which do not have a saved tile row yet.
select boardgame_id, tile_id, expires_at,
  expires_at > clock_timestamp() as lease_is_active
from public.boardgame_tile_edit_leases
order by expires_at desc;
