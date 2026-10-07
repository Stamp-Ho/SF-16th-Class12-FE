"use server";

import { requireAuth } from "@/utils/auth";
import { createClient } from "@/utils/supabase/server";
import type { BoardTileData, TileActionType } from "./types/board";
import type { GoldCardData, GoldCardEventType } from "./gold-cards/types";

export type BoardgameResult<T> =
  | { success: true; data: T }
  | { success: false; message: string; code?: string };

export interface BoardgameSummary {
  id: string;
  name: string;
  grid_rows: number;
  grid_cols: number;
  maker_user_name: string;
  can_edit: boolean;
  is_maker: boolean;
	editors: string[];
}

export interface BoardgameSnapshot {
  id: string;
  name: string;
  grid_rows: number;
  grid_cols: number;
	tiles: BoardTileData[];
  gold_cards: GoldCardData[];
}

const failure = <T = never>(message: string, code?: string): BoardgameResult<T> => ({
  success: false,
  message,
  ...(code ? { code } : {}),
});

async function getActor() {
  const auth = await requireAuth();
  if (auth.status !== "AUTHORIZED" || !auth.profile?.username) return null;
  return {
    userName: String(auth.profile.username),
    role: String(auth.profile.role ?? ""),
  };
}

async function canEditBoardgame(
  boardgameId: string,
  userName: string,
  makerOnly = false,
) {
  const supabase = await createClient();
  const { data: game, error } = await supabase
    .from("boardgames")
    .select("maker_user_name")
    .eq("id", boardgameId)
    .maybeSingle();

  if (error || !game) return { allowed: false, error: error?.message };
  if (game.maker_user_name === userName) return { allowed: true };
  if (makerOnly) return { allowed: false };

  const { data: editor, error: editorError } = await supabase
    .from("boardgame_editors")
    .select("id")
    .eq("boardgame_id", boardgameId)
    .eq("user_name", userName)
    .maybeSingle();

  return {
    allowed: Boolean(editor),
    error: editorError?.message,
  };
}

export async function listBoardgames(): Promise<BoardgameResult<BoardgameSummary[]>> {
  const actor = await getActor();
  if (!actor) return failure("로그인이 필요합니다.");

  const supabase = await createClient();
  const [{ data: games, error }, { data: edits, error: editError }] =
    await Promise.all([
      supabase
        .from("boardgames")
        .select(
			"id, name, grid_rows, grid_cols, maker_user_name",
        )
        .order("updated_at", { ascending: false }),
      supabase
        .from("boardgame_editors")
        .select("boardgame_id, user_name"),
    ]);

  if (error) return failure(error.message);
  if (editError) return failure(editError.message);

  const editableIds = new Set(
    (edits ?? [])
      .filter((edit) => edit.user_name === actor.userName)
      .map((edit) => edit.boardgame_id),
  );
  return {
    success: true,
    data: (games ?? []).map((game) => ({
      ...game,
      is_maker: game.maker_user_name === actor.userName,
      can_edit:
        game.maker_user_name === actor.userName || editableIds.has(game.id),
		editors: (edits ?? [])
        .filter((edit) => edit.boardgame_id === game.id)
        .map((edit) => edit.user_name),
    })),
  };
}

export async function createBoardgame(input: {
  name: string;
  gridRows: number;
  gridCols: number;
}): Promise<BoardgameResult<BoardgameSummary>> {
  const actor = await getActor();
  if (!actor) return failure("로그인이 필요합니다.");
  if (actor.role !== "super_admin") {
    return failure("새 보드게임은 관리자만 만들 수 있습니다.");
  }

  const name = input.name.trim();
  if (!name) return failure("게임 이름을 입력해 주세요.");
  if (
    !Number.isInteger(input.gridRows) ||
    !Number.isInteger(input.gridCols) ||
    input.gridRows < 3 || input.gridRows > 20 ||
    input.gridCols < 3 || input.gridCols > 20
  ) {
    return failure("행과 열은 3부터 20 사이의 정수여야 합니다.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("boardgames")
    .insert({
      name,
      grid_rows: input.gridRows,
      grid_cols: input.gridCols,
      maker_user_name: actor.userName,
	})
    .select(
		"id, name, grid_rows, grid_cols, maker_user_name",
    )
    .single();

  if (error) return failure(error.message);
  return {
    success: true,
    data: {
      ...data,
      can_edit: true,
      is_maker: true,
		editors: [],
    },
  };
}

export async function getBoardgame(
  boardgameId: string,
): Promise<BoardgameResult<BoardgameSnapshot>> {
  const actor = await getActor();
  if (!actor) return failure("로그인이 필요합니다.");

  const supabase = await createClient();
  const [gameResult, tileResult, linkResult, cardResult] = await Promise.all([
    supabase
		.from("boardgames")
		.select("id, name, grid_rows, grid_cols")
      .eq("id", boardgameId)
      .maybeSingle(),
    supabase.from("boardgame_tiles").select("*").eq("boardgame_id", boardgameId),
    supabase
      .from("boardgame_tile_next")
      .select("source_tile_id, target_tile_id, sort_order")
      .eq("boardgame_id", boardgameId)
      .order("sort_order"),
    supabase
      .from("boardgame_gold_cards")
      .select("*")
      .eq("boardgame_id", boardgameId)
      .order("sort_order"),
  ]);

  const queryError =
    gameResult.error || tileResult.error || linkResult.error || cardResult.error;
  if (queryError) return failure(queryError.message);
  if (!gameResult.data) return failure("보드게임을 찾을 수 없습니다.");

  const nextIdsBySource = new Map<string, string[]>();
  for (const link of linkResult.data ?? []) {
    const ids = nextIdsBySource.get(link.source_tile_id) ?? [];
    ids.push(link.target_tile_id);
    nextIdsBySource.set(link.source_tile_id, ids);
  }

  const tiles: BoardTileData[] = (tileResult.data ?? []).map((tile) => ({
    id: tile.id,
    category: tile.category,
    gridR: tile.grid_row,
    gridC: tile.grid_col,
    // 월드 좌표와 회전은 현재 격자 크기에서 다시 계산한다.
    position: { x: 0, y: 0.2, z: 0 },
    rotationY: 0,
    label: tile.label,
    subLabel: tile.sub_label,
    color: tile.color ?? undefined,
    textColor: tile.text_color ?? undefined,
    icon: tile.icon ?? undefined,
    nextTileIds: nextIdsBySource.get(tile.id) ?? [],
    action: {
      type: tile.action_type as TileActionType,
      params: tile.action_params ?? {},
    },
		isLocked: tile.is_locked,
		lockedByUserName: tile.locked_by_user_name,
	}));

  const gold_cards: GoldCardData[] = (cardResult.data ?? []).map((card) => ({
    id: card.id,
    title: card.title,
    description: card.description,
    event: {
      type: card.event_type as GoldCardEventType,
      ...(card.event_params ?? {}),
    },
  }));

  return {
    success: true,
    data: { ...gameResult.data, tiles, gold_cards },
  };
}

export async function saveBoardgame(input: {
  id: string;
  gridRows: number;
  gridCols: number;
  tiles: BoardTileData[];
  goldCards: GoldCardData[];
  saveGridSize?: boolean;
  saveGoldCards?: boolean;
  editSessionId: string;
  lockedTileId: string | null;
  tileIdRenames?: Array<{ from: string; to: string }>;
}): Promise<BoardgameResult<null>> {
  const actor = await getActor();
  if (!actor) return failure("로그인이 필요합니다.");
  const permission = await canEditBoardgame(input.id, actor.userName);
  if (!permission.allowed) {
    return failure(permission.error ?? "이 보드게임을 수정할 권한이 없습니다.");
  }

  const supabase = await createClient();
  if (
    !Number.isInteger(input.gridRows) || !Number.isInteger(input.gridCols) ||
    input.gridRows < 3 || input.gridRows > 20 ||
    input.gridCols < 3 || input.gridCols > 20
  ) {
    return failure("격자 크기를 확인해 주세요.");
  }

  const tileIds = new Set(input.tiles.map((tile) => tile.id));
  const occupiedCells = new Set<string>();
  for (const tile of input.tiles) {
		if (tile.action.type === 'SKIP_TURNS') {
			const turns = tile.action.params?.turns;
			if (typeof turns !== 'number' || !Number.isSafeInteger(turns) || turns < 1 || turns > 99) {
				return failure(`타일 ${tile.id}의 멈춤 턴 수는 1부터 99 사이의 정수여야 합니다.`);
			}
		}
    if (
      !Number.isInteger(tile.gridR) || !Number.isInteger(tile.gridC) ||
      tile.gridR < 0 || tile.gridR >= input.gridRows ||
      tile.gridC < 0 || tile.gridC >= input.gridCols
    ) {
      return failure(`타일 ${tile.id}의 격자 위치가 범위를 벗어났습니다.`);
    }
    const cell = `${tile.gridR}:${tile.gridC}`;
    if (occupiedCells.has(cell)) return failure("같은 격자 위치에 타일이 중복되었습니다.");
    occupiedCells.add(cell);
    if (tile.nextTileIds.some((id) => !tileIds.has(id))) {
      return failure(`타일 ${tile.id}의 다음 칸 설정에 없는 타일이 포함되어 있습니다.`);
    }
  }

  const { error } = await supabase.rpc("save_boardgame_with_edit_lease", {
    p_input: input,
    p_session_id: input.editSessionId,
    p_locked_tile_id: input.lockedTileId,
  });
  if (error) return failure(error.message, error.details === 'EDIT_LEASE_LOST' ? 'EDIT_LEASE_LOST' : undefined);
  return { success: true, data: null };
}

export async function acquireBoardgameTileEditLock(
  boardgameId: string,
  tileId: string,
  sessionId: string,
): Promise<BoardgameResult<{ userName: string; expiresAt: string }>> {
  const actor = await getActor();
  if (!actor) return failure("로그인이 필요합니다.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("acquire_boardgame_edit_lease", {
    p_boardgame_id: boardgameId, p_tile_id: tileId, p_session_id: sessionId,
  });
  if (error) return failure(error.message);
  if (!data || typeof data.userName !== 'string' || typeof data.expiresAt !== 'string') {
    return failure("편집 잠금 응답을 확인할 수 없습니다.");
  }
  return { success: true, data: { userName: data.userName, expiresAt: data.expiresAt } };
}

export async function renewBoardgameTileEditLock(
  boardgameId: string,
  tileId: string,
  sessionId: string,
): Promise<BoardgameResult<boolean>> {
  const actor = await getActor();
  if (!actor) return failure("로그인이 필요합니다.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("renew_boardgame_edit_lease", {
    p_boardgame_id: boardgameId, p_tile_id: tileId, p_session_id: sessionId,
  });
  if (error) return failure(error.message);
  return { success: true, data: data === true };
}

export async function grantBoardgameEditor(
  boardgameId: string,
  userName: string,
): Promise<BoardgameResult<null>> {
  const actor = await getActor();
  if (!actor) return failure("로그인이 필요합니다.");
  const permission = await canEditBoardgame(boardgameId, actor.userName, true);
  if (!permission.allowed) return failure("수정 권한은 제작자만 부여할 수 있습니다.");

  const supabase = await createClient();
  const { error } = await supabase.from("boardgame_editors").insert({
    boardgame_id: boardgameId,
    user_name: userName.trim(),
  });
  if (error) return failure(error.message);
  return { success: true, data: null };
}

export async function revokeBoardgameEditor(
  boardgameId: string,
  userName: string,
): Promise<BoardgameResult<null>> {
  const actor = await getActor();
  if (!actor) return failure("로그인이 필요합니다.");
  const permission = await canEditBoardgame(boardgameId, actor.userName, true);
  if (!permission.allowed) return failure("수정 권한은 제작자만 회수할 수 있습니다.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("boardgame_editors")
    .delete()
    .eq("boardgame_id", boardgameId)
    .eq("user_name", userName.trim());
  if (error) return failure(error.message);
  return { success: true, data: null };
}

export async function deleteBoardgame(
  boardgameId: string,
): Promise<BoardgameResult<null>> {
  const actor = await getActor();
  if (!actor) return failure("로그인이 필요합니다.");
  const permission = await canEditBoardgame(boardgameId, actor.userName, true);
  if (!permission.allowed) return failure("게임 삭제는 제작자만 할 수 있습니다.");

  const supabase = await createClient();
  const { error } = await supabase.from("boardgames").delete().eq("id", boardgameId);
  if (error) return failure(error.message);
  const { error: editorError } = await supabase.from("boardgame_editors").delete().eq("boardgame_id", boardgameId);
  if (editorError) return failure(editorError.message);
  const { error: nextTileError } = await supabase.from("boardgame_tile_next").delete().eq("boardgame_id", boardgameId);
  if (nextTileError) return failure(nextTileError.message);
  const { error: tileError } = await supabase.from("boardgame_tiles").delete().eq("boardgame_id", boardgameId);
  if (tileError) return failure(tileError.message);
  const { error: goldCardError } = await supabase.from("boardgame_gold_cards").delete().eq("boardgame_id", boardgameId);
  if (goldCardError) return failure(goldCardError.message);
  return { success: true, data: null };
}
