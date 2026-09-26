alter table public.boardgame_tiles
  add column if not exists locked_by_user_name text
    references public.users (username) on update cascade on delete set null;

alter table public.boardgames
  drop constraint if exists boardgames_edit_lock_owner_check,
  drop column if exists is_locked,
  drop column if exists locked_by_user_name;
