alter table public.boardgames
  add column if not exists is_locked boolean not null default false,
  add column if not exists locked_by_user_name text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'boardgames_edit_lock_owner_check'
      and conrelid = 'public.boardgames'::regclass
  ) then
    alter table public.boardgames
      add constraint boardgames_edit_lock_owner_check
      check (is_locked = (locked_by_user_name is not null));
  end if;
end;
$$;
