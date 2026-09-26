-- DiceArena boardgame schema
-- Prerequisite: public.users.username is unique.

create extension if not exists pgcrypto;

create unique index if not exists users_username_unique_idx
  on public.users (username);

create table if not exists public.boardgames (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  grid_rows smallint not null check (grid_rows between 3 and 20),
  grid_cols smallint not null check (grid_cols between 3 and 20),
  maker_user_name text not null
    references public.users (username) on update cascade on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.boardgame_editors (
  id uuid primary key default gen_random_uuid(),
  boardgame_id uuid not null
    references public.boardgames (id) on delete cascade,
  user_name text not null
    references public.users (username) on update cascade on delete cascade,
  created_at timestamptz not null default now(),
  constraint boardgame_editors_boardgame_user_unique unique (boardgame_id, user_name)
);

create table if not exists public.boardgame_tiles (
  boardgame_id uuid not null
    references public.boardgames (id) on delete cascade,
  id text not null,
  category text not null check (category in ('OUTER', 'INNER', 'SPECIAL_DECK')),
  grid_row integer not null check (grid_row >= 0),
  grid_col integer not null check (grid_col >= 0),
  label text not null default '',
  sub_label text not null default '',
  color text,
  text_color text,
  icon text,
  action_type text not null default 'NONE'
    check (action_type in (
      'NONE', 'MOVE_STEPS', 'DIRECTION_CHANGE', 'TELEPORT',
      'SPLIT_CHOICE', 'DRAW_GOLD_CARD', 'CUSTOM_SCRIPT'
    )),
  action_params jsonb not null default '{}'::jsonb
    check (jsonb_typeof(action_params) = 'object'),
  is_locked boolean not null default false,
  locked_by_user_name text
    references public.users (username) on update cascade on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (boardgame_id, id),
  constraint boardgame_tiles_grid_position_unique unique (boardgame_id, grid_row, grid_col)
);

-- A row per directed connection preserves ordering and validates both tile references.
create table if not exists public.boardgame_tile_next (
  boardgame_id uuid not null,
  source_tile_id text not null,
  target_tile_id text not null,
  sort_order smallint not null default 0 check (sort_order >= 0),
  primary key (boardgame_id, source_tile_id, target_tile_id),
  constraint boardgame_tile_next_source_fk
    foreign key (boardgame_id, source_tile_id)
    references public.boardgame_tiles (boardgame_id, id) on delete cascade,
  constraint boardgame_tile_next_target_fk
    foreign key (boardgame_id, target_tile_id)
    references public.boardgame_tiles (boardgame_id, id) on delete cascade,
  constraint boardgame_tile_next_order_unique unique (boardgame_id, source_tile_id, sort_order)
);

create table if not exists public.boardgame_gold_cards (
  boardgame_id uuid not null
    references public.boardgames (id) on delete cascade,
  id text not null,
  title text not null default '',
  description text not null default '',
  sort_order integer not null default 0 check (sort_order >= 0),
  event_type text not null default 'TEXT'
    check (event_type in (
      'TEXT', 'MOVE_PAWN_SPECIFIED', 'MOVE_PAWN_CHOOSE', 'SWAP_POSITIONS_CHOOSE'
    )),
  event_params jsonb not null default '{}'::jsonb
    check (jsonb_typeof(event_params) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (boardgame_id, id),
  constraint boardgame_gold_cards_sort_order_unique unique (boardgame_id, sort_order)
);

create index if not exists boardgames_maker_user_name_idx
  on public.boardgames (maker_user_name);
create index if not exists boardgame_editors_user_name_idx
  on public.boardgame_editors (user_name);
create index if not exists boardgame_tiles_boardgame_grid_idx
  on public.boardgame_tiles (boardgame_id, grid_row, grid_col);
create index if not exists boardgame_gold_cards_order_idx
  on public.boardgame_gold_cards (boardgame_id, sort_order);

-- Add RLS policies before exposing these tables through the Supabase client.
