-- Heartbeats live separately so they do not trigger boardgame_tiles Realtime reloads.
create table public.boardgame_tile_edit_leases (
  boardgame_id uuid not null references public.boardgames(id) on delete cascade,
  tile_id text not null,
  user_name text not null references public.users(username) on update cascade on delete cascade,
  session_id uuid not null,
  expires_at timestamptz not null,
  primary key (boardgame_id, tile_id)
);
create index boardgame_tile_edit_leases_expiry_idx
  on public.boardgame_tile_edit_leases(expires_at);
alter table public.boardgame_tile_edit_leases enable row level security;
revoke all on public.boardgame_tile_edit_leases from anon, authenticated;

-- Legacy locks have no live session and cannot safely be carried over.
update public.boardgame_tiles set locked_by_user_name = null
where locked_by_user_name is not null;

create or replace function public.boardgame_edit_actor(p_boardgame_id uuid)
returns text language plpgsql security invoker set search_path = '' as $$
declare v_actor text := auth.jwt()->'user_metadata'->>'name';
begin
  if auth.uid() is null or not exists (
    select 1 from public.users where username = v_actor
  ) or not exists (
    select 1 from public.boardgames g where g.id = p_boardgame_id and (
      g.maker_user_name = v_actor or exists (
        select 1 from public.boardgame_editors e
        where e.boardgame_id = g.id and e.user_name = v_actor
      )
    )
  ) then
    raise exception '이 보드게임을 편집할 권한이 없습니다.';
  end if;
  return v_actor;
end;
$$;
revoke all on function public.boardgame_edit_actor(uuid) from public, anon, authenticated;

create or replace function public.acquire_boardgame_edit_lease(
  p_boardgame_id uuid, p_tile_id text, p_session_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor text; v_expiry timestamptz;
begin
  v_actor := public.boardgame_edit_actor(p_boardgame_id);
  if p_session_id is null or nullif(p_tile_id, '') is null then
    raise exception '편집 세션과 타일을 확인해 주세요.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_boardgame_id::text, 0));
  insert into public.boardgame_tile_edit_leases as l
    (boardgame_id, tile_id, user_name, session_id, expires_at)
  values (p_boardgame_id, p_tile_id, v_actor, p_session_id, clock_timestamp() + interval '90 seconds')
  on conflict (boardgame_id, tile_id) do update
    set user_name = excluded.user_name, session_id = excluded.session_id,
        expires_at = excluded.expires_at
    where l.expires_at <= clock_timestamp()
       or (l.user_name = v_actor and l.session_id = p_session_id)
  returning expires_at into v_expiry;
  if v_expiry is null then
    raise exception '다른 편집 세션이 이 타일을 편집 중입니다.';
  end if;
  update public.boardgame_tiles set locked_by_user_name = v_actor
  where boardgame_id = p_boardgame_id and id = p_tile_id
    and locked_by_user_name is distinct from v_actor;
  return jsonb_build_object('userName', v_actor, 'expiresAt', v_expiry);
end;
$$;

create or replace function public.renew_boardgame_edit_lease(
  p_boardgame_id uuid, p_tile_id text, p_session_id uuid
) returns boolean language plpgsql security definer set search_path = '' as $$
declare v_actor text;
begin
  v_actor := public.boardgame_edit_actor(p_boardgame_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_boardgame_id::text, 0));
  update public.boardgame_tile_edit_leases
    set expires_at = clock_timestamp() + interval '90 seconds'
  where boardgame_id = p_boardgame_id and tile_id = p_tile_id
    and session_id = p_session_id and user_name = v_actor
    and expires_at > clock_timestamp();
  return found;
end;
$$;

-- Validation, writes and release share one transaction and the same board lock as acquisition.
create or replace function public.save_boardgame_with_edit_lease(
  p_input jsonb, p_session_id uuid, p_locked_tile_id text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_board uuid := (p_input->>'id')::uuid;
  v_actor text;
  v_owned text[];
  v_saved text[] := '{}';
  v_tile jsonb;
  v_card jsonb;
  v_rename jsonb;
  v_order integer := 0;
begin
  v_actor := public.boardgame_edit_actor(v_board);
  if p_session_id is null then raise exception '편집 세션이 없습니다.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_board::text, 0));
  -- Cleanup cannot delete a lease while its owner is saving.
  perform 1 from public.boardgame_tile_edit_leases
    where boardgame_id = v_board order by tile_id for update;
  select coalesce(array_agg(tile_id), '{}') into v_owned
  from public.boardgame_tile_edit_leases
  where boardgame_id = v_board and user_name = v_actor
    and session_id = p_session_id and expires_at > clock_timestamp();
  if p_locked_tile_id is not null and not (p_locked_tile_id = any(v_owned)) then
    raise exception '편집 잠금이 만료되었거나 다른 세션으로 변경되었습니다. 작성한 내용은 유지됩니다.'
      using detail = 'EDIT_LEASE_LOST';
  end if;
  if (p_input->>'saveGridSize')::boolean then
    update public.boardgames set grid_rows = (p_input->>'gridRows')::smallint,
      grid_cols = (p_input->>'gridCols')::smallint, updated_at = clock_timestamp()
    where id = v_board;
  end if;
  for v_tile in select value from jsonb_array_elements(p_input->'tiles') loop
    if v_tile->>'id' = any(v_owned) or not exists (
      select 1 from public.boardgame_tiles where boardgame_id = v_board and id = v_tile->>'id'
    ) then
      if exists (select 1 from public.boardgame_tile_edit_leases
        where boardgame_id = v_board and tile_id = v_tile->>'id'
          and expires_at > clock_timestamp() and session_id <> p_session_id) then
        raise exception '다른 세션이 편집 중인 타일은 저장할 수 없습니다.';
      end if;
      insert into public.boardgame_tiles as t (boardgame_id, id, category, grid_row, grid_col,
        label, sub_label, color, text_color, icon, action_type, action_params, is_locked)
      values (v_board, v_tile->>'id', v_tile->>'category', (v_tile->>'gridR')::integer,
        (v_tile->>'gridC')::integer, v_tile->>'label', coalesce(v_tile->>'subLabel', ''),
        v_tile->>'color', v_tile->>'textColor', v_tile->>'icon', v_tile->'action'->>'type',
        coalesce(v_tile->'action'->'params', '{}'::jsonb), coalesce((v_tile->>'isLocked')::boolean, false))
      on conflict (boardgame_id, id) do update set category = excluded.category,
        grid_row = excluded.grid_row, grid_col = excluded.grid_col, label = excluded.label,
        sub_label = excluded.sub_label, color = excluded.color, text_color = excluded.text_color,
        icon = excluded.icon, action_type = excluded.action_type, action_params = excluded.action_params,
        is_locked = excluded.is_locked;
      v_saved := array_append(v_saved, v_tile->>'id');
    end if;
  end loop;
  for v_rename in select value from jsonb_array_elements(coalesce(p_input->'tileIdRenames', '[]'::jsonb)) loop
    if v_rename->>'from' = any(v_owned) then
      update public.boardgame_tile_next set target_tile_id = v_rename->>'to'
      where boardgame_id = v_board and target_tile_id = v_rename->>'from';
    end if;
  end loop;
  delete from public.boardgame_tile_next where boardgame_id = v_board and source_tile_id = any(v_saved);
  for v_tile in select value from jsonb_array_elements(p_input->'tiles') loop
    if v_tile->>'id' = any(v_saved) then
      insert into public.boardgame_tile_next (boardgame_id, source_tile_id, target_tile_id, sort_order)
      select v_board, v_tile->>'id', value, (ordinality - 1)::smallint
      from jsonb_array_elements_text(v_tile->'nextTileIds') with ordinality;
    end if;
  end loop;
  delete from public.boardgame_tiles where boardgame_id = v_board and id = any(v_owned)
    and not exists (select 1 from jsonb_array_elements(p_input->'tiles') tile where tile->>'id' = id);
  if (p_input->>'saveGoldCards')::boolean then
    delete from public.boardgame_gold_cards where boardgame_id = v_board
      and not exists (select 1 from jsonb_array_elements(p_input->'goldCards') card where card->>'id' = id);
    -- Vacate old order slots in this transaction, including arbitrary deck reorderings.
    update public.boardgame_gold_cards set sort_order = sort_order + (
      select coalesce(max(sort_order), 0) + jsonb_array_length(p_input->'goldCards') + 1
      from public.boardgame_gold_cards where boardgame_id = v_board
    ) where boardgame_id = v_board;
    for v_card in select value from jsonb_array_elements(p_input->'goldCards') loop
      insert into public.boardgame_gold_cards (boardgame_id, id, title, description, sort_order, event_type, event_params)
      values (v_board, v_card->>'id', v_card->>'title', v_card->>'description', v_order,
        v_card->'event'->>'type', (v_card->'event') - 'type')
      on conflict (boardgame_id, id) do update set title = excluded.title,
        description = excluded.description, sort_order = excluded.sort_order,
        event_type = excluded.event_type, event_params = excluded.event_params;
      v_order := v_order + 1;
    end loop;
  end if;
  update public.boardgame_tiles set locked_by_user_name = null
    where boardgame_id = v_board and id = any(v_owned);
  delete from public.boardgame_tile_edit_leases
    where boardgame_id = v_board and session_id = p_session_id and user_name = v_actor;
end;
$$;

-- Only the database job owner may run cleanup; clients cannot clear other sessions.
create or replace function public.cleanup_expired_boardgame_edit_leases()
returns integer language plpgsql security invoker set search_path = '' as $$
declare v_count integer;
begin
  with expired as (
    select boardgame_id, tile_id from public.boardgame_tile_edit_leases
    where expires_at <= clock_timestamp() order by boardgame_id, tile_id for update skip locked
  ), removed as (
    delete from public.boardgame_tile_edit_leases l using expired e
    where l.boardgame_id = e.boardgame_id and l.tile_id = e.tile_id
    returning l.boardgame_id, l.tile_id, l.user_name
  ), cleared as (
    update public.boardgame_tiles t set locked_by_user_name = null from removed r
    where t.boardgame_id = r.boardgame_id and t.id = r.tile_id
      and t.locked_by_user_name = r.user_name returning t.id
  ) select count(*)::integer into v_count from removed;
  return v_count;
end;
$$;

revoke all on function public.acquire_boardgame_edit_lease(uuid, text, uuid) from public, anon;
revoke all on function public.renew_boardgame_edit_lease(uuid, text, uuid) from public, anon;
revoke all on function public.save_boardgame_with_edit_lease(jsonb, uuid, text) from public, anon;
revoke all on function public.cleanup_expired_boardgame_edit_leases() from public, anon, authenticated;
grant execute on function public.acquire_boardgame_edit_lease(uuid, text, uuid) to authenticated;
grant execute on function public.renew_boardgame_edit_lease(uuid, text, uuid) to authenticated;
grant execute on function public.save_boardgame_with_edit_lease(jsonb, uuid, text) to authenticated;
