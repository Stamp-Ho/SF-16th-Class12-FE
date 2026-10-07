-- 타일 전용 n턴 멈춤 이벤트를 허용한다. 턴 수는 action_params.turns에 저장한다.
alter table public.boardgame_tiles
  drop constraint if exists boardgame_tiles_action_type_check;

alter table public.boardgame_tiles
  add constraint boardgame_tiles_action_type_check
  check (action_type in (
    'NONE', 'MOVE_STEPS', 'DIRECTION_CHANGE', 'TELEPORT',
    'SPLIT_CHOICE', 'DRAW_GOLD_CARD', 'CUSTOM_SCRIPT', 'SKIP_TURNS'
  ));
